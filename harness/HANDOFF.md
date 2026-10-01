# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T10 Embedding backfill with cache
- Doing now: the full backfill is running (`pnpm --filter api embed`, log in the scratchpad). The code and its
  tests are committed (8a44e54); what is left is the measurement and the second-run check.
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909), T05 (pushed; CI result not
  verifiable here), T06 (7989c47), T07 (9f73fb0), T08 (d3ddf06), T09 (e88ca1f).
- Next step: when the backfill finishes, confirm `select count(*) from job_embeddings` equals the job count, run
  `pnpm --filter api embed` again and confirm `embedded=0`, record seconds per 1,000 jobs and the cache hit rate
  in STATE Measurements, then start T11 (vector search endpoint).
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - Embedding runs at roughly 155 s per 1,000 jobs on this machine (CPU, fp32), so a full 7,141-job backfill takes
    about 18 minutes. It is resumable: re-running continues where it stopped, because pending work is selected by
    content hash.
  - T05 is `in-progress`: the workflow is pushed but neither `gh` nor a GitHub token is available here and the
    repository is private, so the run result could not be confirmed. The owner should check the Actions tab.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna
    and only 77 rows are flagged remote.
  - Adzuna's free tier has a small daily quota; a full ingest is ~150 requests. Use `--limit` while developing.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.
  - The model cache lives in `.cache/transformers` (git-ignored, cached in CI by `.github/workflows/ci.yml`).

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T09 done (e88ca1f): embedding service; T10 code committed (8a44e54), full backfill running.
- 2026-10-02 · T08 done (d3ddf06): ingestion CLI; 7,141 jobs in the local database, repeat run inserts 0. Next: T09.
- 2026-10-02 · T06 (7989c47) and T07 done: Remotive and Adzuna clients with fixture tests. Next: T08.
- 2026-10-02 · T05 pushed (CI workflow added); run result not verifiable from this machine.
- 2026-10-02 · T04 done (cf40909): Express skeleton, health endpoint, error shape, env parsing. Next: T05.
- 2026-10-02 · T03 done (faae2ce): schema, migrations, typed client. Next: T04.
- 2026-10-02 · T02 done (a3a9a51): local Postgres with pgvector 0.8.7 in both databases.
- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
