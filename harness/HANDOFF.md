# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T22 Evaluation tooling (reopened by the owner), with T24 still open on two host settings
- Doing now: nothing. Two separate blockers, both described below.
- T22 progress: the automated relevance judge is built, run and reported, and **it failed validation**.
  - `eval/rubric.ts` holds the versioned rubric, one rule per query type on top of a shared standard.
  - `eval/judge.ts` pools the top 20 from each mode, judges the whole pool in one call, caches verdicts by
    query id and content hash in `eval/judge-labels.jsonl`, and retries on bad JSON. It never writes to the
    owner's labels in `queries.jsonl`.
  - `eval/metrics.ts` holds Recall@10, Precision@10, nDCG@10, MRR@10 and Cohen's kappa as pure functions, with
    12 unit tests.
  - `pnpm eval` reports all four metrics per mode, a breakdown by query type, and the judge-versus-owner
    validation table, and it states its own verdict: below 0.6 kappa it marks the quality figures as not a
    result.
  - **Validation result: 78.5% raw agreement, Cohen's kappa -0.051, worse than chance.** Both labelers call
    nearly everything relevant (owner 86.1%, judge 91.0%), so raw agreement is near-automatic and carries no
    information. The metrics cannot separate the three modes either: nDCG@10 is 0.861 keyword, 0.855 vector,
    0.867 hybrid. ADR-017 records this as a method that did not work and lists what would have to change:
    pool deeper than 20 per mode so clearly irrelevant jobs enter, graded relevance instead of binary, or
    pairwise preference judgements between modes.
  - **Only 14 of 50 queries are judged.** The free Gemini tier allows 20 requests per day for this model. All
    14 are exact-title queries, the easiest type, so even the unpublished figures are unrepresentative.
- Next step, for T22, the owner's call:
  1. Decide whether to change the evaluation design (ADR-017 lists the options) or to hand-label with a
     stricter bar. Retrying the same judge will not help: the rubric is not the bottleneck, the leniency of
     binary absolute labels over an enriched pool is.
  2. A paid Gemini key, or several days, is needed to judge the remaining 36 queries whatever the design.
  3. `pnpm --filter eval judge --force` re-judges from scratch after a rubric change; `RUBRIC_VERSION` in
     `eval/rubric.ts` must be bumped so cached labels are invalidated.
- T24 progress: all three services are live, both URLs recorded. Two host settings have not taken effect:
  `CORS_ORIGINS` matches no origin, and no reranking model is configured. `GET /api/health` reports
  `llm: "configured" | "not configured"` so the second can be read off the deployment.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - **Raw agreement is not validation.** On a pool that is 85% relevant, two labelers who both say yes to
    everything agree 85% of the time while sharing no judgment at all. `pnpm eval` refuses to call a label set
    validated below 0.6 kappa for that reason; do not relax that bar to make a number publishable.
  - **The free Gemini tier is 20 requests per day and 5 per minute for gemini-2.5-flash.** The judge serializes
    calls 13 s apart and retries, which handles the per-minute limit but not the daily one.
  - **The resume cache hides a model fix.** `/api/match` replays a stored answer by resume text hash, so test a
    model change with new text or `TRUNCATE matches, resumes;` first.
  - **The free Render instance is slow at embedding**: live p50 keyword 102 ms, vector 730 ms, hybrid 757 ms,
    against 1.3 / 8.7 / 14.4 ms locally.
  - **A browser was never driven against the deployment** (the Chrome extension is not connected here).
  - **A password with an unencoded `@` breaks the URL on some parsers**; write it `%40` in `DATABASE_URL_PROD`.
  - **Never print or log `DATABASE_URL_PROD`.**
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna.
  - Do not re-ingest for production: the Adzuna key is a trial key (ADR-014).
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (156 tests, 20 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All of them are done except T24, which is
blocked on deployment credentials.

## Log

- 2026-10-02 · automated relevance judge built and run (ADR-017). It failed validation: kappa -0.051 against the owner's hand labels, and the metrics cannot separate the three modes. No quality number published. 14 of 50 queries judged before the free tier's 20-per-day cap.
- 2026-10-02 · web URL recorded and verified page by page; the API refuses every origin and still has no model configured, so T24 stays open. Added origin normalization, a fatal empty allowlist and llm status on /health (ADR-016).
- 2026-10-02 · live API verified end to end against production and recorded in STATE with its latency. T24 still open: the web URL arrived as a placeholder, and the model key is not set on Render.
- 2026-10-02 · first Render deploy failed on a malformed DATABASE_URL (unencoded @ in the password, host read as "base"). Added connection-string validation in packages/db and documented the percent-encoding; the fix itself is a dashboard change.
- 2026-10-02 · production truncated to the corpus only; render.yaml moved to the singapore region and the Neon references in ARCHITECTURE replaced with Supabase (ADR-015). Ready for Render.
- 2026-10-02 · production database loaded from the local container and verified row for row; Render and Vercel still outstanding.
- 2026-10-02 · T05 confirmed green on GitHub; marked done (c72c4e9). T24 will load Neon from a pg_dump of the local database instead of re-ingesting (ADR-014); waiting for the Neon URL.
- 2026-10-02 · T20, T21, T23 and T25 done (5bc3e70, e055972, a185bd2). Whole plan complete except T24, which needs Neon, Render and Vercel credentials. 131 tests green.
- 2026-10-02 · T22 done (71d3289): evaluation tooling; latency measured (p50 1.3/8.7/14.4 ms), recall awaits the owner's labels.
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
