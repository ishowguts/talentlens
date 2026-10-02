// Builds the Express app. Kept separate from server.ts so tests can mount it without listening.
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Database } from 'db';
import { normalizeOrigin, type Env } from './env.js';
import { getEmbedder } from './services/embeddings.js';
import type { Embedder } from './services/embeddings.js';
import { createLlmClient, type LlmClient } from './services/llm.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestId } from './middleware/requestId.js';
import { DEFAULT_RATE_LIMITS, type RateLimits } from './middleware/rateLimit.js';
import { healthRouter } from './routes/health.js';
import { jobsRouter } from './routes/jobs.js';
import { matchRouter } from './routes/match.js';
import { searchRouter } from './routes/search.js';

export interface AppDeps {
  db: Database;
  env: Env;
  /** Injected in tests; defaults to the process-wide Transformers.js embedder. */
  embedder?: Embedder;
  /** Injected in tests so a limit can be reached in a few requests. */
  rateLimits?: Partial<RateLimits>;
  /** Injected in tests; defaults to Gemini when the environment configures it, null otherwise. */
  llm?: LlmClient | null;
}

export function createApp({
  db,
  env,
  embedder = getEmbedder(env.EMBEDDING_MODEL),
  rateLimits,
  llm = createLlmClient(env.GEMINI_API_KEY, env.GEMINI_MODEL),
}: AppDeps) {
  const limits: RateLimits = { ...DEFAULT_RATE_LIMITS, ...rateLimits };
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
  const allowedOrigins = new Set(env.CORS_ORIGINS);
  app.use(
    cors({
      // Compared after normalization, so a trailing slash in the environment is not a silent outage.
      origin: (origin, callback) => {
        // Server-to-server and same-origin requests send no Origin header.
        if (!origin) return callback(null, true);
        callback(null, allowedOrigins.has(normalizeOrigin(origin)));
      },
      methods: ['GET', 'POST'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter(db, env, llm));
  app.use('/api', jobsRouter(db, { llm, llmTimeoutMs: env.LLM_TIMEOUT_MS }, limits.score));
  app.use('/api', searchRouter({ db, embedder }, limits.search));
  app.use('/api', matchRouter({ db, embedder, llm, llmTimeoutMs: env.LLM_TIMEOUT_MS }, limits.match));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
