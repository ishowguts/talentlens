// Brings the test database up to date once before the suite runs.
import { runMigrations } from 'db';
import { testDatabaseUrl } from './helpers.js';

export default async function setup() {
  await runMigrations(testDatabaseUrl());
}
