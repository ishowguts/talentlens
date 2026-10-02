import { Router } from 'express';
import { sql } from 'drizzle-orm';
import type { Database } from 'db';
import { jobs } from 'db';
import { count } from 'drizzle-orm';
import type { Env } from '../env.js';
import type { LlmClient } from '../services/llm.js';

/** GET /api/health — liveness plus a real database round trip (ARCHITECTURE section 6). */
export function healthRouter(db: Database, env: Env, llm: LlmClient | null = null): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    let dbStatus: 'ok' | 'down' = 'ok';
    let jobCount = 0;
    try {
      await db.execute(sql`select 1`);
      const [row] = await db.select({ value: count() }).from(jobs);
      jobCount = row?.value ?? 0;
    } catch {
      dbStatus = 'down';
    }
    res.json({
      status: 'ok',
      db: dbStatus,
      embeddingModel: env.EMBEDDING_MODEL,
      // Says whether a reranking model is configured, so a deployment can be checked without reading logs.
      // No key or model id is ever reported.
      llm: llm ? 'configured' : 'not configured',
      jobs: jobCount,
    });
  });

  return router;
}
