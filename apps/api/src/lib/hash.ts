import { createHash } from 'node:crypto';
import { normalizeCompanyName } from '../ingest/normalize.js';
import type { NormalizedJob } from '../ingest/types.js';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * The dedupe key from ARCHITECTURE section 7.1 step 3:
 * sha256 of lower(title) | lower(company_norm) | lower(location) | first 2000 chars of lower(description).
 * The same posting coming from both sources collapses to one row.
 */
export function jobContentHash(
  job: Pick<NormalizedJob, 'title' | 'company' | 'location' | 'description'>,
): string {
  const parts = [
    job.title.toLowerCase().trim(),
    normalizeCompanyName(job.company),
    (job.location ?? '').toLowerCase().trim(),
    job.description.toLowerCase().slice(0, 2000),
  ];
  return sha256(parts.join('|'));
}

/** Resume dedupe key: sha256 of the normalized resume text. */
export function resumeTextHash(text: string): string {
  return sha256(text.replace(/\s+/g, ' ').trim().toLowerCase());
}
