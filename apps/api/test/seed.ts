import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { Database } from 'db';
import { companies, jobEmbeddings, jobs } from 'db';
import { jobContentHash } from '../src/lib/hash.js';
import { jobEmbeddingText, type Embedder } from '../src/services/embeddings.js';

interface FixtureJob {
  sourceId: string;
  source: 'remotive' | 'adzuna';
  title: string;
  company: string;
  description: string;
  location: string | null;
  country: string | null;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string;
  url: string;
}

const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/jobs.json');

export const fixtureJobs = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureJob[];

/** Replace the fixture corpus in the test database and embed it with the given embedder. */
export async function seedFixtureJobs(db: Database, embedder: Embedder): Promise<void> {
  await db.execute(
    sql`TRUNCATE search_logs, matches, resumes, job_embeddings, jobs, companies RESTART IDENTITY`,
  );

  const companyIds = new Map<string, number>();
  for (const name of new Set(fixtureJobs.map((job) => job.company))) {
    const [row] = await db
      .insert(companies)
      .values({ name, nameNorm: name.toLowerCase() })
      .returning({ id: companies.id });
    companyIds.set(name, row!.id);
  }

  const inserted = await db
    .insert(jobs)
    .values(
      fixtureJobs.map((job) => ({
        companyId: companyIds.get(job.company)!,
        title: job.title,
        description: job.description,
        location: job.location,
        country: job.country,
        isRemote: job.isRemote,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        postedAt: new Date(job.postedAt),
        source: job.source,
        sourceId: job.sourceId,
        url: job.url,
        contentHash: jobContentHash(job),
      })),
    )
    .returning({ id: jobs.id, sourceId: jobs.sourceId });

  const bySourceId = new Map(inserted.map((row) => [row.sourceId, row.id]));
  const vectors = await embedder.embed(fixtureJobs.map((job) => jobEmbeddingText(job)));

  await db.insert(jobEmbeddings).values(
    fixtureJobs.map((job, index) => ({
      jobId: bySourceId.get(job.sourceId)!,
      model: embedder.model,
      contentHash: jobContentHash(job),
      embedding: Array.from(vectors[index]!),
    })),
  );
}

/** The fixture job id for a source id, for assertions. */
export async function fixtureJobId(db: Database, sourceId: string): Promise<number> {
  const rows = await db.execute<{ id: string | number } & Record<string, unknown>>(
    sql`SELECT id FROM jobs WHERE source_id = ${sourceId}`,
  );
  return Number(rows.rows[0]?.id);
}
