# AGENTS.md — TalentLens

This is the operating manual for any coding agent or human working in this repo.
Read all of it before touching code. It is short on purpose. Every rule here is binding.

TalentLens is a semantic job search engine and resume matcher: Next.js frontend, Node.js + Express REST API in
TypeScript, PostgreSQL + pgvector, local embeddings, hybrid keyword + vector search, LLM reranking. Design:
`docs/ARCHITECTURE.md`. Plan: `harness/TASKS.md`. Where things stand: `harness/STATE.md` and `harness/HANDOFF.md`.

## Rule 0: Ownership (hard rule, no exceptions)

The only author, committer, and contributor of this project is **Bittu Mandal** (GitHub: `ishowguts`).

- Every commit uses exactly this identity: `Bittu Mandal <209128489+ishowguts@users.noreply.github.com>`.
  `scripts/setup.sh` pins it in the local git config. Never change it.
- No co-author, sign-off or "assisted" trailers (any `Something-by:` line) and no "generated with" footers. No tool, assistant, model or vendor name
  in commit messages, PR titles or descriptions, code comments, docs, file names, or the README. No robot emoji.
- No tool-specific config folders or instruction files are committed. This file (`AGENTS.md`) is the single,
  tool-neutral instruction file. If your tool needs its own pointer file, create it locally and keep it out of git
  (add it to `.git/info/exclude`, never to `.gitignore`).
- Commit messages describe the change only, in Conventional Commit style: `feat(api): add hybrid search endpoint`.
- The guard (`scripts/guard.mjs`) enforces this in the pre-commit, commit-msg and pre-push hooks and in CI.
  **Never** use `--no-verify`, never edit or weaken the guard, never rewrite its patterns. If the guard blocks you,
  fix the commit (`git commit --amend`, reword, re-stage), not the guard.
- Do not open PRs, issues, or comments on GitHub unless the owner asks. When asked, the same rules apply to their text.

## Rule 1: Context survives agent switches

Work may stop at any moment (usage limit, crash, the owner switching tools). The next agent has **only the repo**.
So the repo, not your memory, holds the state.

| File | What it holds | When you write it |
| --- | --- | --- |
| `harness/HANDOFF.md` | The live baton: current task, exact next step, files in flight, gotchas | **Before** each step and after it |
| `harness/STATE.md` | Status of every task ID, current phase, measured numbers | When a task changes status |
| `harness/TASKS.md` | The full task list with acceptance criteria | Only to add/split tasks (never delete) |
| `harness/DECISIONS.md` | Every non-obvious technical decision (ADR log) | When you decide something a successor might undo |
| `harness/CONTEXT.md` | Product brief, goals, non-goals, the questions the design must answer | Rarely |
| `docs/ARCHITECTURE.md` | System design: components, data model, API contracts, layout | When the design changes |

### Session start (always, in this order)

1. Read `AGENTS.md` (this file), then `harness/HANDOFF.md`, then `harness/STATE.md`.
2. Run `git status`, `git log --oneline -15`, and `git diff HEAD --stat`.
3. If HANDOFF's Active session says `IN PROGRESS`, the previous agent was cut off. Run the **recovery check** below
   before doing anything else.
4. Read the relevant sections of `docs/ARCHITECTURE.md` and the task's entry in `harness/TASKS.md`.
5. Overwrite the Active session block in HANDOFF with your plan for this session, then start.

### Recovery check (previous session was cut off)

1. Compare uncommitted changes (`git diff HEAD`) with the task's acceptance criteria and HANDOFF's "Next step".
2. Run the project checks (see Commands). Broken build or failing tests from half-done work: finish or revert that
   step, do not start a new one.
3. Write one line in the HANDOFF log: `recovered <TASK-ID>: <what you found>`. Then continue the same task.
4. Never discard uncommitted work you do not understand. Stash it with a clear name (`git stash push -m "recovered <TASK-ID>"`) and note it in HANDOFF.

### Work loop (write-ahead, small steps)

1. Pick the lowest-numbered task in STATE that is `todo` and whose dependencies are `done`.
   Never work on two tasks at once.
2. **Before** a step: put it in HANDOFF ("Doing now" + "Next step"). A cut-off mid-step must still leave the plan on disk.
3. Do the step. Keep steps small enough to finish and verify in a few minutes.
4. **After** the step: verify (typecheck/test/run), update HANDOFF, then commit.
   Use `scripts/checkpoint.sh <TASK-ID> "<done / next>"` for work-in-progress commits.
5. When every acceptance criterion of the task holds: mark it `done` in STATE with the date and the commit hash,
   commit as `feat(...)`/`fix(...)` etc., push.
6. Commit at least every 30 minutes of work or every meaningful step, whichever comes first. Push after each task.

### Session end (or when you sense you are near a limit)

Stop starting new steps. Make sure HANDOFF has: task ID, status, what is done, exact next command or edit,
files touched, open problems, and anything you learned that is not in the docs. Commit and push. A successor must
be able to continue from HANDOFF alone without asking a question.

## Rule 2: Engineering standards

- TypeScript `strict` everywhere. No `any` unless commented why. No unused code left behind.
- Validate every external input with zod at the boundary (HTTP bodies, query params, env vars, third-party API
  responses, model output). Shared schemas live in `packages/shared`.
- All SQL changes go through migrations. Never edit a migration that has been committed; add a new one.
- Secrets only in `.env` (git-ignored). Every new env var goes into `.env.example` and the env table in
  `docs/ARCHITECTURE.md` in the same commit.
- Every endpoint gets at least one happy-path and one failure-path test before its task is `done`.
- Measured numbers (latency, recall, cost) go in `harness/STATE.md` under Measurements with the command that
  produced them. Never write a number in the README that was not measured.
- Do not add a dependency without a line in `harness/DECISIONS.md` when it is a framework-level choice.
- Do not change the stack, schema or API contracts in `docs/ARCHITECTURE.md` silently. Change the doc and add an ADR
  in the same commit.
- Keep the README honest: status, how to run, architecture diagram, measured results. No marketing language.

## Commands

| Purpose | Command |
| --- | --- |
| First-time setup (identity + guard hooks) | `sh scripts/setup.sh` |
| Install | `pnpm install` |
| Database up | `docker compose up -d` |
| Migrate | `pnpm --filter db migrate` |
| Ingest jobs / embed | `pnpm --filter api ingest` · `pnpm --filter api embed` |
| Dev servers | `pnpm --filter api dev` (port 4000) · `pnpm --filter web dev` (port 3000) |
| Checks (run before every commit) | `pnpm lint && pnpm typecheck && pnpm test` |
| Evaluation | `pnpm eval` |
| Ownership guard, full scan | `node scripts/guard.mjs all` |
| Checkpoint commit | `sh scripts/checkpoint.sh T07 "done X, next Y"` |

Before the monorepo exists (task T01), only the harness and docs are present.

## File map

```
AGENTS.md                 this manual
docs/ARCHITECTURE.md      design contract (stack, schema, API, algorithms, config, deploy)
harness/HANDOFF.md        live baton between sessions
harness/STATE.md          task status + measurements + live URLs
harness/TASKS.md          T01..T25 with acceptance criteria
harness/DECISIONS.md      ADR log
harness/CONTEXT.md        product brief, goals, non-goals
scripts/guard.mjs         ownership guard (do not modify)
scripts/setup.sh          pins identity, enables hooks
scripts/checkpoint.sh     WIP commit helper
.githooks/                pre-commit, commit-msg, pre-push -> guard
.github/workflows/        guard.yml (do not modify), ci.yml (added in T05)
apps/ packages/ eval/     created from T01 onward, layout in ARCHITECTURE §4
```
