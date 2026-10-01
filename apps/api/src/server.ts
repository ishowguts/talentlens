// Process entry point: parse the environment, open the pool, listen, shut down cleanly.
import { createDb } from 'db';
import { createApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const app = createApp({ db, env });

const server = app.listen(env.PORT, () => {
  console.log(`api: listening on http://localhost:${env.PORT}`);
});

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
