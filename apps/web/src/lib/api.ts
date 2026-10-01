// Typed API client. Request and response shapes come from packages/shared, so the two apps cannot drift.
import {
  jobSchema,
  matchResponseSchema,
  scoreResponseSchema,
  searchResponseSchema,
  type Job,
  type MatchResponse,
  type ScoreRequest,
  type ScoreResponse,
  type SearchMode,
  type SearchResponse,
} from 'shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** An error carrying the API's own error code, so a page can tell a 400 from a 429. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiRequestError(
      response.status,
      body?.error?.code ?? 'INTERNAL',
      body?.error?.message ?? `Request failed with ${response.status}`,
    );
  }

  return response.json();
}

export interface SearchParams {
  q: string;
  mode?: SearchMode;
  remote?: boolean;
  country?: string;
  salaryMin?: number;
  page?: number;
  pageSize?: number;
}

export async function searchJobs(params: SearchParams): Promise<SearchResponse> {
  const query = new URLSearchParams({ q: params.q });
  if (params.mode) query.set('mode', params.mode);
  if (params.remote) query.set('remote', 'true');
  if (params.country) query.set('country', params.country);
  if (params.salaryMin) query.set('salaryMin', String(params.salaryMin));
  if (params.page && params.page > 1) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  return searchResponseSchema.parse(await requestJson(`/search?${query.toString()}`));
}

export async function getJob(id: number): Promise<Job> {
  return jobSchema.parse(await requestJson(`/jobs/${id}`));
}

/** Match a resume, sent either as a PDF file or as pasted text. */
export async function matchResume(input: { file: File } | { text: string }): Promise<MatchResponse> {
  if ('file' in input) {
    const form = new FormData();
    form.append('file', input.file);
    return matchResponseSchema.parse(await requestJson('/match', { method: 'POST', body: form }));
  }
  return matchResponseSchema.parse(
    await requestJson('/match', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: input.text }),
    }),
  );
}

/** Score a job advert. The score is deterministic; only the title rewrite and notes come from a model. */
export async function scoreJobAd(ad: ScoreRequest): Promise<ScoreResponse> {
  return scoreResponseSchema.parse(
    await requestJson('/jobs/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ad),
    }),
  );
}

/** Fire-and-forget: a failed click log must never break opening a job. */
export function logClick(logId: number, jobId: number): void {
  void fetch(`${API_URL}/api/search/click`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ logId, jobId }),
    keepalive: true,
  }).catch(() => undefined);
}
