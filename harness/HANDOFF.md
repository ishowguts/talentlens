# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T03 Schema + migrations
- Doing now:
  1. Rename the workspace packages to `api`, `web`, `db`, `shared`, `eval` so the commands documented in
     AGENTS.md (`pnpm --filter db migrate`, `pnpm --filter api ingest`, `pnpm --filter web dev`) resolve.
  2. `packages/db`: Drizzle schema for every table in ARCHITECTURE §5, SQL migrations (including the generated
     `search_tsv` column, the GIN index and the HNSW index), `db:generate` / `migrate` scripts, typed client.
- Done this session:
  - Session-start protocol; `node scripts/guard.mjs all` green; `sh scripts/setup.sh` run.
  - T01 done (99caed0): pnpm workspace, strict TypeScript base config, ESLint + Prettier, Node 20 pin, five packages.
  - T02 done (a3a9a51): `docker-compose.yml` with `pgvector/pgvector:pg16`, init script creating `talentlens` and
    `talentlens_test` with the `vector` and `pg_trgm` extensions, `.env.example` with every §9 variable.
    Verified: `vector 0.8.7` in both databases.
- Next step: run the migration twice against `talentlens` (second run must be a no-op), confirm `\d jobs` shows
  `search_tsv` as generated, then commit `feat(db): add schema and migrations` and start T04.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed on this machine. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.
  - Prettier ignores Markdown and `scripts/guard.mjs` on purpose; format those by hand.
  - Root `typecheck`/`test`/`build` use `pnpm -r --if-present`, so a package without code yet is skipped. Add the
    script to a package in the task that gives it its first source file.
- Commands to verify: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
