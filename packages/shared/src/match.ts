// Resume match contracts. See docs/ARCHITECTURE.md sections 6 and 7.4.
import { z } from 'zod';
import { jobSummarySchema } from './search.js';

export const RESUME_TEXT_MIN = 200;
export const RESUME_TEXT_MAX = 20_000;
/** Upload limit for a resume PDF, in bytes. */
export const RESUME_PDF_MAX_BYTES = 2 * 1024 * 1024;
/** How many matches the endpoint returns. */
export const MATCH_RESULT_COUNT = 10;

/** Body for `POST /api/match` when the resume is sent as JSON instead of a PDF. */
export const matchTextRequestSchema = z.object({
  text: z.string().trim().min(RESUME_TEXT_MIN).max(RESUME_TEXT_MAX),
});

export const matchResultSchema = z.object({
  job: jobSummarySchema,
  vectorScore: z.number(),
  /** 0..100 from the reranking model, or null when the rerank did not produce one. */
  fitScore: z.number().nullable(),
  reasons: z.array(z.string()),
  missingSkills: z.array(z.string()),
});

export type MatchResult = z.infer<typeof matchResultSchema>;

export const matchResponseSchema = z.object({
  resumeId: z.string(),
  /** False when the results are ordered by vector similarity alone. */
  reranked: z.boolean(),
  matches: z.array(matchResultSchema),
});

export type MatchResponse = z.infer<typeof matchResponseSchema>;

/** What the reranking model must return. Its output is untrusted input (ADR-008). */
export const rerankItemSchema = z.object({
  jobId: z.number().int(),
  fitScore: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1).max(3),
  missingSkills: z.array(z.string().min(1)).max(5),
});

export const rerankResponseSchema = z.object({
  ranking: z.array(rerankItemSchema).min(1),
});

export type RerankResponse = z.infer<typeof rerankResponseSchema>;
