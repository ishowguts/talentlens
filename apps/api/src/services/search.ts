// Search service. See docs/ARCHITECTURE.md section 7.3.
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from 'db';
import type { JobSummary, SearchFilters, SearchQuery, SearchResponse, SearchResult } from 'shared';
import { snippet } from '../lib/text.js';
import type { Embedder } from './embeddings.js';
import { rrfFuse } from './rrf.js';

/** Rows each mode retrieves before fusion and pagination. */
export const CANDIDATE_LIMIT = 100;

/** Pagination runs over the fused head only; past this, `hasMore` is false (section 7.3). */
export const MAX_FUSED = 200;

export interface SearchDeps {
  db: Database;
  embedder: Embedder;
}

interface CandidateRow extends Record<string, unknown> {
  id: string | number;
  title: string;
  company: string | null;
  location: string | null;
  is_remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: string | Date | null;
  description: string;
  distance?: number;
  rank?: number;
}

/** The filter clause shared by every mode (section 7.3). */
function filterClause(filters: SearchFilters): SQL {
  const remote = filters.remote ?? null;
  const country = filters.country ?? null;
  const salaryMin = filters.salaryMin ?? null;
  return sql`
    (${remote}::boolean IS NULL OR j.is_remote = ${remote}::boolean)
    AND (${country}::text IS NULL OR j.country = ${country}::text)
    AND (${salaryMin}::int IS NULL OR j.salary_max >= ${salaryMin}::int)
  `;
}

function toJobSummary(row: CandidateRow): JobSummary {
  const postedAt =
    row.posted_at instanceof Date
      ? row.posted_at.toISOString()
      : row.posted_at
        ? new Date(row.posted_at).toISOString()
        : null;
  return {
    id: Number(row.id),
    title: row.title,
    company: row.company ?? 'Unknown',
    location: row.location,
    isRemote: row.is_remote,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryCurrency: row.salary_currency,
    postedAt,
    snippet: snippet(row.description),
  };
}

const JOB_COLUMNS = sql`
  j.id, j.title, c.name AS company, j.location, j.is_remote,
  j.salary_min, j.salary_max, j.salary_currency, j.posted_at, j.description
`;

/**
 * Vector candidates, nearest first. `ef_search` and the relaxed iterative scan (pgvector 0.8) keep a filtered
 * query from running out of candidates inside the HNSW graph.
 */
export async function vectorCandidates(
  deps: SearchDeps,
  queryText: string,
  filters: SearchFilters,
  limit = CANDIDATE_LIMIT,
): Promise<SearchResult[]> {
  const [vector] = await deps.embedder.embed([queryText]);
  if (!vector) return [];
  const literal = `[${Array.from(vector).join(',')}]`;

  const rows = await deps.db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL hnsw.ef_search = 100`);
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`);
    return tx.execute<CandidateRow>(sql`
      SELECT ${JOB_COLUMNS}, (e.embedding <=> ${literal}::vector) AS distance
      FROM job_embeddings e
      JOIN jobs j ON j.id = e.job_id
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE ${filterClause(filters)}
      ORDER BY e.embedding <=> ${literal}::vector
      LIMIT ${limit}
    `);
  });

  return rows.rows.map((row, index) => ({
    job: toJobSummary(row),
    // Vectors are unit length, so cosine similarity is 1 - cosine distance.
    score: 1 - Number(row.distance ?? 1),
    ranks: { keyword: null, vector: index + 1 },
  }));
}

/**
 * Keyword candidates, best match first. `websearch_to_tsquery` gives users quoted phrases, OR and -term for
 * free, and `ts_rank_cd` scores by term density and position.
 */
export async function keywordCandidates(
  deps: SearchDeps,
  queryText: string,
  filters: SearchFilters,
  limit = CANDIDATE_LIMIT,
): Promise<SearchResult[]> {
  const rows = await deps.db.execute<CandidateRow>(sql`
    SELECT ${JOB_COLUMNS}, ts_rank_cd(j.search_tsv, websearch_to_tsquery('english', ${queryText})) AS rank
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.search_tsv @@ websearch_to_tsquery('english', ${queryText})
      AND ${filterClause(filters)}
    ORDER BY rank DESC, j.posted_at DESC NULLS LAST
    LIMIT ${limit}
  `);

  return rows.rows.map((row, index) => ({
    job: toJobSummary(row),
    score: Number(row.rank ?? 0),
    ranks: { keyword: index + 1, vector: null },
  }));
}

/**
 * Hybrid candidates: keyword and vector lists fused with RRF. Keyword catches exact titles and acronyms,
 * vectors catch synonyms and intent (ADR-006).
 */
export async function hybridCandidates(
  deps: SearchDeps,
  queryText: string,
  filters: SearchFilters,
): Promise<SearchResult[]> {
  const [keyword, vector] = await Promise.all([
    keywordCandidates(deps, queryText, filters),
    vectorCandidates(deps, queryText, filters),
  ]);

  const summaries = new Map<number, JobSummary>();
  for (const result of [...keyword, ...vector]) summaries.set(result.job.id, result.job);

  const fused = rrfFuse([
    { source: 'keyword', ids: keyword.map((result) => result.job.id) },
    { source: 'vector', ids: vector.map((result) => result.job.id) },
  ]);

  return fused.slice(0, MAX_FUSED).map((entry) => ({
    job: summaries.get(entry.id)!,
    score: entry.score,
    ranks: entry.ranks,
  }));
}

/** Record the search so result quality can be measured later (section 7.3). */
async function logSearch(
  db: Database,
  query: SearchQuery,
  latencyMs: number,
  resultIds: number[],
): Promise<number> {
  const filters = {
    remote: query.remote ?? null,
    country: query.country ?? null,
    salaryMin: query.salaryMin ?? null,
  };
  // Drizzle expands a JS array into separate parameters, so the array is passed as a Postgres literal.
  const idLiteral = `{${resultIds.join(',')}}`;
  const rows = await db.execute<{ id: string | number } & Record<string, unknown>>(sql`
    INSERT INTO search_logs (query, mode, filters, latency_ms, result_ids)
    VALUES (${query.q}, ${query.mode}, ${JSON.stringify(filters)}::jsonb, ${latencyMs}, ${idLiteral}::bigint[])
    RETURNING id
  `);
  return Number(rows.rows[0]?.id ?? 0);
}

export async function search(deps: SearchDeps, query: SearchQuery): Promise<SearchResponse> {
  const startedAt = Date.now();
  const filters: SearchFilters = {
    remote: query.remote,
    country: query.country,
    salaryMin: query.salaryMin,
  };

  let candidates: SearchResult[];
  switch (query.mode) {
    case 'vector':
      candidates = await vectorCandidates(deps, query.q, filters);
      break;
    case 'keyword':
      candidates = await keywordCandidates(deps, query.q, filters);
      break;
    case 'hybrid':
      candidates = await hybridCandidates(deps, query.q, filters);
      break;
  }

  const offset = (query.page - 1) * query.pageSize;
  const results = candidates.slice(offset, offset + query.pageSize);
  const latencyMs = Date.now() - startedAt;
  const logId = await logSearch(
    deps.db,
    query,
    latencyMs,
    results.map((result) => result.job.id),
  );

  return {
    results,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: offset + query.pageSize < candidates.length,
    logId,
    latencyMs,
  };
}
