import { createDb } from 'db';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/env.js';
import { fakeEmbedder } from './fakeEmbedder.js';

/** The test database connection string. Tests never touch the development database. */
export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is not set; tests need the talentlens_test database');
  return url;
}

/** An app wired to the test database and the deterministic test embedder. Call `close()` when done. */
export function createTestApp() {
  const env = parseEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    LOG_LEVEL: 'silent',
  });
  const { db, close } = createDb(env.DATABASE_URL);
  return { app: createApp({ db, env, embedder: fakeEmbedder }), db, env, close };
}
