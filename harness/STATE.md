# TalentLens — State

Last updated: 2026-10-02 · Phase: **Day 1 — Foundation** · Next task: **T11**

Status values: `todo` · `in-progress` · `blocked (reason)` · `done (YYYY-MM-DD, <commit>)`

| ID | Task | Status |
| --- | --- | --- |
| T01 | Monorepo scaffold | done (2026-10-02, 99caed0) |
| T02 | Local Postgres | done (2026-10-02, a3a9a51) |
| T03 | Schema + migrations | done (2026-10-02, faae2ce) |
| T04 | Express skeleton | done (2026-10-02, cf40909) |
| T05 | CI | in-progress (pushed; run result needs GitHub auth to verify) |
| T06 | Remotive client | done (2026-10-02, 7989c47) |
| T07 | Adzuna client | done (2026-10-02, 9f73fb0) |
| T08 | Normalize, dedupe, upsert, CLI | done (2026-10-02, d3ddf06) |
| T09 | Embedding service | done (2026-10-02, e88ca1f) |
| T10 | Embedding backfill with cache | done (2026-10-02, 8a44e54) |
| T11 | Vector search endpoint | todo |
| T12 | Keyword search | todo |
| T13 | Hybrid RRF + pagination | todo |
| T14 | Rate limits + search logs + click | todo |
| T15 | Web scaffold | todo |
| T16 | Search page | todo |
| T17 | Job detail | todo |
| T18 | Resume upload UI | todo |
| T19 | Resume match endpoint | todo |
| T20 | Job ad scorer endpoint | todo |
| T21 | Match + scorer UI | todo |
| T22 | Evaluation tooling | todo |
| T23 | Test coverage pass | todo |
| T24 | Deploy | todo |
| T25 | README | todo |

## Measurements

Only measured values, each with the command that produced it and the commit.

| Metric | Value | Command | Commit |
| --- | --- | --- | --- |
| Jobs ingested | 7,141 (adzuna 7,125 · remotive 16); 3,124 companies | `pnpm --filter api ingest` then `select count(*) from jobs` | d3ddf06 |
| Embedding cache hit rate on re-ingest | 100% (7,141 of 7,141 skipped, 0 embedded) | `pnpm --filter api embed` run a second time | 8a44e54 |
| Embedding time per 1,000 jobs | 28.3 s (7,109 jobs in 200.8 s; CPU, fp32, Apple silicon) | `pnpm --filter api embed` | 8a44e54 |
| Recall@10 keyword / vector / hybrid | — | | |
| MRR@10 keyword / vector / hybrid | — | | |
| p50 latency keyword / vector / hybrid | — | | |

## Live URLs

- Web: —
- API: —

## Owner-only items

- Adzuna API keys, Gemini API key (owner creates accounts; agents never commit keys).
- Labeling the 50 eval queries (T22).
- Recording the demo GIF (T25).
