# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: BLOCKED (waiting for the owner's Neon connection URL)
- Task: T24 Deploy
- Doing now: nothing. The next action needs the Neon URL, which the owner is sending.
- Done this session: every task except T24. T05 is confirmed green on GitHub (ci and ownership-guard, at
  c72c4e9). Commits: T01 99caed0, T02 a3a9a51, T03 faae2ce, T04 cf40909, T05 c72c4e9, T06 7989c47, T07 9f73fb0,
  T08 d3ddf06, T09 e88ca1f, T10 8a44e54, T11 d0716b6, T12 d07c44d, T13 0632125, T14 c81cc51, T19 13a1d8b,
  T15 8d29f2c, T16 b855757, T17 2ec76ca, T18 7d4a2ab, T20 + T21 5bc3e70, T22 71d3289, T23 e055972, T25 a185bd2.
- Next step (T24), in this order:
  1. **Copy the data, do not re-ingest.** The Adzuna key is a trial key and a full ingest costs about 150
     requests, so production is loaded from the local database instead (ADR-014). With the Neon URL in
     `$NEON_URL`, run it inside the container, which has both tools at the matching major version:
     `docker compose exec -T db sh -c 'pg_dump --no-owner --no-privileges -U postgres -d talentlens | psql "$NEON"'`
     with `-e NEON="$NEON_URL"`. If the `vector` extension cannot be created by the dump, create it on Neon
     first (`CREATE EXTENSION vector;`) and re-run. The dump carries the `drizzle` ledger, so
     `pnpm --filter db migrate` against Neon afterwards is a no-op; run it to confirm.
  2. Verify on Neon: `select count(*) from jobs` = 7,141 and `select count(*) from job_embeddings` = 7,141.
  3. Render: create the service from `render.yaml`, set `DATABASE_URL` (Neon), `CORS_ORIGINS` (the Vercel URL),
     `GEMINI_API_KEY`, `GEMINI_MODEL`. Health check `/api/health`; expect `jobs: 7141`.
  4. Vercel: import the repository, root directory `apps/web`, `NEXT_PUBLIC_API_URL` = the Render URL.
  5. Record both URLs in STATE under Live URLs and add the live link to the README.
- Files in flight (uncommitted): none. Working tree clean, everything pushed.
- Open problems / gotchas:
  - **Never print or log the Neon URL.** Keep it in an environment variable or the session scratchpad, never in a
    tracked file, and never in a commit message.
  - **Recall@10 and MRR@10 are unmeasured by design.** The 50 queries in `eval/queries.jsonl` have empty
    `relevant` lists. Only the owner labels: `pnpm --filter eval label` (resumable; `--only-unlabeled` and
    `--query q07` both work), then `pnpm eval`. Latency is already measured over all 50 queries.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna,
    and only 77 rows are flagged remote.
  - Reranking needs model thinking disabled to fit the 15 s timeout (ADR-012).
  - Hybrid search never returns an empty list, because the vector leg always returns its nearest neighbours.
  - The `/match` and `/score` pages are client components. Their request paths were verified against the live API
    with curl, not through a browser. A browser pass is worth doing before the demo.
  - Dev servers may still be running from this session: api on 4000, web on 3000. The `talentlens-db` container is
    up with the full corpus; the dump in step 1 reads from it, so leave it running.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed on the host. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` exists and must never be overwritten, printed or logged. Only `.env.example` has placeholders.
  - pnpm 12 gates build scripts through `allowBuilds` in `pnpm-workspace.yaml`; `canvas` is denied on purpose.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (131 tests, 16 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All of them are done except T24, which is
blocked on deployment credentials.

## Log

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
