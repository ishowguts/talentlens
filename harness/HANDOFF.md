# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T04 Express skeleton
- Doing now: `apps/api` — `createApp()` / `server.ts` split, zod-parsed env (ARCHITECTURE §9), request id,
  pino-http, helmet, CORS allowlist, 1 MB JSON limit, central error middleware in the §6 error shape, and
  `GET /api/health` that checks the database. Vitest + Supertest tests alongside.
- Done this session:
  - Session-start protocol; `node scripts/guard.mjs all` green; `sh scripts/setup.sh` run.
  - T01 done (99caed0): pnpm workspace, strict TypeScript base config, ESLint + Prettier, Node 20 pin, five packages.
  - T02 done (a3a9a51): `docker-compose.yml` with `pgvector/pgvector:pg16`, init script for `talentlens` and
    `talentlens_test` with the `vector` and `pg_trgm` extensions, `.env.example` with every §9 variable.
    Verified `vector 0.8.7` in both databases.
  - T03 done (faae2ce): Drizzle schema for all §5 tables, generated migration, migration runner, typed client.
    Verified: migrate twice (second run a no-op), `search_tsv` generated, GIN + HNSW indexes present.
    ADR-009 records that Drizzle expresses the generated column and both indexes, so no hand-written SQL is needed.
- Next step: `pnpm --filter api test` green on `/api/health` (200, `db:"ok"`), unknown route 404 in the §6 error
  shape, and a missing required env var exiting non-zero. Then commit `feat(api): add Express skeleton` and start T05.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.
  - Prettier ignores Markdown, `scripts/guard.mjs` and `packages/db/migrations`; format those by hand or leave
    them as generated.
  - pnpm 12 gates package build scripts. The allowlist lives in `pnpm-workspace.yaml` under `allowBuilds`
    (`pnpm approve-builds <pkg> -y` writes it). `esbuild` is already approved.
  - Root `typecheck`/`test`/`build` use `pnpm -r --if-present`, so a package without code yet is skipped.

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T03 done (faae2ce): schema, migrations, typed client. Next: T04.
- 2026-10-02 · T02 done (a3a9a51): local Postgres with pgvector 0.8.7 in both databases.
- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
