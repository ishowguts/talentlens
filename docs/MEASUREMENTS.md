# TalentLens measurement record

Historical measurements recorded during development in October 2026. These are not a current deployment health check.

Only measured values, each with the command that produced it and the commit.

| Metric | Value | Command | Commit |
| --- | --- | --- | --- |
| Jobs ingested | 7,141 (adzuna 7,125 · remotive 16); 3,124 companies | `pnpm --filter api ingest` then `select count(*) from jobs` | d3ddf06 |
| Embedding cache hit rate on re-ingest | 100% (7,141 of 7,141 skipped, 0 embedded) | `pnpm --filter api embed` run a second time | 8a44e54 |
| Embedding time per 1,000 jobs | 28.3 s (7,109 jobs in 200.8 s; CPU, fp32, Apple silicon) | `pnpm --filter api embed` | 8a44e54 |
| Recall@10 keyword / vector / hybrid | — not published. Computable (hybrid 0.271 / vector 0.253 / keyword 0.264 on 14 title-only queries) but the label set failed validation, so the figures describe the labels, not the engine | `pnpm eval` | |
| MRR@10 keyword / vector / hybrid | — not published, same reason as Recall@10 | `pnpm eval` | |
| Judge vs owner agreement, 10 queries | 78.5% raw, Cohen's kappa -0.051 (worse than chance); 410 jobs labeled by both; relevant share 86.1% owner vs 91.0% judge | `pnpm eval` | pending |
| p50 latency keyword / vector / hybrid | 1.3 ms / 8.7 ms / 14.4 ms (means 2.4 / 10.3 / 20.6 ms; 50 queries, 7,141 jobs, warm, local Docker Postgres) | `pnpm eval` | 71d3289 |
| Endpoint tests | 131 tests, 16 files, all green | `pnpm test` | e055972 |
| Search latency on the live API, p50 | keyword 102 ms · vector 730 ms · hybrid 757 ms server-side (total from a laptop in another region: 443 / 1,037 / 1,056 ms). 10 queries per mode, warm. Far above the local figures because query embedding runs on a free Render instance with a throttled shared CPU; the database round trip (Singapore to Tokyo) accounts for the keyword number | 10 queries per mode against `/api/search`, after a warm-up request per mode | 1456ac4 |
| Resume match latency, with rerank | 4.0 / 5.3 / 9.0 s over three local runs on the 7,141-job corpus (gemini-3.8-flash, thinking off), all inside the 15 s timeout; 7.5 s previously on the retired gemini-2.5-flash | `POST /api/match` with fresh resume text, local API | d0516eb |
