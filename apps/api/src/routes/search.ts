import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { searchClickSchema, searchQuerySchema } from 'shared';
import { ApiError } from '../lib/ApiError.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { search, type SearchDeps } from '../services/search.js';

/** GET /api/search and POST /api/search/click (ARCHITECTURE section 6). */
export function searchRouter(deps: SearchDeps, limitPerMinute: number): Router {
  const router = Router();
  const limiter = createRateLimiter(limitPerMinute);

  router.get('/search', limiter, async (req, res, next) => {
    try {
      const query = searchQuerySchema.parse(req.query);
      res.json(await search(deps, query));
    } catch (error) {
      next(error);
    }
  });

  // The UI calls this when a result is opened, so clicks can be used to judge result quality later.
  router.post('/search/click', limiter, async (req, res, next) => {
    try {
      const { logId, jobId } = searchClickSchema.parse(req.body);
      const result = await deps.db.execute(sql`
        UPDATE search_logs
        SET clicked_job_id = ${jobId}, clicked_at = now()
        WHERE id = ${logId} AND ${jobId} = ANY (result_ids)
      `);
      if (result.rowCount === 0) {
        throw ApiError.notFound('No search log with that id contains that job');
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
