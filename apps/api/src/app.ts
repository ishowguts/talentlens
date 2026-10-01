// Builds the Express app. Kept separate from server.ts so tests can mount it without listening.
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Database } from 'db';
import type { Env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.js';

export interface AppDeps {
  db: Database;
  env: Env;
}

export function createApp({ db, env }: AppDeps) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(
    pinoHttp({
      level: env.LOG_LEVEL,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter(db, env));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
