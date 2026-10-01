// Remotive source client. See docs/ARCHITECTURE.md section 7.1.
// Remotive's terms ask for a link back to the original posting and credit to Remotive, and for only a few
// requests a day: the job url is stored and the UI shows "via Remotive".
import { z } from 'zod';
import { stripHtml } from '../lib/text.js';
import { detectRemote, parseDate, parseSalary, toIso2Country } from './normalize.js';
import type { FetchResult, NormalizedJob } from './types.js';

export const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';

/** One item in Remotive's `jobs` array. Unused fields are ignored on purpose. */
const remotiveJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  url: z.string().url(),
  title: z.string().min(1),
  company_name: z.string().min(1),
  publication_date: z.string().optional().nullable(),
  candidate_required_location: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  description: z.string().min(1),
});

const remotiveEnvelopeSchema = z.object({
  jobs: z.array(z.unknown()),
});

export type RemotiveJob = z.infer<typeof remotiveJobSchema>;

/** Map one validated Remotive item. Every Remotive posting is remote by definition. */
export function mapRemotiveJob(raw: RemotiveJob): NormalizedJob {
  const location = raw.candidate_required_location?.trim() || null;
  const salary = parseSalary(raw.salary);
  return {
    title: raw.title.trim(),
    company: raw.company_name.trim(),
    description: stripHtml(raw.description),
    location,
    country: toIso2Country(location),
    isRemote: detectRemote(location, true),
    salaryMin: salary?.min ?? null,
    salaryMax: salary?.max ?? null,
    salaryCurrency: salary?.currency ?? null,
    postedAt: parseDate(raw.publication_date),
    source: 'remotive',
    sourceId: String(raw.id),
    url: raw.url,
  };
}

/**
 * Validate a Remotive response and map it. Items that fail their schema, or that map to an empty
 * description, are counted in `skipped` and dropped; a malformed item never aborts the batch.
 */
export function mapRemotivePayload(payload: unknown, limit?: number): FetchResult {
  const envelope = remotiveEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new Error('remotive: unexpected response shape (no jobs array)');
  }

  const jobs: NormalizedJob[] = [];
  let skipped = 0;

  for (const item of envelope.data.jobs) {
    if (limit !== undefined && jobs.length >= limit) break;
    const parsed = remotiveJobSchema.safeParse(item);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const job = mapRemotiveJob(parsed.data);
    if (!job.description) {
      skipped += 1;
      continue;
    }
    jobs.push(job);
  }

  return { jobs, skipped };
}

export interface RemotiveFetchOptions {
  limit?: number;
  /** Injected in tests so the suite never touches the network. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export async function fetchRemotiveJobs(options: RemotiveFetchOptions = {}): Promise<FetchResult> {
  const { limit, fetchImpl = fetch, baseUrl = REMOTIVE_URL } = options;
  const url = new URL(baseUrl);
  if (limit !== undefined) url.searchParams.set('limit', String(limit));

  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`remotive: ${response.status} ${response.statusText}`);
  }
  return mapRemotivePayload(await response.json(), limit);
}
