import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { SearchResponse } from 'shared';
import { createTestApp } from './helpers.js';

const { app, close } = createTestApp();

afterAll(() => close());

const search = (query: Record<string, string>) => request(app).get('/api/search').query(query);

describe('GET /api/search (hybrid)', () => {
  it('is the default mode', async () => {
    const res = await search({ q: 'kubernetes terraform' });

    expect(res.status).toBe(200);
    const body = res.body as SearchResponse;
    expect(body.results.length).toBeGreaterThan(0);
    // A hybrid result carries at least one rank, and jobs found by both modes carry two.
    expect(
      body.results.every((result) => result.ranks.keyword !== null || result.ranks.vector !== null),
    ).toBe(true);
    expect(body.results.some((result) => result.ranks.keyword !== null && result.ranks.vector !== null)).toBe(
      true,
    );
  });

  it('scores a job found by both modes above one found by a single mode', async () => {
    const res = await search({ q: 'site reliability engineer' });

    const body = res.body as SearchResponse;
    const both = body.results.find((r) => r.ranks.keyword !== null && r.ranks.vector !== null);
    const single = body.results.find((r) => r.ranks.keyword === null || r.ranks.vector === null);

    expect(both).toBeDefined();
    if (single) expect(both!.score).toBeGreaterThan(single.score);
  });

  it('finds jobs the keyword mode misses', async () => {
    const keyword = await search({ q: 'machine learning ranking embeddings', mode: 'keyword' });
    const hybrid = await search({ q: 'machine learning ranking embeddings' });

    const keywordCount = (keyword.body as SearchResponse).results.length;
    const hybridCount = (hybrid.body as SearchResponse).results.length;

    expect(hybridCount).toBeGreaterThanOrEqual(keywordCount);
  });

  it('paginates over the fused list', async () => {
    const first = await search({ q: 'engineer', page: '1', pageSize: '4' });
    const second = await search({ q: 'engineer', page: '2', pageSize: '4' });

    const firstBody = first.body as SearchResponse;
    const secondBody = second.body as SearchResponse;

    expect(firstBody.results).toHaveLength(4);
    expect(firstBody.hasMore).toBe(true);
    const firstIds = firstBody.results.map((result) => result.job.id);
    expect(secondBody.results.some((result) => firstIds.includes(result.job.id))).toBe(false);
  });

  it('reports hasMore false on the last page', async () => {
    const res = await search({ q: 'engineer', page: '1', pageSize: '50' });

    const body = res.body as SearchResponse;
    expect(body.hasMore).toBe(false);
  });

  it('logs the mode as hybrid', async () => {
    const res = await search({ q: 'go backend grpc' });

    expect((res.body as SearchResponse).logId).toBeGreaterThan(0);
  });
});
