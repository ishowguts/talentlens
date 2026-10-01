// Per-IP rate limits from docs/ARCHITECTURE.md section 6. In-memory store: one API instance for now; a shared
// store (Redis) is needed once there is more than one (section 13).
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { ApiError } from '../lib/ApiError.js';

export interface RateLimits {
  /** Requests per minute for `GET /api/search`. */
  search: number;
  /** Requests per minute for `POST /api/match`. */
  match: number;
  /** Requests per minute for `POST /api/jobs/score`. */
  score: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = { search: 60, match: 5, score: 10 };

/** A limiter that fails with the documented RATE_LIMITED error instead of express-rate-limit's default body. */
export function createRateLimiter(max: number, windowMs = 60_000): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new ApiError('RATE_LIMITED', `Too many requests. Limit is ${max} per ${windowMs / 1000}s.`));
    },
  });
}
