# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T24 Deploy
- Doing now: nothing. The production database is loaded and verified; the remaining steps need the owner's
  Render and Vercel accounts.
- Done this session: every task except T24, which is now partly done. T05 is confirmed green on GitHub
  (c72c4e9). Commits: T01 99caed0, T02 a3a9a51, T03 faae2ce, T04 cf40909, T05 c72c4e9, T06 7989c47, T07 9f73fb0,
  T08 d3ddf06, T09 e88ca1f, T10 8a44e54, T11 d0716b6, T12 d07c44d, T13 0632125, T14 c81cc51, T19 13a1d8b,
  T15 8d29f2c, T16 b855757, T17 2ec76ca, T18 7d4a2ab, T20 + T21 5bc3e70, T22 71d3289, T23 e055972, T25 a185bd2.
- T24 progress: the production database (Supabase, PostgreSQL 17.11, Tokyo, session pooler) holds the full
  corpus. `vector 0.8.2` and `pg_trgm 1.6` were created in `public` first, because `pg_dump` empties
  `search_path` and schema-qualifies the `vector` type as `public.vector`; installing the extension in
  Supabase's usual `extensions` schema would have failed the restore.
- Next step (T24), for whoever has the accounts:
  1. Render: create the service from `render.yaml` (region `singapore`, the closest to the Tokyo database).
     Set `DATABASE_URL` to the value of `DATABASE_URL_PROD` **with the password percent-encoded**: the password
     contains an `@`, which must be written `%40`. The first deploy failed on this: the URL was split at that
     `@` and the text after it (`base`) was used as the hostname, so the build died on
     `getaddrinfo ENOTFOUND base`. Then set `CORS_ORIGINS`,
     `CORS_ORIGINS` to the Vercel URL, plus `GEMINI_API_KEY` and `GEMINI_MODEL`. Health check `/api/health`
     should report `db: "ok"` and `jobs: 7141`.
  2. Vercel: import the repository, root directory `apps/web`, `NEXT_PUBLIC_API_URL` = the Render URL.
  3. Record both URLs in STATE under Live URLs and add the live link to the README.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - **A password with an unencoded `@` breaks the URL on some parsers and not others.** It parses correctly with
    the Node version on this machine but not on Render's Node 20, which is why the first deploy failed rather
    than local development. `packages/db/src/url.ts` now rejects it everywhere with an explicit message, so
    `.env` itself should be fixed too: write the `@` in `DATABASE_URL_PROD` as `%40`. Until that is done,
    `pnpm --filter db migrate` against production fails on purpose.
  - **Never print or log `DATABASE_URL_PROD`.** It stays in `.env` only. The copy was run by passing it to the
    container as `PG*` variables; the helper used for that lives in the session scratchpad, not in the repository.
  - Production started clean: `matches`, `resumes` and `search_logs` were truncated after the copy, so only the
    corpus (7,141 jobs, 3,124 companies, 7,141 embeddings) is there.
  - When piping `pg_dump` into `psql` for this copy, the `PG*` variables address production, so they must be
    unset inside the subshell that runs `pg_dump` or it dumps production into production and silently copies
    nothing. That mistake happened once and was caught by the row-count check.
  - **Recall@10 and MRR@10 are unmeasured by design.** The 50 queries in `eval/queries.jsonl` have empty
    `relevant` lists. Only the owner labels: `pnpm --filter eval label`, then `pnpm eval`.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna,
    and only 77 rows are flagged remote.
  - Do not re-ingest for production: the Adzuna key is a trial key (ADR-014).
  - Reranking needs model thinking disabled to fit the 15 s timeout (ADR-012).
  - Hybrid search never returns an empty list, because the vector leg always returns its nearest neighbours.
  - The `/match` and `/score` pages are client components, verified with curl against the API rather than
    through a browser. A browser pass is worth doing before the demo.
  - Dev servers may still be running: api on 4000, web on 3000. The `talentlens-db` container is up.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed on the host. Use `docker compose exec -T db psql -U postgres -d talentlens`.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (131 tests, 16 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All of them are done except T24, which is
blocked on deployment credentials.

## Log

- 2026-10-02 · first Render deploy failed on a malformed DATABASE_URL (unencoded @ in the password, host read as "base"). Added connection-string validation in packages/db and documented the percent-encoding; the fix itself is a dashboard change.
- 2026-10-02 · production truncated to the corpus only; render.yaml moved to the singapore region and the Neon references in ARCHITECTURE replaced with Supabase (ADR-015). Ready for Render.
- 2026-10-02 · production database loaded from the local container and verified row for row; Render and Vercel still outstanding.
- 2026-10-02 · T05 confirmed green on GitHub; marked done (c72c4e9). T24 will load Neon from a pg_dump of the local database instead of re-ingesting (ADR-014); waiting for the Neon URL.
- 2026-10-02 · T20, T21, T23 and T25 done (5bc3e70, e055972, a185bd2). Whole plan complete except T24, which needs Neon, Render and Vercel credentials. 131 tests green.
- 2026-10-02 · T22 done (71d3289): evaluation tooling; latency measured (p50 1.3/8.7/14.4 ms), recall awaits the owner's labels.
- 2026-10-02 · T19, T15-T18 done and T21 match UI done (f038a32): API complete except the scorer; web search, job detail and match pages work against the live API. Next: T22.
- 2026-10-02 · T11-T14 done (d0716b6, d07c44d, 0632125, c81cc51): all three search modes, RRF, rate limits, click logging. Next: T19.
- 2026-10-02 · T10 done (8a44e54): 7,141 jobs embedded, 28.3 s per 1,000, second run embeds 0.
- 2026-10-02 · T09 done (e88ca1f): embedding service; T10 code committed (8a44e54), full backfill running.
- 2026-10-02 · T08 done (d3ddf06): ingestion CLI; 7,141 jobs in the local database, repeat run inserts 0. Next: T09.
- 2026-10-02 · T06 (7989c47) and T07 done: Remotive and Adzuna clients with fixture tests. Next: T08.
- 2026-10-02 · T05 pushed (CI workflow added); run result not verifiable from this machine.
- 2026-10-02 · T04 done (cf40909): Express skeleton, health endpoint, error shape, env parsing. Next: T05.
- 2026-10-02 · T03 done (faae2ce): schema, migrations, typed client. Next: T04.
- 2026-10-02 · T02 done (a3a9a51): local Postgres with pgvector 0.8.7 in both databases.
- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
