import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { SearchResponse } from 'shared';
import { createTestApp } from './helpers.js';

const { app, db, close } = createTestApp();

afterAll(() => close());

async function searchOnce() {
  const res = await request(app).get('/api/search').query({ q: 'kubernetes terraform' });
  return res.body as SearchResponse;
}

describe('POST /api/search/click', () => {
  it('records the clicked job on the search log row', async () => {
    const body = await searchOnce();
    const jobId = body.results[0]!.job.id;

    const res = await request(app).post('/api/search/click').send({ logId: body.logId, jobId });

    expect(res.status).toBe(204);
    const rows = await db.execute<{ clicked_job_id: string; clicked_at: Date } & Record<string, unknown>>(
      sql`SELECT clicked_job_id, clicked_at FROM search_logs WHERE id = ${body.logId}`,
    );
    expect(Number(rows.rows[0]?.clicked_job_id)).toBe(jobId);
    expect(rows.rows[0]?.clicked_at).toBeTruthy();
  });

  it('rejects a job that was not in those results', async () => {
    const body = await searchOnce();
    const absent = 999_999;

    const res = await request(app).post('/api/search/click').send({ logId: body.logId, jobId: absent });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a malformed body', async () => {
    const res = await request(app).post('/api/search/click').send({ logId: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('rate limiting', () => {
  it('answers 429 in the documented error shape once the limit is reached', async () => {
    const limited = createTestApp({ search: 2 });
    try {
      const first = await request(limited.app).get('/api/search').query({ q: 'engineer' });
      const second = await request(limited.app).get('/api/search').query({ q: 'engineer' });
      const third = await request(limited.app).get('/api/search').query({ q: 'engineer' });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('RATE_LIMITED');
      expect(third.body.requestId).toBeTruthy();
    } finally {
      await limited.close();
    }
  });
});
