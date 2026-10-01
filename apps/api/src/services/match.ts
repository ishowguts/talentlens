// Resume matching. See docs/ARCHITECTURE.md section 7.4.
import { eq, sql } from 'drizzle-orm';
import type { Database } from 'db';
import { matches, resumes } from 'db';
import {
  MATCH_RESULT_COUNT,
  rerankResponseSchema,
  type MatchResponse,
  type MatchResult,
  type JobSummary,
} from 'shared';
import { resumeTextHash } from '../lib/hash.js';
import { snippet } from '../lib/text.js';
import { embedResume, type Embedder } from './embeddings.js';
import { generateValidated, type LlmClient } from './llm.js';

/** Jobs retrieved by vector search before the rerank. */
const RERANK_CANDIDATES = 20;
/** How much of the resume and of each job the model sees. */
const RESUME_PROMPT_CHARS = 6_000;
const JOB_PROMPT_CHARS = 800;

export interface MatchDeps {
  db: Database;
  embedder: Embedder;
  /** Null when no model is configured; results are then vector-ordered with `reranked: false`. */
  llm: LlmClient | null;
  llmTimeoutMs: number;
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
  posted_at: Date | string | null;
  description: string;
  distance: number;
}

interface Candidate {
  job: JobSummary;
  description: string;
  vectorScore: number;
}

function toJobSummary(row: CandidateRow): JobSummary {
  return {
    id: Number(row.id),
    title: row.title,
    company: row.company ?? 'Unknown',
    location: row.location,
    isRemote: row.is_remote,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryCurrency: row.salary_currency,
    postedAt: row.posted_at ? new Date(row.posted_at).toISOString() : null,
    snippet: snippet(row.description),
  };
}

/** Nearest jobs to the resume vector, no filters (section 7.4 step 4). */
async function vectorCandidates(db: Database, vector: Float32Array): Promise<Candidate[]> {
  const literal = `[${Array.from(vector).join(',')}]`;
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL hnsw.ef_search = 100`);
    return tx.execute<CandidateRow>(sql`
      SELECT j.id, j.title, c.name AS company, j.location, j.is_remote,
             j.salary_min, j.salary_max, j.salary_currency, j.posted_at, j.description,
             (e.embedding <=> ${literal}::vector) AS distance
      FROM job_embeddings e
      JOIN jobs j ON j.id = e.job_id
      LEFT JOIN companies c ON c.id = j.company_id
      ORDER BY e.embedding <=> ${literal}::vector
      LIMIT ${RERANK_CANDIDATES}
    `);
  });

  return rows.rows.map((row) => ({
    job: toJobSummary(row),
    description: row.description,
    vectorScore: 1 - Number(row.distance),
  }));
}

function buildRerankPrompt(resumeText: string, candidates: Candidate[]): string {
  const jobs = candidates
    .map(
      (candidate) =>
        `- jobId: ${candidate.job.id}\n  title: ${candidate.job.title}\n  company: ${candidate.job.company}\n  description: ${candidate.description.slice(0, JOB_PROMPT_CHARS).replace(/\n/g, ' ')}`,
    )
    .join('\n');

  return [
    'You rank job postings against a candidate resume.',
    `Pick the best ${MATCH_RESULT_COUNT} of the ${candidates.length} jobs below and order them best first.`,
    'Use only the jobIds listed. Do not invent a jobId.',
    'Answer with JSON only, in this shape:',
    '{"ranking":[{"jobId":123,"fitScore":0,"reasons":["..."],"missingSkills":["..."]}]}',
    'fitScore is 0-100. Give 1 to 3 short reasons grounded in the resume and the posting,',
    'and up to 5 skills the posting asks for that the resume does not show.',
    '',
    'RESUME:',
    resumeText.slice(0, RESUME_PROMPT_CHARS),
    '',
    'JOBS:',
    jobs,
  ].join('\n');
}

/** The deterministic fallback: vector order, no model output (section 7.4 step 6). */
function vectorOnly(candidates: Candidate[]): MatchResult[] {
  return candidates.slice(0, MATCH_RESULT_COUNT).map((candidate) => ({
    job: candidate.job,
    vectorScore: candidate.vectorScore,
    fitScore: null,
    reasons: [],
    missingSkills: [],
  }));
}

async function rerank(
  deps: MatchDeps,
  resumeText: string,
  candidates: Candidate[],
): Promise<MatchResult[] | null> {
  if (!deps.llm) return null;

  const result = await generateValidated(
    deps.llm,
    buildRerankPrompt(resumeText, candidates),
    rerankResponseSchema,
    deps.llmTimeoutMs,
  );
  if (!result.data) {
    console.warn(`match: rerank failed after ${result.attempts} attempts (${result.error ?? 'no reason'})`);
    return null;
  }

  const byId = new Map(candidates.map((candidate) => [candidate.job.id, candidate]));
  const seen = new Set<number>();
  const ranked: MatchResult[] = [];

  for (const item of result.data.ranking) {
    // Drop ids the model invented and ids it repeated.
    const candidate = byId.get(item.jobId);
    if (!candidate || seen.has(item.jobId)) continue;
    seen.add(item.jobId);
    ranked.push({
      job: candidate.job,
      vectorScore: candidate.vectorScore,
      fitScore: item.fitScore,
      reasons: item.reasons,
      missingSkills: item.missingSkills,
    });
    if (ranked.length === MATCH_RESULT_COUNT) break;
  }

  return ranked.length > 0 ? ranked : null;
}

async function saveMatches(
  db: Database,
  resumeId: string,
  results: MatchResult[],
  model: string | null,
): Promise<void> {
  if (results.length === 0) return;
  await db
    .insert(matches)
    .values(
      results.map((result) => ({
        resumeId,
        jobId: result.job.id,
        vectorScore: result.vectorScore,
        fitScore: result.fitScore,
        explanation: { reasons: result.reasons, missingSkills: result.missingSkills },
        model,
      })),
    )
    .onConflictDoUpdate({
      target: [matches.resumeId, matches.jobId],
      set: {
        vectorScore: sql`excluded.vector_score`,
        fitScore: sql`excluded.fit_score`,
        explanation: sql`excluded.explanation`,
        model: sql`excluded.model`,
        createdAt: sql`now()`,
      },
    });
}

/** Matches already computed for this resume, in stored order. */
async function cachedMatches(db: Database, resumeId: string): Promise<MatchResponse | null> {
  const stored = await db.select().from(matches).where(eq(matches.resumeId, resumeId));
  if (stored.length === 0) return null;

  const jobIds = stored.map((row) => row.jobId);
  const rows = await db.execute<CandidateRow>(sql`
    SELECT j.id, j.title, c.name AS company, j.location, j.is_remote,
           j.salary_min, j.salary_max, j.salary_currency, j.posted_at, j.description, 0 AS distance
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.id IN ${jobIds}
    -- Drizzle expands a JS array into a parenthesized parameter list, which is what IN needs.
  `);
  const summaries = new Map(rows.rows.map((row) => [Number(row.id), toJobSummary(row)]));

  const results: MatchResult[] = stored
    .filter((row) => summaries.has(row.jobId))
    .map((row) => {
      const explanation = (row.explanation ?? {}) as { reasons?: string[]; missingSkills?: string[] };
      return {
        job: summaries.get(row.jobId)!,
        vectorScore: row.vectorScore,
        fitScore: row.fitScore,
        reasons: explanation.reasons ?? [],
        missingSkills: explanation.missingSkills ?? [],
      };
    })
    .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1) || b.vectorScore - a.vectorScore);

  return {
    resumeId,
    reranked: results.some((result) => result.fitScore !== null),
    matches: results.slice(0, MATCH_RESULT_COUNT),
  };
}

export async function matchResume(deps: MatchDeps, resumeText: string): Promise<MatchResponse> {
  const textHash = resumeTextHash(resumeText);

  const existing = await deps.db.select().from(resumes).where(eq(resumes.textHash, textHash));
  if (existing[0]) {
    const cached = await cachedMatches(deps.db, existing[0].id);
    if (cached) return cached;
  }

  const vector = await embedResume(deps.embedder, resumeText);
  const resumeId =
    existing[0]?.id ??
    (
      await deps.db
        .insert(resumes)
        .values({ textHash, text: resumeText, embedding: Array.from(vector) })
        .onConflictDoUpdate({ target: resumes.textHash, set: { text: resumeText } })
        .returning({ id: resumes.id })
    )[0]!.id;

  const candidates = await vectorCandidates(deps.db, vector);
  if (candidates.length === 0) return { resumeId, reranked: false, matches: [] };

  const ranked = await rerank(deps, resumeText, candidates);
  const results = ranked ?? vectorOnly(candidates);
  await saveMatches(deps.db, resumeId, results, ranked ? (deps.llm?.model ?? null) : null);

  return { resumeId, reranked: ranked !== null, matches: results };
}
