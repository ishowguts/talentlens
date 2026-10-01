// Applies every pending migration in ./migrations, then exits.
// Usage: pnpm --filter db migrate            (uses DATABASE_URL)
//        pnpm --filter db migrate --test     (uses DATABASE_URL_TEST)
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../../.env'), quiet: true });

const useTest = process.argv.includes('--test');
const envVar = useTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
const connectionString = process.env[envVar];

if (!connectionString) {
  console.error(`migrate: ${envVar} is not set. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(here, '../migrations') });
  console.log(`migrate: up to date (${envVar})`);
} finally {
  await pool.end();
}
