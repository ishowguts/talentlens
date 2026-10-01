import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { fetchRemotiveJobs, mapRemotivePayload } from '../src/ingest/remotive.js';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const payload = JSON.parse(readFileSync(path.join(fixtureDir, 'remotive.json'), 'utf8')) as unknown;

describe('mapRemotivePayload', () => {
  it('maps valid items and counts the malformed ones', () => {
    const { jobs, skipped } = mapRemotivePayload(payload);

    expect(jobs).toHaveLength(3);
    expect(skipped).toBe(2);
  });

  it('normalizes a job to the shape the database expects', () => {
    const { jobs } = mapRemotivePayload(payload);
    const job = jobs[0]!;

    expect(job.source).toBe('remotive');
    expect(job.sourceId).toMatch(/^\d+$/);
    expect(job.isRemote).toBe(true);
    expect(job.url).toMatch(/^https:\/\//);
    expect(job.description).not.toMatch(/<[a-z]/i);
    expect(job.postedAt).toBeInstanceOf(Date);
  });

  it('parses an annual salary range and an hourly rate', () => {
    const { jobs } = mapRemotivePayload(payload);
    const annual = jobs.find((job) => job.salaryMin === 90_000);
    const hourly = jobs.find((job) => job.salaryMin === 90 * 2080);

    expect(annual).toMatchObject({ salaryMin: 90_000, salaryMax: 105_000, salaryCurrency: 'USD' });
    expect(hourly).toMatchObject({ salaryMin: 187_200, salaryMax: 312_000, salaryCurrency: 'USD' });
  });

  it('leaves the country null for a multi-region location', () => {
    const { jobs } = mapRemotivePayload(payload);
    const multiRegion = jobs.find((job) => job.location?.includes(','));
    const singleCountry = jobs.find((job) => job.location === 'USA');

    expect(multiRegion?.country).toBeNull();
    expect(singleCountry?.country).toBe('US');
  });

  it('respects a limit', () => {
    expect(mapRemotivePayload(payload, 1).jobs).toHaveLength(1);
  });

  it('throws when the response has no jobs array', () => {
    expect(() => mapRemotivePayload({ error: 'nope' })).toThrow(/jobs array/);
  });
});

describe('fetchRemotiveJobs', () => {
  it('passes the limit and maps the response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload), { status: 200 }));

    const result = await fetchRemotiveJobs({ limit: 2, fetchImpl });

    expect(result.jobs).toHaveLength(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('limit=2');
  });

  it('throws on a failed request', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
    );

    await expect(fetchRemotiveJobs({ fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(
      /503/,
    );
  });
});
