# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: BLOCKED (on T24 only; everything else in the plan is done)
- Task: T24 Deploy
- Doing now: nothing. T24 cannot proceed from this machine: it needs Neon, Render and Vercel accounts and their
  credentials, which only the owner has.
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909), T05 (pushed; result unverified),
  T06 (7989c47), T07 (9f73fb0), T08 (d3ddf06), T09 (e88ca1f), T10 (8a44e54), T11 (d0716b6), T12 (d07c44d),
  T13 (0632125), T14 (c81cc51), T19 (13a1d8b), T15 (8d29f2c), T16 (b855757), T17 (2ec76ca), T18 (7d4a2ab),
  T20 + T21 (5bc3e70), T22 (71d3289), T23 (e055972), T25 (a185bd2).
- Next step, for whoever has the credentials:
  1. Neon: create the project, run `DATABASE_URL=<neon url> pnpm --filter db migrate`. The first migration
     creates the `vector` extension itself.
  2. Render: create the service from `render.yaml`, set `DATABASE_URL`, `CORS_ORIGINS` (the Vercel URL),
     `GEMINI_API_KEY` and `GEMINI_MODEL` in the dashboard. Health check is `/api/health`.
  3. Vercel: import the repository with root directory `apps/web` and `NEXT_PUBLIC_API_URL` = the Render URL.
  4. Populate production: `DATABASE_URL=<neon url> pnpm --filter api ingest` then `... pnpm --filter api embed`.
     Ingest is about 150 Adzuna requests and roughly 9 minutes; embedding is about 28 s per 1,000 jobs.
  5. Record both URLs in STATE under Live URLs, then add the live link to the README (T25 is otherwise finished).
- Files in flight (uncommitted): none. Working tree clean, everything pushed to `origin/main`.
- Open problems / gotchas:
  - **T24 is blocked on credentials.** `render.yaml` is ready and `pnpm --filter api start` was verified locally.
  - **T05 CI result is unverified.** The workflow is pushed, but this machine has no `gh` and no GitHub token and
    the repository is private, so the run could not be read. Check the Actions tab; the same four commands
    (`pnpm lint`, `pnpm typecheck`, `pnpm --filter db migrate --test`, `pnpm test`) are green locally.
  - **Recall@10 and MRR@10 are unmeasured by design.** The 50 queries in `eval/queries.jsonl` have empty
    `relevant` lists. Only the owner labels: `pnpm --filter eval label` (resumable, `--only-unlabeled` and
    `--query q07` both work), then `pnpm eval`. Latency is already measured over all 50 queries.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the 7,141-job corpus is
    effectively Adzuna, and only 77 rows are flagged remote.
  - Adzuna's free tier has a small daily request quota. A full ingest is about 150 requests. Use `--limit`.
  - Reranking needs model thinking disabled to fit the 15 s timeout (ADR-012).
  - Hybrid search never returns an empty list, because the vector leg always returns its nearest neighbours.
  - The `/match` and `/score` pages are client components. Their request paths were verified against the live API
    with curl, not through a browser. A browser pass is worth doing before the demo.
  - Dev servers may still be running from this session: `pnpm --filter api dev` (4000), `pnpm --filter web dev`
    (3000). The Postgres container `talentlens-db` is up with the full corpus.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` exists and must never be overwritten, printed or logged. Only `.env.example` has placeholders.
  - pnpm 12 gates package build scripts through `allowBuilds` in `pnpm-workspace.yaml`; `canvas` is denied on
    purpose (pulled in by `unpdf`, not needed for text extraction).
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (131 tests, 16 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All of them are done except T24, which is
blocked on deployment credentials.

## Log

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
