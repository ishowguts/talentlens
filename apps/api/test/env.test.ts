import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env.js';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('parseEnv', () => {
  it('applies the documented defaults', () => {
    const env = parseEnv({ DATABASE_URL: 'postgres://localhost/x' } as NodeJS.ProcessEnv);

    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.LLM_TIMEOUT_MS).toBe(15_000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.ADZUNA_COUNTRIES).toEqual(['in', 'gb', 'us']);
  });

  it('rejects an environment without a database url', () => {
    expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow();
  });
});

describe('server boot', () => {
  it('exits non-zero when the environment is invalid', async () => {
    const code = await new Promise<number>((resolve) => {
      const child = execFile(
        'node',
        ['--import', 'tsx', 'src/server.ts'],
        { cwd: apiRoot, env: { ...process.env, DATABASE_URL: '', PORT: '0' } },
        () => undefined,
      );
      child.on('close', (exitCode) => resolve(exitCode ?? -1));
    });

    expect(code).toBeGreaterThan(0);
  });
});
