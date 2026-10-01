// Ingestion CLI. See docs/ARCHITECTURE.md section 7.1.
// Usage: pnpm --filter api ingest [--source remotive|adzuna|all] [--limit N]
import { createDb } from 'db';
import { loadEnv } from '../env.js';
import { fetchAdzunaJobs } from './adzuna.js';
import { fetchRemotiveJobs } from './remotive.js';
import { upsertJobs } from './upsert.js';
import type { NormalizedJob } from './types.js';

const UPSERT_BATCH = 500;

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return inline?.slice(name.length + 3);
}

const sourceArg = readArg('source') ?? 'all';
if (!['all', 'remotive', 'adzuna'].includes(sourceArg)) {
  console.error(`ingest: --source must be remotive, adzuna or all (got "${sourceArg}")`);
  process.exit(2);
}

const limitArg = readArg('limit');
const limit = limitArg === undefined ? undefined : Number(limitArg);
if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  console.error(`ingest: --limit must be a positive integer (got "${limitArg}")`);
  process.exit(2);
}

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const startedAt = Date.now();

let fetched = 0;
let skipped = 0;
let inserted = 0;
let updated = 0;

async function store(jobs: NormalizedJob[]): Promise<void> {
  for (let i = 0; i < jobs.length; i += UPSERT_BATCH) {
    const summary = await upsertJobs(db, jobs.slice(i, i + UPSERT_BATCH));
    inserted += summary.inserted;
    updated += summary.updated;
  }
}

try {
  if (sourceArg === 'all' || sourceArg === 'remotive') {
    const result = await fetchRemotiveJobs({ limit });
    fetched += result.jobs.length;
    skipped += result.skipped;
    await store(result.jobs);
    console.log(`ingest: remotive fetched=${result.jobs.length} skipped=${result.skipped}`);
  }

  if (sourceArg === 'all' || sourceArg === 'adzuna') {
    if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
      console.warn('ingest: ADZUNA_APP_ID or ADZUNA_APP_KEY is not set, skipping Adzuna');
    } else {
      const remaining = limit === undefined ? undefined : Math.max(0, limit - fetched);
      const result = await fetchAdzunaJobs({
        appId: env.ADZUNA_APP_ID,
        appKey: env.ADZUNA_APP_KEY,
        countries: env.ADZUNA_COUNTRIES,
        limit: remaining,
        onPage: ({ country, term, page, got }) =>
          console.log(`ingest: adzuna ${country} "${term}" page ${page} -> ${got}`),
      });
      fetched += result.jobs.length;
      skipped += result.skipped;
      await store(result.jobs);
      console.log(`ingest: adzuna fetched=${result.jobs.length} skipped=${result.skipped}`);
    }
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `ingest: source=${sourceArg} fetched=${fetched} skipped=${skipped} inserted=${inserted} updated=${updated} duration=${seconds}s`,
  );
} finally {
  await close();
}
