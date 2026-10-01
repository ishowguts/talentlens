import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { adzunaPageUrl, fetchAdzunaJobs, mapAdzunaPage } from '../src/ingest/adzuna.js';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const payload = JSON.parse(readFileSync(path.join(fixtureDir, 'adzuna.json'), 'utf8')) as unknown;

const jsonResponse = () => new Response(JSON.stringify(payload), { status: 200 });

describe('mapAdzunaPage', () => {
  it('maps valid items and counts the malformed ones', () => {
    const { jobs, skipped } = mapAdzunaPage(payload, 'gb');

    expect(jobs).toHaveLength(3);
    expect(skipped).toBe(2);
  });

  it('takes the country from the endpoint and the currency from it', () => {
    const [job] = mapAdzunaPage(payload, 'gb').jobs;

    expect(job).toMatchObject({
      source: 'adzuna',
      country: 'GB',
      salaryMin: 55_000,
      salaryMax: 70_000,
      salaryCurrency: 'GBP',
    });
    expect(job?.postedAt).toBeInstanceOf(Date);
  });

  it('drops a predicted salary', () => {
    const predicted = mapAdzunaPage(payload, 'gb').jobs[1];

    expect(predicted).toMatchObject({ salaryMin: null, salaryMax: null, salaryCurrency: null });
  });

  it('marks a job remote when the title says so', () => {
    const remote = mapAdzunaPage(payload, 'gb').jobs[2];

    expect(remote?.isRemote).toBe(true);
  });

  it('throws when the response has no results array', () => {
    expect(() => mapAdzunaPage({ oops: true }, 'gb')).toThrow(/results array/);
  });
});

describe('adzunaPageUrl', () => {
  it('builds the documented query', () => {
    const url = adzunaPageUrl('in', 2, {
      appId: 'id',
      appKey: 'key',
      term: 'data engineer',
      resultsPerPage: 50,
    });

    expect(url.pathname).toBe('/v1/api/jobs/in/search/2');
    expect(url.searchParams.get('what')).toBe('data engineer');
    expect(url.searchParams.get('results_per_page')).toBe('50');
    expect(url.searchParams.get('app_id')).toBe('id');
  });
});

describe('fetchAdzunaJobs', () => {
  const baseOptions = {
    appId: 'id',
    appKey: 'key',
    countries: ['gb'],
    terms: ['software engineer'] as const,
    resultsPerPage: 50,
    maxPages: 3,
    delayMs: 0,
  };

  it('respects the limit and stops requesting', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse());

    const { jobs } = await fetchAdzunaJobs({ ...baseOptions, limit: 2, fetchImpl });

    expect(jobs).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops a term when a page comes back short', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse());

    await fetchAdzunaJobs({ ...baseOptions, fetchImpl });

    // The fixture page holds 5 items against a page size of 50, so page 2 is never requested.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sleeps between requests', async () => {
    const sleepImpl = vi.fn(async () => undefined);
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse());

    await fetchAdzunaJobs({ ...baseOptions, countries: ['gb', 'in'], delayMs: 10, fetchImpl, sleepImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(10);
  });

  it('counts a failed page and moves on', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      String(input).includes('country-that-fails') ? new Response('no', { status: 500 }) : jsonResponse(),
    );

    const { jobs, skipped } = await fetchAdzunaJobs({
      ...baseOptions,
      countries: ['gb', 'country-that-fails'],
      fetchImpl,
    });

    expect(jobs).toHaveLength(3);
    expect(skipped).toBeGreaterThan(0);
  });
});
