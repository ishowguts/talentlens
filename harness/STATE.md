# TalentLens — State

Last updated: 2026-10-02 · Phase: **Day 7 — Prove it, ship it** · Next task: **T24** (waiting for the Neon URL) · every other task is done (owner's order: T01–T14, T19, T15–T18, T21, T22, T24, T25, T20 last)

Status values: `todo` · `in-progress` · `blocked (reason)` · `done (YYYY-MM-DD, <commit>)`

| ID | Task | Status |
| --- | --- | --- |
| T01 | Monorepo scaffold | done (2026-10-02, 99caed0) |
| T02 | Local Postgres | done (2026-10-02, a3a9a51) |
| T03 | Schema + migrations | done (2026-10-02, faae2ce) |
| T04 | Express skeleton | done (2026-10-02, cf40909) |
| T05 | CI | done (2026-10-02, c72c4e9) · ci and ownership-guard both green on GitHub |
| T06 | Remotive client | done (2026-10-02, 7989c47) |
| T07 | Adzuna client | done (2026-10-02, 9f73fb0) |
| T08 | Normalize, dedupe, upsert, CLI | done (2026-10-02, d3ddf06) |
| T09 | Embedding service | done (2026-10-02, e88ca1f) |
| T10 | Embedding backfill with cache | done (2026-10-02, 8a44e54) |
| T11 | Vector search endpoint | done (2026-10-02, d0716b6) |
| T12 | Keyword search | done (2026-10-02, d07c44d) |
| T13 | Hybrid RRF + pagination | done (2026-10-02, 0632125) |
| T14 | Rate limits + search logs + click | done (2026-10-02, c81cc51) |
| T15 | Web scaffold | done (2026-10-02, 8d29f2c) |
| T16 | Search page | done (2026-10-02, b855757) |
| T17 | Job detail | done (2026-10-02, 2ec76ca) |
| T18 | Resume upload UI | done (2026-10-02, 7d4a2ab) |
| T19 | Resume match endpoint | done (2026-10-02, 13a1d8b) |
| T20 | Job ad scorer endpoint | done (2026-10-02, 5bc3e70) |
| T21 | Match + scorer UI | done (2026-10-02, 5bc3e70) |
| T22 | Evaluation tooling | done (2026-10-02, 71d3289) · Recall/MRR await the owner labeling the 50 queries |
| T23 | Test coverage pass | done (2026-10-02, e055972) |
| T24 | Deploy | blocked (needs the owner: Neon, Render and Vercel accounts and their credentials) |
| T25 | README | done (2026-10-02, a185bd2) · the live link and the demo GIF wait on T24 |

## Measurements

Only measured values, each with the command that produced it and the commit.

| Metric | Value | Command | Commit |
| --- | --- | --- | --- |
| Jobs ingested | 7,141 (adzuna 7,125 · remotive 16); 3,124 companies | `pnpm --filter api ingest` then `select count(*) from jobs` | d3ddf06 |
| Embedding cache hit rate on re-ingest | 100% (7,141 of 7,141 skipped, 0 embedded) | `pnpm --filter api embed` run a second time | 8a44e54 |
| Embedding time per 1,000 jobs | 28.3 s (7,109 jobs in 200.8 s; CPU, fp32, Apple silicon) | `pnpm --filter api embed` | 8a44e54 |
| Recall@10 keyword / vector / hybrid | — (needs the owner to label `eval/queries.jsonl`) | `pnpm --filter eval label` then `pnpm eval` | |
| MRR@10 keyword / vector / hybrid | — (needs the owner to label `eval/queries.jsonl`) | `pnpm --filter eval label` then `pnpm eval` | |
| p50 latency keyword / vector / hybrid | 1.3 ms / 8.7 ms / 14.4 ms (means 2.4 / 10.3 / 20.6 ms; 50 queries, 7,141 jobs, warm, local Docker Postgres) | `pnpm eval` | 71d3289 |
| Endpoint tests | 131 tests, 16 files, all green | `pnpm test` | e055972 |
| Resume match latency, with rerank | 7.5 s end to end (PDF upload, 10 results, gemini-2.5-flash, thinking off) | `curl -X POST /api/match -F file=@apps/api/test/fixtures/resume.pdf` | f038a32 |

## Live URLs

- Web: —
- API: —

## Owner-only items

- Adzuna API keys, Gemini API key (owner creates accounts; agents never commit keys).
- Labeling the 50 eval queries (T22).
- Recording the demo GIF (T25).
