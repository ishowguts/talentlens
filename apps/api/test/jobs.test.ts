import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { jobSchema, statsSchema } from 'shared';
import { createTestApp } from './helpers.js';
import { fixtureJobId } from './seed.js';

const { app, db, close } = createTestApp();

afterAll(() => close());

describe('GET /api/jobs/:id', () => {
  it('returns the full job with its source and outbound link', async () => {
    const id = await fixtureJobId(db, 'fixture-001');

    const res = await request(app).get(`/api/jobs/${id}`);

    expect(res.status).toBe(200);
    const job = jobSchema.parse(res.body);
    expect(job.id).toBe(id);
    expect(job.title).toBe('Senior React Developer');
    expect(job.description.length).toBeGreaterThan(job.snippet.length - 1);
    expect(['remotive', 'adzuna']).toContain(job.source);
    expect(job.url).toMatch(/^https:\/\//);
  });

  it('answers 404 for a job that does not exist', async () => {
    const res = await request(app).get('/api/jobs/999999999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/jobs/not-a-number');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/stats', () => {
  it('reports corpus counts', async () => {
    const res = await request(app).get('/api/stats');

    expect(res.status).toBe(200);
    const stats = statsSchema.parse(res.body);
    expect(stats.jobs).toBe(30);
    expect(stats.embedded).toBe(30);
    expect(stats.bySource.remotive + stats.bySource.adzuna).toBe(stats.jobs);
    expect(stats.lastIngestAt).toBeTruthy();
  });
});
