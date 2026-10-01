# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T22 Evaluation tooling
- Doing now: `eval/` — `label.ts` (TREC-style pooling of the top 20 from each mode, shuffled, y/n prompts) and
  `run.ts` (Recall@10, MRR@10 and mean latency per mode into `eval/results.md`), per ARCHITECTURE §8.
  The 50 relevance judgements are the owner's work: agents build the tool and must not label or invent them.
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909), T05 (pushed; unverified),
  T06 (7989c47), T07 (9f73fb0), T08 (d3ddf06), T09 (e88ca1f), T10 (8a44e54), T11 (d0716b6), T12 (d07c44d),
  T13 (0632125), T14 (c81cc51), T19 (13a1d8b), T15 (8d29f2c), T16 (b855757), T17 (2ec76ca), T18 (7d4a2ab),
  T21 match half (f038a32).
- Next step: write `eval/queries.jsonl` with the 50 query strings only (no relevance lists), build the labeling
  and scoring CLIs, confirm `pnpm eval` runs and reports "no labeled queries yet" cleanly, then commit and
  start T24 (deploy).
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - T21 is `in-progress` on purpose: the match UI is done, the `/score` page is part of T20, which the owner put
    last. Finish `/score` in the same change as T20.
  - T05 is `in-progress`: the workflow is pushed but neither `gh` nor a GitHub token is available here and the
    repository is private, so the run result could not be confirmed. The owner should check the Actions tab.
  - Reranking needs thinking disabled to fit the 15 s timeout (ADR-012). Verified live: 7.5 s end to end,
    fit scores and reasons returned.
  - The `/match` page is a client component; its upload path was verified against the live API with curl, not
    through a browser. A browser pass is worth doing before the demo.
  - Hybrid search never returns an empty list, because the vector leg always returns its nearest neighbours.
    Only `mode=keyword` can come back empty.
  - Dev servers currently running locally: `pnpm --filter api dev` (4000) and `pnpm --filter web dev` (3000).
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

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
