import { Router } from 'express';
import { sql } from 'drizzle-orm';
import type { Database } from 'db';
import type { Job, Stats } from 'shared';
import { ApiError } from '../lib/ApiError.js';
import { snippet } from '../lib/text.js';

interface JobRow extends Record<string, unknown> {
  id: string | number;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  is_remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: Date | string | null;
  description: string;
  source: 'remotive' | 'adzuna';
  url: string;
}

/** GET /api/jobs/:id and GET /api/stats (ARCHITECTURE section 6). */
export function jobsRouter(db: Database): Router {
  const router = Router();

  router.get('/jobs/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw ApiError.validation('Job id must be a positive integer');

      const rows = await db.execute<JobRow>(sql`
        SELECT j.id, j.title, c.name AS company, j.location, j.country, j.is_remote,
               j.salary_min, j.salary_max, j.salary_currency, j.posted_at, j.description, j.source, j.url
        FROM jobs j
        LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.id = ${id}
      `);
      const row = rows.rows[0];
      if (!row) throw ApiError.notFound(`No job with id ${id}`);

      const job: Job = {
        id: Number(row.id),
        title: row.title,
        company: row.company ?? 'Unknown',
        location: row.location,
        country: row.country,
        isRemote: row.is_remote,
        salaryMin: row.salary_min,
        salaryMax: row.salary_max,
        salaryCurrency: row.salary_currency,
        postedAt: row.posted_at ? new Date(row.posted_at).toISOString() : null,
        snippet: snippet(row.description),
        description: row.description,
        source: row.source,
        url: row.url,
      };
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.get('/stats', async (_req, res, next) => {
    try {
      const rows = await db.execute<
        {
          jobs: string;
          embedded: string;
          remotive: string;
          adzuna: string;
          last_ingest_at: Date | string | null;
        } & Record<string, unknown>
      >(sql`
        SELECT count(*) AS jobs,
               count(e.job_id) AS embedded,
               count(*) FILTER (WHERE j.source = 'remotive') AS remotive,
               count(*) FILTER (WHERE j.source = 'adzuna') AS adzuna,
               max(j.created_at) AS last_ingest_at
        FROM jobs j
        LEFT JOIN job_embeddings e ON e.job_id = j.id
      `);
      const row = rows.rows[0];
      const stats: Stats = {
        jobs: Number(row?.jobs ?? 0),
        embedded: Number(row?.embedded ?? 0),
        bySource: { remotive: Number(row?.remotive ?? 0), adzuna: Number(row?.adzuna ?? 0) },
        lastIngestAt: row?.last_ingest_at ? new Date(row.last_ingest_at).toISOString() : null,
      };
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
