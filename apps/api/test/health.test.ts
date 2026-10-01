import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';

const { app, env, close } = createTestApp();

afterAll(() => close());

describe('GET /api/health', () => {
  it('reports the database as reachable', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      db: 'ok',
      embeddingModel: env.EMBEDDING_MODEL,
    });
    expect(typeof res.body.jobs).toBe('number');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes an inbound request id', async () => {
    const res = await request(app).get('/api/health').set('x-request-id', 'test-request-id');

    expect(res.headers['x-request-id']).toBe('test-request-id');
  });
});

describe('unmatched routes', () => {
  it('answers 404 in the documented error shape', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});
