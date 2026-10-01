// Adzuna source client. See docs/ARCHITECTURE.md section 7.1.
// Adzuna returns a truncated description snippet and a redirect url; both are stored as they arrive.
import { z } from 'zod';
import { stripHtml } from '../lib/text.js';
import { detectRemote, parseDate } from './normalize.js';
import type { FetchResult, NormalizedJob } from './types.js';

export const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

/** Adzuna reports salaries in the currency of the country endpoint. */
const COUNTRY_CURRENCY: Record<string, string> = {
  gb: 'GBP',
  us: 'USD',
  in: 'INR',
  au: 'AUD',
  ca: 'CAD',
  nz: 'NZD',
  sg: 'SGD',
  za: 'ZAR',
  ch: 'CHF',
  pl: 'PLN',
  br: 'BRL',
  mx: 'MXN',
  de: 'EUR',
  fr: 'EUR',
  nl: 'EUR',
  at: 'EUR',
  be: 'EUR',
  it: 'EUR',
  es: 'EUR',
};

/** The search terms the corpus is built from. Fixed so ingestion is reproducible. */
export const ADZUNA_TERMS = [
  'software engineer',
  'frontend developer',
  'backend developer',
  'full stack developer',
  'python developer',
  'java developer',
  'javascript developer',
  'react developer',
  'node js developer',
  'golang developer',
  'data engineer',
  'data scientist',
  'machine learning engineer',
  'devops engineer',
  'site reliability engineer',
  'cloud engineer',
  'platform engineer',
  'security engineer',
  'qa engineer',
  'mobile developer',
  'android developer',
  'ios developer',
  'database administrator',
  'product manager',
  'ui ux designer',
] as const;

const adzunaJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  description: z.string().min(1),
  redirect_url: z.string().url(),
  created: z.string().optional().nullable(),
  salary_min: z.number().optional().nullable(),
  salary_max: z.number().optional().nullable(),
  salary_is_predicted: z.union([z.string(), z.number()]).optional().nullable(),
  contract_time: z.string().optional().nullable(),
  location: z
    .object({
      display_name: z.string().optional().nullable(),
      area: z.array(z.string()).optional().nullable(),
    })
    .optional()
    .nullable(),
  company: z
    .object({
      display_name: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const adzunaEnvelopeSchema = z.object({
  results: z.array(z.unknown()),
});

export type AdzunaJob = z.infer<typeof adzunaJobSchema>;

/** Map one validated Adzuna item for the given country endpoint (lower-case ISO-2). */
export function mapAdzunaJob(raw: AdzunaJob, country: string): NormalizedJob {
  const location = raw.location?.display_name?.trim() || null;
  // Predicted salaries are Adzuna's own estimate, not what the advert says, so they are dropped (ADR-010).
  const predicted = String(raw.salary_is_predicted ?? '0') === '1';
  const currency = COUNTRY_CURRENCY[country.toLowerCase()] ?? null;
  const description = stripHtml(raw.description);

  return {
    title: raw.title.trim(),
    company: raw.company?.display_name?.trim() || 'Unknown',
    description,
    location,
    country: country.toUpperCase(),
    isRemote: detectRemote(`${location ?? ''} ${raw.title}`),
    salaryMin: predicted || raw.salary_min == null ? null : Math.round(raw.salary_min),
    salaryMax: predicted || raw.salary_max == null ? null : Math.round(raw.salary_max),
    salaryCurrency: predicted || (raw.salary_min == null && raw.salary_max == null) ? null : currency,
    postedAt: parseDate(raw.created),
    source: 'adzuna',
    sourceId: String(raw.id),
    url: raw.redirect_url,
  };
}

/** Validate one page and map it. Malformed items are counted, not thrown. */
export function mapAdzunaPage(payload: unknown, country: string): FetchResult {
  const envelope = adzunaEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new Error('adzuna: unexpected response shape (no results array)');
  }

  const jobs: NormalizedJob[] = [];
  let skipped = 0;

  for (const item of envelope.data.results) {
    const parsed = adzunaJobSchema.safeParse(item);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const job = mapAdzunaJob(parsed.data, country);
    if (!job.description) {
      skipped += 1;
      continue;
    }
    jobs.push(job);
  }

  return { jobs, skipped };
}

export interface AdzunaFetchOptions {
  appId: string;
  appKey: string;
  /** Lower-case ISO-2 country endpoints, e.g. `['in','gb','us']`. */
  countries: string[];
  terms?: readonly string[];
  resultsPerPage?: number;
  maxPages?: number;
  /** Stop once this many jobs have been collected. */
  limit?: number;
  /** Delay between requests. Adzuna's free tier is a small daily quota, so stay polite. */
  delayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  onPage?: (info: { country: string; term: string; page: number; got: number }) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function adzunaPageUrl(
  country: string,
  page: number,
  options: { appId: string; appKey: string; term: string; resultsPerPage: number; baseUrl?: string },
): URL {
  const url = new URL(`${options.baseUrl ?? ADZUNA_BASE_URL}/${country}/search/${page}`);
  url.searchParams.set('app_id', options.appId);
  url.searchParams.set('app_key', options.appKey);
  url.searchParams.set('results_per_page', String(options.resultsPerPage));
  url.searchParams.set('what', options.term);
  url.searchParams.set('content-type', 'application/json');
  return url;
}

/**
 * Fetch country × term × page, stopping at `limit` or when a page comes back short.
 * A failed page is counted and skipped so one bad request does not end the run.
 */
export async function fetchAdzunaJobs(options: AdzunaFetchOptions): Promise<FetchResult> {
  const {
    appId,
    appKey,
    countries,
    terms = ADZUNA_TERMS,
    resultsPerPage = 50,
    maxPages = 2,
    limit,
    delayMs = 1_200,
    fetchImpl = fetch,
    sleepImpl = defaultSleep,
    onPage,
  } = options;

  const jobs: NormalizedJob[] = [];
  let skipped = 0;
  let first = true;

  for (const country of countries) {
    for (const term of terms) {
      for (let page = 1; page <= maxPages; page += 1) {
        if (limit !== undefined && jobs.length >= limit) return { jobs, skipped };

        if (!first && delayMs > 0) await sleepImpl(delayMs);
        first = false;

        const url = adzunaPageUrl(country, page, { appId, appKey, term, resultsPerPage });
        let pageResult: FetchResult;
        try {
          const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
          if (!response.ok) throw new Error(`adzuna: ${response.status} ${response.statusText}`);
          pageResult = mapAdzunaPage(await response.json(), country);
        } catch {
          skipped += 1;
          break;
        }

        skipped += pageResult.skipped;
        const room = limit === undefined ? pageResult.jobs.length : Math.max(0, limit - jobs.length);
        jobs.push(...pageResult.jobs.slice(0, room));
        onPage?.({ country, term, page, got: pageResult.jobs.length });

        // A short page means there is nothing more for this term.
        if (pageResult.jobs.length + pageResult.skipped < resultsPerPage) break;
      }
    }
  }

  return { jobs, skipped };
}
