// Environment parsing. Every variable is documented in docs/ARCHITECTURE.md section 9.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../../.env'), quiet: true });

const csv = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000').transform(csv),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  EMBEDDING_MODEL: z.string().min(1).default('Xenova/all-MiniLM-L6-v2'),
  // The LLM is optional: without a key and a model the reranker and the scorer notes fall back (ADR-008).
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  ADZUNA_APP_ID: z.string().min(1).optional(),
  ADZUNA_APP_KEY: z.string().min(1).optional(),
  ADZUNA_COUNTRIES: z.string().default('in,gb,us').transform(csv),
});

export type Env = z.infer<typeof envSchema>;

/** Parse a raw environment. Throws a ZodError when something required is missing or malformed. */
export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(raw);
}

/** Parse `process.env` or exit with a readable message. Used on boot. */
export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    console.error(`Invalid environment:\n${lines.join('\n')}\n\nCopy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return result.data;
}
