/** A job from any source, normalized and ready to upsert. See docs/ARCHITECTURE.md section 7.1. */
export interface NormalizedJob {
  title: string;
  company: string;
  /** Plain text, HTML stripped. */
  description: string;
  location: string | null;
  /** ISO-3166 alpha-2 when it could be determined. */
  country: string | null;
  isRemote: boolean;
  /** Annual figures in `salaryCurrency`. */
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date | null;
  source: 'remotive' | 'adzuna';
  sourceId: string;
  url: string;
}

/** What a source client returns: the jobs it could map, and how many items it had to drop. */
export interface FetchResult {
  jobs: NormalizedJob[];
  /** Items that failed their schema or produced no usable job. */
  skipped: number;
}
