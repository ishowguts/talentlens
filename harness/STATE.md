# TalentLens — State

Last updated: 2026-10-03 · Phase: **Day 7 — Prove it, ship it** · Next task: **T22** (the only one open: the automated judge's labels failed validation, so no search quality number is published). Everything else is done and deployed.

Status values: `todo` · `in-progress` · `blocked (reason)` · `done (YYYY-MM-DD, <commit>)`

| ID | Task | Status |
| --- | --- | --- |
| T01 | Monorepo scaffold | done (2026-10-02, 99caed0) |
| T02 | Local Postgres | done (2026-10-02, a3a9a51) |
| T03 | Schema + migrations | done (2026-10-02, faae2ce) |
| T04 | Express skeleton | done (2026-10-02, cf40909) |
| T05 | CI | done (2026-10-02, c72c4e9) · ci and ownership-guard both green on GitHub |
| T06 | Remotive client | done (2026-10-02, 7989c47) |
| T07 | Adzuna client | done (2026-10-02, 9f73fb0) |
| T08 | Normalize, dedupe, upsert, CLI | done (2026-10-02, d3ddf06) |
| T09 | Embedding service | done (2026-10-02, e88ca1f) |
| T10 | Embedding backfill with cache | done (2026-10-02, 8a44e54) |
| T11 | Vector search endpoint | done (2026-10-02, d0716b6) |
| T12 | Keyword search | done (2026-10-02, d07c44d) |
| T13 | Hybrid RRF + pagination | done (2026-10-02, 0632125) |
| T14 | Rate limits + search logs + click | done (2026-10-02, c81cc51) |
| T15 | Web scaffold | done (2026-10-02, 8d29f2c) |
| T16 | Search page | done (2026-10-02, b855757) |
| T17 | Job detail | done (2026-10-02, 2ec76ca) |
| T18 | Resume upload UI | done (2026-10-02, 7d4a2ab) |
| T19 | Resume match endpoint | done (2026-10-02, 13a1d8b) |
| T20 | Job ad scorer endpoint | done (2026-10-02, 5bc3e70) |
| T21 | Match + scorer UI | done (2026-10-02, 5bc3e70) |
| T22 | Evaluation tooling | in-progress · tooling done (71d3289) and the automated judge added (ADR-017), but its labels failed validation (kappa -0.051) and only 14 of 50 queries are judged (free-tier daily cap), so no quality number is published |
| T23 | Test coverage pass | done (2026-10-02, e055972) |
| T24 | Deploy | done (2026-10-03, 0bb8878) |
| T25 | README | done (2026-10-02, a185bd2) · both live links are in it; the demo GIF is the owner's to record |

## Measurements

Only measured values, each with the command that produced it and the commit.

| Metric | Value | Command | Commit |
| --- | --- | --- | --- |
| Jobs ingested | 7,141 (adzuna 7,125 · remotive 16); 3,124 companies | `pnpm --filter api ingest` then `select count(*) from jobs` | d3ddf06 |
| Embedding cache hit rate on re-ingest | 100% (7,141 of 7,141 skipped, 0 embedded) | `pnpm --filter api embed` run a second time | 8a44e54 |
| Embedding time per 1,000 jobs | 28.3 s (7,109 jobs in 200.8 s; CPU, fp32, Apple silicon) | `pnpm --filter api embed` | 8a44e54 |
| Recall@10 keyword / vector / hybrid | — not published. Computable (hybrid 0.271 / vector 0.253 / keyword 0.264 on 14 title-only queries) but the label set failed validation, so the figures describe the labels, not the engine | `pnpm eval` | |
| MRR@10 keyword / vector / hybrid | — not published, same reason as Recall@10 | `pnpm eval` | |
| Judge vs owner agreement, 10 queries | 78.5% raw, Cohen's kappa -0.051 (worse than chance); 410 jobs labeled by both; relevant share 86.1% owner vs 91.0% judge | `pnpm eval` | pending |
| p50 latency keyword / vector / hybrid | 1.3 ms / 8.7 ms / 14.4 ms (means 2.4 / 10.3 / 20.6 ms; 50 queries, 7,141 jobs, warm, local Docker Postgres) | `pnpm eval` | 71d3289 |
| Endpoint tests | 131 tests, 16 files, all green | `pnpm test` | e055972 |
| Search latency on the live API, p50 | keyword 102 ms · vector 730 ms · hybrid 757 ms server-side (total from a laptop in another region: 443 / 1,037 / 1,056 ms). 10 queries per mode, warm. Far above the local figures because query embedding runs on a free Render instance with a throttled shared CPU; the database round trip (Singapore to Tokyo) accounts for the keyword number | 10 queries per mode against `/api/search`, after a warm-up request per mode | 1456ac4 |
| Resume match latency, with rerank | 7.5 s end to end (PDF upload, 10 results, gemini-2.5-flash, thinking off) | `curl -X POST /api/match -F file=@apps/api/test/fixtures/resume.pdf` | f038a32 |

## Live URLs

- Web: <https://talentlens-silk.vercel.app> (Vercel). Verified 2026-10-02: the home page, a search for "senior
  react developer" (20 results, both rank badges on every row, server latency shown), `/jobs/[id]` with its
  source credit and outbound link, the `/match` drop zone, the `/score` form, and the keyword empty state all
  render against the live API. Browser-side calls work too: re-verified 2026-10-03, the API returns
  `access-control-allow-origin: https://talentlens-silk.vercel.app` on `GET /api/search`,
  `POST /api/search/click` and `POST /api/jobs/score`, answers the preflight 204 with `GET,POST` and
  `content-type`, and returns no header for a foreign origin. An earlier report that CORS refused every origin
  was a measurement error, not a fault; see ADR-018.
- API: <https://talentlens-api-k0rp.onrender.com> (Render, `singapore`). Verified 2026-10-02 end to end:
  `/api/health` reports `db: "ok"` and `jobs: 7141`; `/api/stats` matches the corpus; all three search modes
  return ranked results with the expected rank badges; `/api/jobs/:id` returns a full posting with its source
  and link; `/api/search/click` returns 204; a missing job gives 404 and an empty query 400 in the documented
  error shape; `/api/match` returns 10 results; `/api/jobs/score` scores a deliberately bad advert 10 and flags
  five terms. Re-verified 2026-10-03 with the model configured: `/api/health` reports `llm: "configured"`,
  `/api/match` returns `reranked: true` with fit scores 95/90/88/85 and grounded reasons in 9.7 s, and
  `/api/jobs/score` returns a rewritten title and three suggested edits while leaving the rules-only score at 10.
- Database: Supabase, PostgreSQL 17.11, ap-northeast-1 (Tokyo), session pooler. Loaded 2026-10-02 from the local
  container with `pg_dump | psql` (ADR-014). The connection string lives only in `.env` as `DATABASE_URL_PROD`.
  Verified against local: jobs 7,141, companies 3,124, job_embeddings 7,141 (384 dimensions), resumes 1,
  matches 10, search_logs 6. All ten indexes present including `job_embeddings_hnsw` and `jobs_search_tsv_gin`,
  `search_tsv` is `GENERATED ALWAYS`, and `pnpm --filter db migrate` against it is a no-op.

## Owner-only items

- Adzuna API keys, Gemini API key (owner creates accounts; agents never commit keys).
- Labeling the 50 eval queries (T22).
- Recording the demo GIF (T25).
