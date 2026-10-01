// Embedding backfill CLI. See docs/ARCHITECTURE.md section 7.1 step 4.
// Usage: pnpm --filter api embed [--limit N]
// A second run embeds nothing: only jobs with no vector, a stale content hash, or a vector from another model
// are selected, and the summary line reports embedded vs skipped so the cache hit rate is measurable.
import { createDb } from 'db';
import { loadEnv } from '../env.js';
import { getEmbedder } from '../services/embeddings.js';
import { backfillEmbeddings } from './embed.js';

const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex === -1 ? undefined : Number(process.argv[limitIndex + 1]);
if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  console.error('embed: --limit must be a positive integer');
  process.exit(2);
}

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const embedder = getEmbedder(env.EMBEDDING_MODEL);
const startedAt = Date.now();

try {
  const summary = await backfillEmbeddings(db, embedder, {
    limit,
    onProgress: (done) => console.log(`embed: ${done} jobs embedded`),
  });
  const seconds = (Date.now() - startedAt) / 1000;
  const perThousand = summary.embedded > 0 ? (seconds / summary.embedded) * 1000 : 0;
  console.log(
    `embed: model=${embedder.model} embedded=${summary.embedded} skipped_cached=${summary.skippedCached} ` +
      `total_jobs=${summary.totalJobs} duration=${seconds.toFixed(1)}s per_1000=${perThousand.toFixed(1)}s`,
  );
} finally {
  await close();
}
