// Brings the test database up to date and seeds the fixture corpus once before the suite runs.
import { createDb, runMigrations } from 'db';
import { fakeEmbedder } from './fakeEmbedder.js';
import { seedFixtureJobs } from './seed.js';
import { testDatabaseUrl } from './helpers.js';

export default async function setup() {
  const url = testDatabaseUrl();
  await runMigrations(url);
  const { db, close } = createDb(url);
  try {
    await seedFixtureJobs(db, fakeEmbedder);
  } finally {
    await close();
  }
}
