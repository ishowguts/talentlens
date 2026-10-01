# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T09 Embedding service
- Doing now: `apps/api/src/services/embeddings.ts` — the `Embedder` interface and a Transformers.js
  implementation of `Xenova/all-MiniLM-L6-v2` (ARCHITECTURE §7.2): lazy singleton, mean pooling, L2 normalized,
  batches of 32, plus the resume chunking helper (~180-word chunks, 30-word overlap, mean then re-normalize).
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909), T05 (pushed; CI result not
  verifiable here), T06 (7989c47), T07 (9f73fb0), T08 (d3ddf06).
  - T08 measured: 7,141 jobs (adzuna 7,125, remotive 16), 3,124 companies, 2,666 jobs with an advertised salary.
    A repeat run inserts 0 (`--source adzuna --limit 50` → `inserted=0 updated=50`).
- Next step: unit test the embedder (384 dims, L2 norm ≈ 1, related sentences closer than unrelated ones), then
  commit `feat(api): add embedding service` and start T10 (backfill with cache).
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - T05 is `in-progress`: the workflow is pushed but neither `gh` nor a GitHub token is available here and the
    repository is private, so the run result could not be confirmed. The owner should check the Actions tab.
  - Remotive's public feed returned only 16 jobs, whatever `limit` is passed, so the corpus is effectively Adzuna.
    That is why `is_remote` is true for only 77 rows. Nothing to fix in the client; it is the feed.
  - Adzuna's free tier has a small daily request quota. A full ingest is about 150 requests (3 countries x 25
    terms x 2 pages). Use `--limit` while developing instead of re-running the whole thing.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.
  - Prettier ignores Markdown, `scripts/guard.mjs` and `packages/db/migrations`.
  - pnpm 12 gates build scripts via `allowBuilds` in `pnpm-workspace.yaml`.

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T08 done (d3ddf06): ingestion CLI; 7,141 jobs in the local database, repeat run inserts 0. Next: T09.
- 2026-10-02 · T06 (7989c47) and T07 done: Remotive and Adzuna clients with fixture tests. Next: T08.
- 2026-10-02 · T05 pushed (CI workflow added); run result not verifiable from this machine.
- 2026-10-02 · T04 done (cf40909): Express skeleton, health endpoint, error shape, env parsing. Next: T05.
- 2026-10-02 · T03 done (faae2ce): schema, migrations, typed client. Next: T04.
- 2026-10-02 · T02 done (a3a9a51): local Postgres with pgvector 0.8.7 in both databases.
- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
