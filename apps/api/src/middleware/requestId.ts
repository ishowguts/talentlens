import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Accepts an inbound x-request-id, otherwise generates one, and always echoes it back. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 200 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
