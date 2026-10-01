import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { SearchResponse } from 'shared';
import { createTestApp } from './helpers.js';

const { app, close } = createTestApp();

afterAll(() => close());

const keywordSearch = (query: Record<string, string>) =>
  request(app)
    .get('/api/search')
    .query({ mode: 'keyword', ...query });

describe('GET /api/search?mode=keyword', () => {
  it('finds jobs by the words in the advert', async () => {
    const res = await keywordSearch({ q: 'kubernetes terraform' });

    expect(res.status).toBe(200);
    const body = res.body as SearchResponse;
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0]?.ranks.keyword).toBe(1);
    expect(body.results[0]?.ranks.vector).toBeNull();
    expect(body.results.every((result) => result.score >= 0)).toBe(true);
  });

  it('supports a quoted phrase', async () => {
    const loose = await keywordSearch({ q: 'site reliability' });
    const phrase = await keywordSearch({ q: '"site reliability engineer"' });

    const looseBody = loose.body as SearchResponse;
    const phraseBody = phrase.body as SearchResponse;

    expect(phraseBody.results.length).toBeGreaterThan(0);
    expect(phraseBody.results.length).toBeLessThanOrEqual(looseBody.results.length);
    expect(phraseBody.results[0]?.job.title).toBe('Site Reliability Engineer');
  });

  it('supports excluding a term', async () => {
    const withBoth = await keywordSearch({ q: 'engineer' });
    const withoutData = await keywordSearch({ q: 'engineer -data' });

    const bothIds = (withBoth.body as SearchResponse).results.map((result) => result.job.id);
    const withoutIds = (withoutData.body as SearchResponse).results.map((result) => result.job.id);

    expect(bothIds.length).toBeGreaterThan(withoutIds.length);
  });

  it('applies the same filters as the other modes', async () => {
    const res = await keywordSearch({ q: 'engineer', remote: 'true' });

    const body = res.body as SearchResponse;
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.every((result) => result.job.isRemote)).toBe(true);
  });

  it('returns an empty result set for a query that matches nothing', async () => {
    const res = await keywordSearch({ q: 'zzzzqqqq' });

    const body = res.body as SearchResponse;
    expect(body.results).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.logId).toBeGreaterThan(0);
  });

  it('rejects an empty query', async () => {
    const res = await keywordSearch({ q: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
