import { ERROR_STATUS, type ErrorCode } from 'shared';

/** An error with an API error code. Anything else reaching the error middleware becomes INTERNAL. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }

  static notFound(message = 'Not found', details?: unknown) {
    return new ApiError('NOT_FOUND', message, details);
  }

  static validation(message = 'Invalid request', details?: unknown) {
    return new ApiError('VALIDATION_ERROR', message, details);
  }
}
