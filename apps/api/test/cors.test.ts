import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDb } from 'db';
import { createApp } from '../src/app.js';
import { normalizeOrigin, parseEnv } from '../src/env.js';
import { fakeEmbedder } from './fakeEmbedder.js';
import { testDatabaseUrl } from './helpers.js';

const APP_ORIGIN = 'https://talentlens-silk.vercel.app';

/** An app whose allowlist is exactly `corsOrigins`, as the environment would supply it. */
function appWith(corsOrigins: string) {
  const env = parseEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: corsOrigins,
  });
  const { db, close } = createDb(env.DATABASE_URL);
  return { app: createApp({ db, env, embedder: fakeEmbedder, llm: null }), close };
}

const configured = appWith(APP_ORIGIN);
const withTrailingSlash = appWith(`${APP_ORIGIN}/`);

afterAll(async () => {
  await configured.close();
  await withTrailingSlash.close();
});

describe('normalizeOrigin', () => {
  it('strips a trailing slash, a path and the case difference', () => {
    expect(normalizeOrigin(`${APP_ORIGIN}/`)).toBe(APP_ORIGIN);
    expect(normalizeOrigin(`${APP_ORIGIN}/search`)).toBe(APP_ORIGIN);
    expect(normalizeOrigin(' HTTPS://TalentLens-Silk.Vercel.App ')).toBe(APP_ORIGIN);
  });

  it('accepts the ways a value gets pasted into a dashboard', () => {
    expect(normalizeOrigin('"https://talentlens-silk.vercel.app"')).toBe(APP_ORIGIN);
    expect(normalizeOrigin("'https://talentlens-silk.vercel.app',")).toBe(APP_ORIGIN);
    expect(normalizeOrigin('talentlens-silk.vercel.app')).toBe(APP_ORIGIN);
    expect(normalizeOrigin('talentlens-silk.vercel.app/')).toBe(APP_ORIGIN);
  });

  it('keeps http for a loopback host, where https is never served', () => {
    expect(normalizeOrigin('localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeOrigin('127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
  });
});

describe('CORS allowlist', () => {
  it('allows the configured origin', async () => {
    const res = await request(configured.app).get('/api/health').set('origin', APP_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
  });

  it('still allows it when the environment value has a trailing slash', async () => {
    // This is the misconfiguration that took the live deployment down for browsers.
    const res = await request(withTrailingSlash.app).get('/api/health').set('origin', APP_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
  });

  it('refuses an origin that is not listed', async () => {
    const res = await request(configured.app).get('/api/health').set('origin', 'https://nope.invalid');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a preflight for the configured origin', async () => {
    const res = await request(configured.app)
      .options('/api/search')
      .set('origin', APP_ORIGIN)
      .set('access-control-request-method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
  });

  it('serves a request that carries no Origin header at all', async () => {
    const res = await request(configured.app).get('/api/health');

    expect(res.status).toBe(200);
  });

  it('allows the origin when the environment value was pasted with quotes', async () => {
    const quoted = appWith(`"${APP_ORIGIN}"`);
    try {
      const res = await request(quoted.app).get('/api/health').set('origin', APP_ORIGIN);
      expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    } finally {
      await quoted.close();
    }
  });

  it('refuses to boot on an empty CORS_ORIGINS', () => {
    expect(() =>
      parseEnv({ DATABASE_URL: 'postgres://u:p@h:5432/d', CORS_ORIGINS: '' } as NodeJS.ProcessEnv),
    ).toThrow(/CORS_ORIGINS is empty/);
  });
});

describe('GET /api/health', () => {
  it('reports whether a reranking model is configured', async () => {
    const res = await request(configured.app).get('/api/health');

    expect(res.body.llm).toBe('not configured');
  });
});
