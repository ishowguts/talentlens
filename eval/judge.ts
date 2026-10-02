// Automated relevance judge. See docs/ARCHITECTURE.md section 8 and ADR-017.
// Usage: pnpm --filter eval judge [--query q07] [--force]
//
// For every query it pools the top 20 from each mode, asks the model to judge the whole pool in one call
// against a fixed rubric, and stores the verdicts keyed by query id and job content hash. Labels already
// stored are not judged again, so a re-run costs nothing and an interrupted run resumes.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import type { Database } from 'db';
import { generateValidated } from 'api/services/llm';
import type { createLlmClient } from 'api/services/llm';
import { contentHashes, here, MODES, runMode } from './lib.js';
import type { embedder } from './lib.js';
import { RUBRIC_VERSION, rubricFor, type RubricGroup } from './rubric.js';

/** Depth taken from each mode, matching the manual labeling tool. */
const POOL_DEPTH = 20;
/** How much of a posting the judge sees. Enough to tell the role and the constraints. */
const JOB_CHARS = 700;

export const JUDGE_LABELS_PATH = path.join(here, 'judge-labels.jsonl');

export interface JudgeLabels {
  id: string;
  model: string;
  rubricVersion: number;
  judgedAt: string;
  /** content hash -> relevant. Jobs the model did not return are recorded false and counted as misses. */
  labels: Record<string, boolean>;
  /** Pooled jobs the model failed to return a verdict for. */
  missing: number;
}

const verdictSchema = z.object({
  judgements: z
    .array(
      z.object({
        jobId: z.number().int(),
        relevant: z.boolean(),
      }),
    )
    .min(1),
});

export function loadJudgeLabels(): Map<string, JudgeLabels> {
  if (!existsSync(JUDGE_LABELS_PATH)) return new Map();
  const rows = readFileSync(JUDGE_LABELS_PATH, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JudgeLabels);
  return new Map(rows.map((row) => [row.id, row]));
}

interface PooledJob {
  id: number;
  hash: string;
  text: string;
}

/** The pool for one query: the top 20 of each mode, with enough text to judge. */
async function poolFor(
  deps: { db: Database; embedder: ReturnType<typeof embedder> },
  query: string,
): Promise<PooledJob[]> {
  const ids = new Set<number>();
  for (const mode of MODES) {
    const { results } = await runMode(deps, mode, query);
    for (const result of results.slice(0, POOL_DEPTH)) ids.add(result.job.id);
  }

  const idList = [...ids];
  const hashes = await contentHashes(deps.db, idList);
  const rows = await deps.db.execute<
    {
      id: string | number;
      title: string;
      company: string | null;
      location: string | null;
      is_remote: boolean;
      salary_min: number | null;
      salary_max: number | null;
      salary_currency: string | null;
      description: string;
    } & Record<string, unknown>
  >(sql`
    SELECT j.id, j.title, c.name AS company, j.location, j.is_remote,
           j.salary_min, j.salary_max, j.salary_currency, j.description
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.id IN ${idList}
  `);

  return rows.rows.map((row) => {
    const id = Number(row.id);
    const salary =
      row.salary_min == null && row.salary_max == null
        ? 'not stated'
        : `${row.salary_min ?? '?'}-${row.salary_max ?? '?'} ${row.salary_currency ?? ''}`.trim();
    return {
      id,
      hash: hashes.get(id) ?? '',
      text: [
        `jobId: ${id}`,
        `title: ${row.title}`,
        `company: ${row.company ?? 'unknown'}`,
        `location: ${row.location ?? 'not stated'}${row.is_remote ? ' (remote)' : ''}`,
        `salary: ${salary}`,
        `description: ${row.description.slice(0, JOB_CHARS).replace(/\s+/g, ' ')}`,
      ].join('\n'),
    };
  });
}

function buildPrompt(query: string, group: RubricGroup, jobs: PooledJob[]): string {
  return [
    'You are judging search relevance for a job search engine. Answer with JSON only.',
    '',
    rubricFor(group),
    '',
    `QUERY: ${query}`,
    '',
    `Judge all ${jobs.length} postings below. Return one verdict per jobId, every jobId exactly once:`,
    '{"judgements":[{"jobId":123,"relevant":true}]}',
    '',
    'POSTINGS:',
    jobs.map((job) => job.text).join('\n---\n'),
  ].join('\n');
}

export async function judgeQuery(
  deps: { db: Database; embedder: ReturnType<typeof embedder> },
  llm: NonNullable<ReturnType<typeof createLlmClient>>,
  query: { id: string; group: RubricGroup; query: string },
  existing: JudgeLabels | undefined,
  timeoutMs: number,
  force: boolean,
): Promise<JudgeLabels | null> {
  const pool = await poolFor(deps, query.query);
  const known =
    force || existing?.rubricVersion !== RUBRIC_VERSION
      ? new Set<string>()
      : new Set(Object.keys(existing?.labels ?? {}));
  const todo = pool.filter((job) => job.hash && !known.has(job.hash));

  if (todo.length === 0) {
    console.log(`judge: ${query.id} already judged (${pool.length} pooled)`);
    return existing ?? null;
  }

  const result = await generateValidated(
    llm,
    buildPrompt(query.query, query.group, todo),
    verdictSchema,
    timeoutMs,
  );
  if (!result.data) {
    console.error(
      `judge: ${query.id} failed after ${result.attempts} attempts (${result.error ?? 'no reason'})`,
    );
    return null;
  }

  const byId = new Map(todo.map((job) => [job.id, job.hash]));
  const labels: Record<string, boolean> = { ...(force ? {} : (existing?.labels ?? {})) };
  const answered = new Set<number>();
  for (const verdict of result.data.judgements) {
    const hash = byId.get(verdict.jobId);
    // Ignore ids the model invented, exactly as the reranker does.
    if (!hash || answered.has(verdict.jobId)) continue;
    answered.add(verdict.jobId);
    labels[hash] = verdict.relevant;
  }

  let missing = 0;
  for (const job of todo) {
    if (!answered.has(job.id)) {
      labels[job.hash] = false;
      missing += 1;
    }
  }

  const relevantCount = Object.values(labels).filter(Boolean).length;
  console.log(
    `judge: ${query.id} [${query.group}] pooled=${pool.length} judged=${todo.length} ` +
      `relevant=${relevantCount} missing=${missing}`,
  );

  return {
    id: query.id,
    model: llm.model,
    rubricVersion: RUBRIC_VERSION,
    judgedAt: new Date().toISOString(),
    labels,
    missing,
  };
}
