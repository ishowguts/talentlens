// Search request and response contracts. See docs/ARCHITECTURE.md section 6.
import { z } from 'zod';

export const SEARCH_MODES = ['hybrid', 'vector', 'keyword'] as const;
export const searchModeSchema = z.enum(SEARCH_MODES);
export type SearchMode = z.infer<typeof searchModeSchema>;

/** Query string for `GET /api/search`. Values arrive as strings, so numbers and booleans are coerced. */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  mode: searchModeSchema.default('hybrid'),
  remote: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .optional(),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** The filters every mode shares. */
export type SearchFilters = Pick<SearchQuery, 'remote' | 'country' | 'salaryMin'>;

export const jobSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  isRemote: z.boolean(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),
  postedAt: z.string().nullable(),
  snippet: z.string(),
});

export type JobSummary = z.infer<typeof jobSummarySchema>;

export const jobSchema = jobSummarySchema.extend({
  description: z.string(),
  country: z.string().nullable(),
  source: z.enum(['remotive', 'adzuna']),
  url: z.string(),
});

export type Job = z.infer<typeof jobSchema>;

export const searchResultSchema = z.object({
  job: jobSummarySchema,
  score: z.number(),
  ranks: z.object({
    keyword: z.number().nullable(),
    vector: z.number().nullable(),
  }),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  page: z.number(),
  pageSize: z.number(),
  hasMore: z.boolean(),
  logId: z.number(),
  latencyMs: z.number(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const statsSchema = z.object({
  jobs: z.number(),
  embedded: z.number(),
  bySource: z.object({
    remotive: z.number(),
    adzuna: z.number(),
  }),
  lastIngestAt: z.string().nullable(),
});

export type Stats = z.infer<typeof statsSchema>;

export const searchClickSchema = z.object({
  logId: z.number().int().positive(),
  jobId: z.number().int().positive(),
});

export type SearchClick = z.infer<typeof searchClickSchema>;
