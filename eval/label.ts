// Interactive labeling. Pools the top 20 from each mode (TREC-style pooling), shuffles the pool, and asks for
// one y/n judgement per job. Only the owner labels; this tool never guesses. See ARCHITECTURE section 8.
// Usage: pnpm --filter eval label [--query q07] [--only-unlabeled]
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  contentHashes,
  embedder,
  loadQueries,
  MODES,
  openDatabase,
  runMode,
  saveQueries,
  type EvalQuery,
} from './lib.js';

/** Depth of the pool taken from each mode. */
const POOL_DEPTH = 20;

const only = process.argv.includes('--only-unlabeled');
const queryIndex = process.argv.indexOf('--query');
const requestedId = queryIndex === -1 ? undefined : process.argv[queryIndex + 1];

const { db, close } = openDatabase();
const deps = { db, embedder: embedder() };
const rl = createInterface({ input: stdin, output: stdout });

/** Deterministic shuffle is not wanted here: the order must not hint at which mode found a job. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

async function labelQuery(query: EvalQuery): Promise<boolean> {
  const pool = new Map<number, { title: string; company: string; location: string | null }>();
  for (const mode of MODES) {
    const { results } = await runMode(deps, mode, query.query);
    for (const result of results.slice(0, POOL_DEPTH)) {
      pool.set(result.job.id, {
        title: result.job.title,
        company: result.job.company,
        location: result.job.location,
      });
    }
  }

  const ids = shuffle([...pool.keys()]);
  const hashes = await contentHashes(db, ids);
  const alreadyRelevant = new Set(query.relevant);
  const relevant = new Set(query.relevant);

  console.log(`\n=== ${query.id} [${query.group}] "${query.query}"`);
  console.log(
    `${ids.length} jobs pooled from ${MODES.length} modes. y = relevant, n = not, s = skip, q = stop.`,
  );

  for (const [index, id] of ids.entries()) {
    const job = pool.get(id)!;
    const hash = hashes.get(id);
    if (!hash) continue;
    const mark = alreadyRelevant.has(hash) ? ' (already marked relevant)' : '';
    const answer = (
      await rl.question(
        `[${index + 1}/${ids.length}] ${job.title} — ${job.company}${job.location ? ` — ${job.location}` : ''}${mark}\n  relevant? [y/n/s/q] `,
      )
    )
      .trim()
      .toLowerCase();

    if (answer === 'q') {
      query.relevant = [...relevant];
      return false;
    }
    if (answer === 'y') relevant.add(hash);
    else if (answer === 'n') relevant.delete(hash);
  }

  query.relevant = [...relevant];
  return true;
}

try {
  const queries = loadQueries();
  const todo = queries.filter(
    (query) => (!requestedId || query.id === requestedId) && (!only || query.relevant.length === 0),
  );

  if (todo.length === 0) {
    console.log('label: nothing to do for that selection.');
  }

  for (const query of todo) {
    const finished = await labelQuery(query);
    saveQueries(queries);
    console.log(`label: saved ${query.id} with ${query.relevant.length} relevant jobs.`);
    if (!finished) {
      console.log('label: stopped. Re-run to continue where you left off.');
      break;
    }
  }
} finally {
  rl.close();
  await close();
}
