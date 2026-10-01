// Embedding backfill. See docs/ARCHITECTURE.md section 7.1 step 4.
// Only jobs with no vector, a stale content hash, or a vector from another model are embedded, so a second
// run does no work. The summary line reports embedded vs skipped so the cache hit rate is measurable.
import { count, sql } from 'drizzle-orm';
import type { Database } from 'db';
import { jobEmbeddings, jobs } from 'db';
import { jobEmbeddingText, type Embedder } from '../services/embeddings.js';

/** Rows pulled from the database per pass. Embedding happens in batches of 32 inside the embedder. */
const PAGE_SIZE = 256;

interface PendingRow extends Record<string, unknown> {
  id: string | number;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  content_hash: string;
}

interface PendingJob {
  id: number;
  title: string;
  company: string;
  location: string | null;
  description: string;
  contentHash: string;
}

/** Jobs that need a vector: none stored, a different content hash, or a different model. */
async function selectPending(db: Database, model: string, pageSize: number): Promise<PendingJob[]> {
  const rows = await db.execute<PendingRow>(sql`
    SELECT j.id, j.title, c.name AS company, j.location, j.description, j.content_hash
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_embeddings e ON e.job_id = j.id
    WHERE e.job_id IS NULL OR e.content_hash <> j.content_hash OR e.model <> ${model}
    ORDER BY j.id
    LIMIT ${pageSize}
  `);

  return rows.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    company: row.company ?? '',
    location: row.location,
    description: row.description,
    contentHash: row.content_hash,
  }));
}

export interface EmbedSummary {
  embedded: number;
  /** Jobs that already had a current vector and were not touched. */
  skippedCached: number;
  totalJobs: number;
}

export async function backfillEmbeddings(
  db: Database,
  embedder: Embedder,
  options: { limit?: number; onProgress?: (embedded: number) => void } = {},
): Promise<EmbedSummary> {
  const [totalRow] = await db.select({ value: count() }).from(jobs);
  const totalJobs = totalRow?.value ?? 0;

  let embedded = 0;
  for (;;) {
    const remaining = options.limit === undefined ? PAGE_SIZE : Math.min(PAGE_SIZE, options.limit - embedded);
    if (remaining <= 0) break;

    const pending = await selectPending(db, embedder.model, remaining);
    if (pending.length === 0) break;

    const vectors = await embedder.embed(pending.map((job) => jobEmbeddingText(job)));

    await db
      .insert(jobEmbeddings)
      .values(
        pending.map((job, index) => ({
          jobId: job.id,
          model: embedder.model,
          contentHash: job.contentHash,
          embedding: Array.from(vectors[index]!),
        })),
      )
      .onConflictDoUpdate({
        target: jobEmbeddings.jobId,
        set: {
          model: sql`excluded.model`,
          contentHash: sql`excluded.content_hash`,
          embedding: sql`excluded.embedding`,
          createdAt: sql`now()`,
        },
      });

    embedded += pending.length;
    options.onProgress?.(embedded);
  }

  return { embedded, skippedCached: Math.max(0, totalJobs - embedded), totalJobs };
}
