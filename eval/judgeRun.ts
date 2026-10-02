// CLI for the automated relevance judge. See eval/judge.ts.
// Usage: pnpm --filter eval judge [--query q07] [--force]
import { createLlmClient } from 'api/services/llm';
import { embedder, loadQueries, openDatabase } from './lib.js';
import { JUDGE_LABELS_PATH, judgeQuery, loadJudgeLabels, type JudgeLabels } from './judge.js';
import { writeFileSync } from 'node:fs';
import type { RubricGroup } from './rubric.js';

/**
 * The free Gemini tier allows 5 requests per minute for this model, and a burst of parallel calls fails the
 * whole batch with 429. Requests are therefore serialized with a minimum spacing, and a query that still fails
 * is retried a few times with a longer wait.
 */
const MIN_REQUEST_INTERVAL_MS = 13_000;
const QUERY_ATTEMPTS = 3;
const RETRY_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wraps the client so every call, including the retry inside generateValidated, respects the spacing. */
function paced<
  T extends { model: string; generateJson: (prompt: string, timeoutMs: number) => Promise<string> },
>(client: T): T {
  let nextAllowedAt = 0;
  return {
    ...client,
    async generateJson(prompt: string, timeoutMs: number) {
      const wait = nextAllowedAt - Date.now();
      if (wait > 0) await sleep(wait);
      nextAllowedAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
      return client.generateJson(prompt, timeoutMs);
    },
  };
}

const queryIndex = process.argv.indexOf('--query');
const only = queryIndex === -1 ? undefined : process.argv[queryIndex + 1];
const force = process.argv.includes('--force');

const llm = createLlmClient(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL);
if (!llm) {
  console.error('judge: GEMINI_API_KEY and GEMINI_MODEL must both be set in .env');
  process.exit(1);
}

const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15_000);
const { db, close } = openDatabase();
const deps = { db, embedder: embedder() };
const stored = loadJudgeLabels();

function save(): void {
  const ordered = [...stored.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(JUDGE_LABELS_PATH, `${ordered.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

try {
  await deps.embedder.warm();
  const queries = loadQueries().filter((query) => !only || query.id === only);
  const pacedLlm = paced(llm);
  const failures: string[] = [];

  for (const query of queries) {
    let result: JudgeLabels | null = null;
    for (let attempt = 1; attempt <= QUERY_ATTEMPTS && !result; attempt += 1) {
      if (attempt > 1) {
        console.log(`judge: ${query.id} retrying (attempt ${attempt} of ${QUERY_ATTEMPTS})`);
        await sleep(RETRY_WAIT_MS);
      }
      result = await judgeQuery(
        deps,
        pacedLlm,
        { id: query.id, group: query.group as RubricGroup, query: query.query },
        stored.get(query.id),
        timeoutMs,
        force,
      );
    }
    if (result) stored.set(query.id, result);
    else failures.push(query.id);
    // Save after every query so an interrupted run keeps what it paid for.
    save();
  }

  const failed = failures.length;
  if (failed > 0) console.error(`judge: failed queries: ${failures.join(', ')}`);

  const total = [...stored.values()].reduce((sum, row) => sum + Object.keys(row.labels).length, 0);
  const relevant = [...stored.values()].reduce(
    (sum, row) => sum + Object.values(row.labels).filter(Boolean).length,
    0,
  );
  console.log(
    `\njudge: ${stored.size} queries labeled, ${total} judgements, ${relevant} relevant, ${failed} queries failed`,
  );
  console.log(`judge: wrote ${JUDGE_LABELS_PATH}`);
} finally {
  await close();
}
