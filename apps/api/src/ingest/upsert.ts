// Writes normalized jobs to Postgres with the two conflict rules from ARCHITECTURE section 7.1 step 3.
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from 'db';
import { companies, jobs } from 'db';
import { jobContentHash } from '../lib/hash.js';
import { normalizeCompanyName } from './normalize.js';
import type { NormalizedJob } from './types.js';

export interface UpsertSummary {
  inserted: number;
  /** Rows that already existed; only `posted_at` and `url` were refreshed. */
  updated: number;
}

/** Insert a company if its normalized name is new, and return its id. */
export async function upsertCompany(db: Database, name: string): Promise<number> {
  const nameNorm = normalizeCompanyName(name);
  const [row] = await db
    .insert(companies)
    .values({ name: name.trim(), nameNorm })
    .onConflictDoUpdate({ target: companies.nameNorm, set: { name: sql`excluded.name` } })
    .returning({ id: companies.id });
  if (row) return row.id;

  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.nameNorm, nameNorm));
  if (!existing) throw new Error(`upsertCompany: could not resolve company "${name}"`);
  return existing.id;
}

/**
 * Upsert a batch of jobs.
 *
 * A new posting is inserted. A posting that collides on `content_hash` (the same advert, possibly from the
 * other source) or on `(source, source_id)` is not re-inserted; for the latter, `posted_at` and `url` are
 * refreshed, which is all section 7.1 asks for.
 *
 * The refresh runs one statement per existing row. At this corpus size (thousands) that costs a few seconds;
 * if ingestion grows, batch it with a single `UPDATE ... FROM (VALUES ...)`.
 */
export async function upsertJobs(db: Database, batch: NormalizedJob[]): Promise<UpsertSummary> {
  if (batch.length === 0) return { inserted: 0, updated: 0 };

  const companyIds = new Map<string, number>();
  for (const job of batch) {
    const key = normalizeCompanyName(job.company);
    if (!companyIds.has(key)) companyIds.set(key, await upsertCompany(db, job.company));
  }

  const allRows = batch.map((job) => ({
    companyId: companyIds.get(normalizeCompanyName(job.company))!,
    title: job.title,
    description: job.description,
    location: job.location,
    country: job.country,
    isRemote: job.isRemote,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    postedAt: job.postedAt,
    source: job.source,
    sourceId: job.sourceId,
    url: job.url,
    contentHash: jobContentHash(job),
  }));

  // The same advert can appear twice in one batch (two search terms, or both sources); keep the first.
  const rows = [...new Map(allRows.map((row) => [row.contentHash, row])).values()];

  // No conflict target: a row may collide on content_hash or on (source, source_id), and both mean "already here".
  const insertedRows = await db
    .insert(jobs)
    .values(rows)
    .onConflictDoNothing()
    .returning({ contentHash: jobs.contentHash });
  const insertedHashes = new Set(insertedRows.map((row) => row.contentHash));

  let updated = 0;
  for (const row of rows) {
    if (insertedHashes.has(row.contentHash)) continue;
    const refreshed = await db
      .update(jobs)
      .set({ postedAt: row.postedAt, url: row.url })
      .where(and(eq(jobs.source, row.source), eq(jobs.sourceId, row.sourceId)))
      .returning({ id: jobs.id });
    updated += refreshed.length;
  }

  return { inserted: insertedRows.length, updated };
}
