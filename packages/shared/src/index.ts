export * from './search.js';
export * from './match.js';

// Contracts shared by the API and the web app. See docs/ARCHITECTURE.md section 6.

/** Error codes the API can return, with the HTTP status each one maps to. */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** The body of every failed API response. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
}
