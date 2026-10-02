// Process entry point: parse the environment, open the pool, listen, shut down cleanly.
import { createDb } from 'db';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { getEmbedder } from './services/embeddings.js';

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const app = createApp({ db, env });

const server = app.listen(env.PORT, () => {
  console.log(`api: listening on http://localhost:${env.PORT}`);
  // Printed so a misconfigured allowlist can be read off the host's log instead of guessed at from outside.
  console.log(`api: CORS allowlist ${JSON.stringify(env.CORS_ORIGINS)}`);
});

// Load the embedding model now so the first search is not the one that pays for it (ARCHITECTURE 7.2).
void getEmbedder(env.EMBEDDING_MODEL)
  .warm()
  .then(() => console.log(`api: embedding model ready (${env.EMBEDDING_MODEL})`))
  .catch((error: unknown) => console.error('api: embedding model failed to load', error));

async function shutdown(signal: string) {
  console.log(`api: ${signal} received, shutting down`);
  server.close(async () => {
    await close();
    process.exit(0);
  });
  // Do not wait forever for open connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
