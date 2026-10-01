import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { SearchResponse } from 'shared';
import { createTestApp } from './helpers.js';

const { app, db, close } = createTestApp();

afterAll(() => close());

const vectorSearch = (query: Record<string, string>) =>
  request(app)
    .get('/api/search')
    .query({ mode: 'vector', ...query });

describe('GET /api/search?mode=vector', () => {
  it('ranks jobs about the query above unrelated ones', async () => {
    const res = await vectorSearch({ q: 'react typescript web interfaces' });

    expect(res.status).toBe(200);
    const body = res.body as SearchResponse;
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0]?.ranks.vector).toBe(1);
    expect(body.results[0]?.ranks.keyword).toBeNull();
    expect(body.results[0]?.job.title.toLowerCase()).toMatch(/react|frontend/);

    const bakerPosition = body.results.findIndex((result) => result.job.title === 'Baker');
    expect(bakerPosition === -1 || bakerPosition > 3).toBe(true);
  });

  it('returns a job summary with a snippet and no HTML', async () => {
    const res = await vectorSearch({ q: 'python data pipelines' });

    const job = (res.body as SearchResponse).results[0]?.job;
    expect(job).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      company: expect.any(String),
      isRemote: expect.any(Boolean),
    });
    expect(job?.snippet.length).toBeGreaterThan(0);
  });

  it('applies the remote, country and salary filters', async () => {
    const remote = await vectorSearch({ q: 'engineer', remote: 'true' });
    const country = await vectorSearch({ q: 'engineer', country: 'de' });
    const salary = await vectorSearch({ q: 'engineer', salaryMin: '140000' });

    const remoteBody = remote.body as SearchResponse;
    const countryBody = country.body as SearchResponse;
    const salaryBody = salary.body as SearchResponse;

    expect(remoteBody.results.length).toBeGreaterThan(0);
    expect(remoteBody.results.every((result) => result.job.isRemote)).toBe(true);
    expect(countryBody.results.length).toBeGreaterThan(0);
    expect(countryBody.results.every((result) => result.job.company === 'Vertex Mind')).toBe(true);
    expect(salaryBody.results.every((result) => (result.job.salaryMax ?? 0) >= 140_000)).toBe(true);
  });

  it('paginates', async () => {
    const first = await vectorSearch({ q: 'engineer', page: '1', pageSize: '5' });
    const second = await vectorSearch({ q: 'engineer', page: '2', pageSize: '5' });

    const firstBody = first.body as SearchResponse;
    const secondBody = second.body as SearchResponse;

    expect(firstBody.results).toHaveLength(5);
    expect(firstBody.hasMore).toBe(true);
    expect(firstBody.pageSize).toBe(5);
    expect(secondBody.page).toBe(2);
    const firstIds = firstBody.results.map((result) => result.job.id);
    expect(secondBody.results.some((result) => firstIds.includes(result.job.id))).toBe(false);
  });

  it('writes a search log row and returns its id', async () => {
    const res = await vectorSearch({ q: 'kubernetes terraform' });

    const body = res.body as SearchResponse;
    expect(body.logId).toBeGreaterThan(0);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);

    const rows = await db.execute<
      { query: string; mode: string; result_ids: string[] } & Record<string, unknown>
    >(sql`SELECT query, mode, result_ids FROM search_logs WHERE id = ${body.logId}`);
    expect(rows.rows[0]?.query).toBe('kubernetes terraform');
    expect(rows.rows[0]?.mode).toBe('vector');
    expect(rows.rows[0]?.result_ids.length).toBe(body.results.length);
  });

  it('rejects a missing query with 400 in the error shape', async () => {
    const res = await request(app).get('/api/search').query({ mode: 'vector' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.requestId).toBeTruthy();
  });

  it('rejects an out-of-range page size', async () => {
    const res = await vectorSearch({ q: 'engineer', pageSize: '500' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
