# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T05 CI
- Doing now: `.github/workflows/ci.yml` — a `pgvector/pgvector:pg16` service container, pnpm + Node 20, install,
  lint, typecheck, migrate the test database, test. `guard.yml` stays separate and untouched.
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909).
  - T04: `createApp()` / `server.ts` split, zod environment with a readable failure, request id, pino-http, helmet,
    CORS allowlist, 1 MB JSON limit, central error middleware, `GET /api/health` with a database round trip.
    Tests: health 200 with `db:"ok"`, unknown route 404 in the §6 shape, invalid environment exits non-zero.
- Next step: push and confirm the run is green (`gh run list`). Then commit the status update and start T06
  (Remotive client).
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.
  - Prettier ignores Markdown, `scripts/guard.mjs` and `packages/db/migrations`.
  - pnpm 12 gates package build scripts; the allowlist is `allowBuilds` in `pnpm-workspace.yaml`
    (`pnpm approve-builds <pkg> -y` writes it). `esbuild` is approved.
  - CI has no `.env`, so `dotenv` is a no-op there and the workflow passes the variables directly. API tests only
    need `DATABASE_URL_TEST`; the CI service container is named `talentlens_test` for that reason.

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T04 done (cf40909): Express skeleton, health endpoint, error shape, env parsing. Next: T05.
- 2026-10-02 · T03 done (faae2ce): schema, migrations, typed client. Next: T04.
- 2026-10-02 · T02 done (a3a9a51): local Postgres with pgvector 0.8.7 in both databases.
- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
