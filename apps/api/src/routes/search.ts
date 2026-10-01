import { Router } from 'express';
import { searchQuerySchema } from 'shared';
import { search, type SearchDeps } from '../services/search.js';

/** GET /api/search — keyword, vector or hybrid search (ARCHITECTURE section 6). */
export function searchRouter(deps: SearchDeps): Router {
  const router = Router();

  router.get('/search', async (req, res, next) => {
    try {
      const query = searchQuerySchema.parse(req.query);
      res.json(await search(deps, query));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
