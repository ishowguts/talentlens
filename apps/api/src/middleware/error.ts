import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode } from 'shared';
import { ERROR_STATUS } from 'shared';
import { ApiError } from '../lib/ApiError.js';

/** Terminal 404 for unmatched routes, in the error shape from ARCHITECTURE section 6. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}`));
};

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

function classify(err: unknown): { code: ErrorCode; message: string; details?: unknown } {
  if (err instanceof ApiError) return { code: err.code, message: err.message, details: err.details };
  if (err instanceof ZodError) {
    return { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues };
  }
  const candidate = err as BodyParserError;
  if (candidate?.type === 'entity.too.large') {
    return { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  }
  if (candidate?.type === 'entity.parse.failed') {
    return { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' };
  }
  return { code: 'INTERNAL', message: 'Internal server error' };
}

/** Central error middleware. Every failed response leaves through here. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { code, message, details } = classify(err);
  const status = ERROR_STATUS[code];
  if (code === 'INTERNAL') req.log?.error({ err }, 'unhandled error');
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
    requestId: req.requestId ?? '',
  };
  res.status(status).json(body);
};
