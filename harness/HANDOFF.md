# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T08 Normalize, dedupe, upsert, CLI
- Doing now: `apps/api/src/ingest` — content hash (ARCHITECTURE §7.1 step 3), company upsert, job upsert with both
  conflict rules, and the `pnpm --filter api ingest` CLI with `--source` and `--limit`, plus a summary log line.
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909), T05 (pushed, CI result not
  verifiable from here), T06 (7989c47), T07.
  - T06/T07: Remotive and Adzuna clients, zod-validated, mapping to the normalized job shape, malformed items
    counted not thrown. Fixtures are trimmed real responses saved under `apps/api/test/fixtures`; tests never
    touch the network. Shared helpers live in `src/lib/text.ts` and `src/ingest/normalize.ts`.
- Next step: run `pnpm --filter api ingest`, confirm ≥ 5,000 jobs and that a second run inserts 0, record the
  counts in STATE Measurements, then commit and start T09 (embedding service).
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - T05 is `in-progress`: the workflow is pushed but neither `gh` nor a GitHub token is available here, and the
    repository is private, so the run result could not be confirmed. The owner should check the Actions tab.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.
  - Adzuna's free tier has a small daily request quota, so ingestion sleeps between pages (default 1,200 ms) and
    `maxPages` defaults to 2. Re-running a full ingest burns quota; use `--limit` while developing.
  - Predicted Adzuna salaries are dropped (ADR-010).
  - Prettier ignores Markdown, `scripts/guard.mjs` and `packages/db/migrations`.
  - pnpm 12 gates build scripts via `allowBuilds` in `pnpm-workspace.yaml`.

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T06 (7989c47) and T07 done: Remotive and Adzuna clients with fixture tests. Next: T08.
- 2026-10-02 · T05 pushed (CI workflow added); run result not verifiable from this machine.
- 2026-10-02 · T04 done (cf40909): Express skeleton, health endpoint, error shape, env parsing. Next: T05.
- 2026-10-02 · T03 done (faae2ce): schema, migrations, typed client. Next: T04.
- 2026-10-02 · T02 done (a3a9a51): local Postgres with pgvector 0.8.7 in both databases.
- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
