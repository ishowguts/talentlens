import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { companies, jobEmbeddings, jobs } from 'db';
import { backfillEmbeddings } from '../src/ingest/embed.js';
import { EMBEDDING_DIMS, type Embedder } from '../src/services/embeddings.js';
import { jobContentHash } from '../src/lib/hash.js';
import { createTestApp } from './helpers.js';

const { db, close } = createTestApp();

/** A deterministic stand-in for the real model: the suite tests the cache, not the vectors. */
const fakeEmbedder: Embedder = {
  model: 'test-model',
  dims: EMBEDDING_DIMS,
  embed: async (texts) =>
    texts.map(() => {
      const vector = new Float32Array(EMBEDDING_DIMS);
      vector[0] = 1;
      return vector;
    }),
};

const TEST_SOURCE_ID = 'backfill-test-1';

async function seedJob(description: string): Promise<number> {
  const [company] = await db
    .insert(companies)
    .values({ name: 'Backfill Test Co', nameNorm: 'backfill test co' })
    .onConflictDoUpdate({ target: companies.nameNorm, set: { name: sql`excluded.name` } })
    .returning({ id: companies.id });

  const job = {
    title: 'Backfill Test Engineer',
    company: 'Backfill Test Co',
    location: 'Remote',
    description,
  };
  const [row] = await db
    .insert(jobs)
    .values({
      companyId: company!.id,
      title: job.title,
      description: job.description,
      location: job.location,
      country: null,
      isRemote: true,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt: null,
      source: 'remotive',
      sourceId: TEST_SOURCE_ID,
      url: 'https://example.com/backfill-test-1',
      contentHash: jobContentHash(job),
    })
    .returning({ id: jobs.id });
  return row!.id;
}

async function clean(): Promise<void> {
  await db.delete(jobs).where(eq(jobs.sourceId, TEST_SOURCE_ID));
  await db.delete(companies).where(eq(companies.nameNorm, 'backfill test co'));
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('backfillEmbeddings', () => {
  it('embeds a job that has no vector, then embeds nothing on a second run', async () => {
    const jobId = await seedJob('We need someone who writes TypeScript.');

    const first = await backfillEmbeddings(db, fakeEmbedder);
    expect(first.embedded).toBeGreaterThanOrEqual(1);

    const stored = await db.select().from(jobEmbeddings).where(eq(jobEmbeddings.jobId, jobId));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.model).toBe('test-model');
    expect(stored[0]?.embedding).toHaveLength(EMBEDDING_DIMS);

    const second = await backfillEmbeddings(db, fakeEmbedder);
    expect(second.embedded).toBe(0);
    expect(second.skippedCached).toBe(second.totalJobs);
  });

  it('re-embeds a job whose content hash changed', async () => {
    const jobId = await seedJob('First description.');
    await backfillEmbeddings(db, fakeEmbedder);

    await db.update(jobs).set({ contentHash: 'changed-hash' }).where(eq(jobs.id, jobId));

    const after = await backfillEmbeddings(db, fakeEmbedder);

    expect(after.embedded).toBe(1);
    const stored = await db.select().from(jobEmbeddings).where(eq(jobEmbeddings.jobId, jobId));
    expect(stored[0]?.contentHash).toBe('changed-hash');
  });

  it('respects a limit', async () => {
    await seedJob('Only one job is pending.');

    const result = await backfillEmbeddings(db, fakeEmbedder, { limit: 1 });

    expect(result.embedded).toBe(1);
  });
});
