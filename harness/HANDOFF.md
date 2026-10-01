# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T02 Local Postgres
- Doing now: writing `docker-compose.yml` (`pgvector/pgvector:pg16`, named volume, healthcheck), the init script
  that creates `talentlens` and `talentlens_test` with `CREATE EXTENSION vector`, and `.env.example` with every
  variable from ARCHITECTURE §9 (placeholders only, no values).
- Done this session:
  - Session-start protocol: read AGENTS.md, HANDOFF, STATE, ARCHITECTURE, TASKS, DECISIONS, CONTEXT; `git status`
    clean at dca0df2; `node scripts/guard.mjs all` green; `sh scripts/setup.sh` run.
  - T01 done (99caed0): pnpm workspace, `tsconfig.base.json` (strict, NodeNext), ESLint flat config with
    typescript-eslint, Prettier, `.nvmrc` 20, `packageManager` pinned, and a package for `apps/api`, `apps/web`,
    `packages/db`, `packages/shared`, `eval`. `pnpm install && pnpm lint && pnpm typecheck` pass.
- Next step: `docker compose up -d`, wait for the healthcheck, then verify
  `docker compose exec -T db psql -U postgres -d talentlens -c "select extversion from pg_extension where extname='vector'"`
  is ≥ 0.8 in both databases. Then commit `chore(db): add local Postgres with pgvector` and start T03.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (the version in ARCHITECTURE §3). Development runs on the
    local 25; CI is the source of truth for the supported version.
  - `psql` is not installed on this machine. Run SQL through the container: `docker compose exec -T db psql -U postgres`.
  - A filled `.env` already exists and must never be overwritten, printed or logged. Only `.env.example` is created,
    with empty placeholders.
  - Prettier ignores Markdown and `scripts/guard.mjs` on purpose (it reformatted the harness documents and the guard
    on first run). Keep it that way; format those by hand.
  - Root `typecheck`/`test`/`build` use `pnpm -r --if-present`, so a package without code yet is skipped. Add the
    script to a package in the task that gives it its first source file.
- Commands to verify: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

- 2026-10-02 · T01 done (99caed0): pnpm workspace scaffold, lint + typecheck green. Next: T02.
- 2026-10-02 · harness and architecture created; no code yet. Next: T01.
