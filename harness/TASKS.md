# TalentLens — Tasks

Rules: work in ID order unless dependencies allow otherwise. One task at a time. A task is `done` only when every
acceptance criterion holds and CI is green. Never delete a task; split it into `T07a`, `T07b` if it is too big.
Status lives in `harness/STATE.md`, not here.

Spec references point to `docs/ARCHITECTURE.md` sections (§).

## Day 1 — Foundation

**T01 Monorepo scaffold** · deps: none
- pnpm workspace with `apps/api`, `apps/web`, `packages/db`, `packages/shared`, `eval` (§4).
- `tsconfig.base.json` (strict, ESM, NodeNext for api/packages), ESLint (typescript-eslint) + Prettier, root scripts
  `lint`, `typecheck`, `test`, `build`, `format`.
- `.nvmrc` = 20, `packageManager` field pinned.
- Accept: `pnpm install && pnpm lint && pnpm typecheck` pass on a clean clone.

**T02 Local Postgres** · deps: T01
- `docker-compose.yml` with `pgvector/pgvector:pg16`, volume, healthcheck; init script creates `talentlens` and
  `talentlens_test` DBs and `CREATE EXTENSION vector` in both.
- `.env.example` with every var from §9.
- Accept: `docker compose up -d` then `psql ... -c "select extversion from pg_extension where extname='vector'"` ≥ 0.8.

**T03 Schema + migrations** · deps: T02
- `packages/db`: Drizzle schema for all tables in §5; raw SQL migration for `search_tsv` generated column, GIN index,
  HNSW index; `db:migrate` and `db:generate` scripts; exported typed client.
- Accept: migrate on empty DB succeeds; running it again is a no-op; `\d jobs` shows `search_tsv` generated.

**T04 Express skeleton** · deps: T03
- `createApp()` / `server.ts` split; zod env (§9); request id; pino-http; helmet; cors allowlist; JSON 1 MB limit;
  central error middleware with the error shape in §6; `GET /api/health` checks DB.
- Accept: Supertest: `/api/health` 200 with `db:"ok"`; unknown route 404 in error shape; invalid env exits non-zero.

**T05 CI** · deps: T04
- `.github/workflows/ci.yml`: Postgres service (pgvector image), install, lint, typecheck, migrate test DB, test.
  Keep `guard.yml` separate and untouched.
- Accept: CI green on push.

## Day 2 — Data

**T06 Remotive client** · deps: T03
- Fetch, zod-parse, map to the normalized job shape (§7.1). Fixture-based unit test (saved sample JSON, no network).
- Accept: unit tests pass; malformed item is skipped and counted.

**T07 Adzuna client** · deps: T03
- Paged fetch per country × term, polite delay, zod-parse, map. Fixture-based unit test.
- Accept: unit tests pass; respects `--limit`.

**T08 Normalize, dedupe, upsert, CLI** · deps: T06, T07
- HTML→text, salary parser, country, remote flag, content hash (§7.1); company upsert; job upsert with both
  conflict rules; `pnpm --filter api ingest` CLI with `--source`, `--limit`; summary log line.
- Accept: ≥ 5,000 jobs in local DB; second run inserts 0; unit tests for hash/salary/normalize. Record counts in STATE.

## Day 3 — Vectors

**T09 Embedding service** · deps: T04
- `Embedder` interface + Transformers.js implementation (§7.2), lazy singleton, batch of 32, resume chunking helper.
- Accept: unit test: output length 384, L2 norm ≈ 1, similar sentences closer than unrelated ones.

**T10 Embedding backfill with cache** · deps: T08, T09
- Embed jobs missing or stale by `content_hash`; upsert `job_embeddings`; log embedded vs skipped.
- Accept: all jobs embedded; second run embeds 0. Record time per 1,000 jobs in STATE.

**T11 Vector search endpoint** · deps: T10
- `GET /api/search?mode=vector` with filters, `ef_search` and iterative scan settings (§7.3), shared zod schemas.
- Accept: Supertest happy path on fixtures + validation failure (empty `q`) → 400.

## Day 4 — Hybrid

**T12 Keyword search** · deps: T11
- `mode=keyword` with `websearch_to_tsquery`, same filters and response shape.
- Accept: tests pass; a query with a quoted phrase works.

**T13 Hybrid RRF + pagination** · deps: T12
- RRF as a pure function (unit-tested) and as the SQL in §7.3; `ranks` populated; `page`/`pageSize`/`hasMore`.
- Accept: unit test of fusion order on a hand-made example; hybrid is the default mode.

**T14 Rate limits + search logs + click** · deps: T13
- Limits from §6; `search_logs` insert; `POST /api/search/click`.
- Accept: test 429 after limit (with a low test limit); log row written; click updates row.

## Day 5 — Web

**T15 Web scaffold** · deps: T05
- Next.js 14 App Router + Tailwind in `apps/web`; typed API client using `packages/shared`; layout, nav.
- Accept: `pnpm --filter web build` passes.

**T16 Search page** · deps: T14, T15
- Query box, mode toggle (keyword / vector / hybrid), filters, results with rank badges, pagination, empty/error
  states, click logging.
- Accept: works end to end locally against the API.

**T17 Job detail** · deps: T16
- `/jobs/[id]`: full description, salary, source credit ("via Remotive" / "via Adzuna") and outbound link.

**T18 Resume upload UI** · deps: T15
- `/match`: PDF drop zone + paste-text fallback, client-side size/type check, loading state.

## Day 6 — LLM features

**T19 Resume match endpoint** · deps: T11, T09
- Full flow §7.4 including retry, timeout, fallback, invented-id filtering, caching by text hash.
- Accept: tests with a fake LLM: valid output, invalid JSON then valid on retry, invalid twice → fallback
  (`reranked:false`), invented id dropped, non-PDF → 400, > 2 MB → 413.

**T20 Job ad scorer endpoint** · deps: T04
- Rules table and weights exactly as §7.5; bias term list with suggestions; one LLM call for title/notes.
- Accept: unit tests per rule; score of a known bad ad and a known good ad are pinned in tests.

**T21 Match + scorer UI** · deps: T18, T19, T20
- Match results with fit score, reasons, missing skills (and a "ranked by similarity only" note when
  `reranked:false`); `/score` page with checklist, flagged terms, rewritten title.

## Day 7 — Prove it, ship it

**T22 Evaluation tooling** · deps: T13
- `eval/label.ts` pooling + labeling CLI; `eval/run.ts` metrics → `eval/results.md` (§8).
- The owner labels the 50 queries. Agents must not label or invent relevance judgments.
- Accept: `pnpm eval` produces the table from `eval/queries.jsonl`. Numbers copied to STATE Measurements.

**T23 Test coverage pass** · deps: T19, T20, T14
- Every endpoint has happy + failure tests; `pnpm test` green in CI.

**T24 Deploy** · deps: T21, T23
- Neon + Render + Vercel per §11; prod migrations; prod ingest + embed; CORS set.
- Accept: live web URL searches the live API; URLs recorded in STATE.

**T25 README** · deps: T22, T24
- What it is, live link, demo GIF (owner records it), architecture diagram (copy from §2), measured results table
  from `eval/results.md`, latency table, how to run locally, data source credits. No numbers that were not measured.
