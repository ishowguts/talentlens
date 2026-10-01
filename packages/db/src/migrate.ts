// Applies every pending migration, then exits.
// Usage: pnpm --filter db migrate            (uses DATABASE_URL)
//        pnpm --filter db migrate --test     (uses DATABASE_URL_TEST)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { runMigrations } from './migrator.js';
import { assertPostgresUrl } from './url.js';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../../.env'), quiet: true });

const envVar = process.argv.includes('--test') ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
const connectionString = process.env[envVar];

if (!connectionString) {
  console.error(`migrate: ${envVar} is not set. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

let host: string;
try {
  host = assertPostgresUrl(connectionString, envVar);
} catch (error) {
  console.error(`migrate: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
console.log(`migrate: connecting to ${host}`);

await runMigrations(connectionString);
console.log(`migrate: up to date (${envVar})`);
