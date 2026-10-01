// Shared pieces of the evaluation tooling. See docs/ARCHITECTURE.md section 8.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from 'db';
import { SEARCH_MODES, type SearchMode } from 'shared';
import { getEmbedder } from 'api/services/embeddings';
import { keywordCandidates, vectorCandidates, hybridCandidates } from 'api/services/search';
import type { SearchResult } from 'shared';

export const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../.env'), quiet: true });

export const QUERIES_PATH = path.join(here, 'queries.jsonl');
export const RESULTS_PATH = path.join(here, 'results.md');

export type QueryGroup = 'title' | 'skill' | 'vague';

export interface EvalQuery {
  id: string;
  group: QueryGroup;
  query: string;
  /** Content hashes judged relevant by the owner. Keyed by hash so labels survive re-ingestion. */
  relevant: string[];
}

export function loadQueries(): EvalQuery[] {
  return readFileSync(QUERIES_PATH, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalQuery);
}

export function saveQueries(queries: EvalQuery[]): void {
  writeFileSync(QUERIES_PATH, `${queries.map((query) => JSON.stringify(query)).join('\n')}\n`);
}

export function openDatabase(): { db: Database; close: () => Promise<void> } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  const { db, close } = createDb(url);
  return { db, close };
}

export function embedder() {
  return getEmbedder(process.env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2');
}

export const MODES: readonly SearchMode[] = SEARCH_MODES;

/** Run one query in one mode and return the ranked candidates with the elapsed time. */
export async function runMode(
  deps: { db: Database; embedder: ReturnType<typeof embedder> },
  mode: SearchMode,
  query: string,
): Promise<{ results: SearchResult[]; ms: number }> {
  const startedAt = performance.now();
  const results =
    mode === 'keyword'
      ? await keywordCandidates(deps, query, {})
      : mode === 'vector'
        ? await vectorCandidates(deps, query, {})
        : await hybridCandidates(deps, query, {});
  return { results, ms: performance.now() - startedAt };
}

/** Content hash for each job id, so judgements survive re-ingestion. */
export async function contentHashes(db: Database, jobIds: number[]): Promise<Map<number, string>> {
  if (jobIds.length === 0) return new Map();
  const rows = await db.execute<{ id: string | number; content_hash: string } & Record<string, unknown>>(
    sql`SELECT id, content_hash FROM jobs WHERE id IN ${jobIds}`,
  );
  return new Map(rows.rows.map((row) => [Number(row.id), row.content_hash]));
}

export function gitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}
