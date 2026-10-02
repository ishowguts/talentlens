# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T22 Evaluation tooling — the only task still open. T24 is done.
- Doing now: nothing. T22 needs a design decision from the owner (below).
- T24 is done (2026-10-03). All three services are live and verified end to end:
  - Database: Supabase, Tokyo, 7,141 jobs and 7,141 embeddings, copied from local (ADR-014).
  - API: <https://talentlens-api-k0rp.onrender.com>, Render `singapore`. Every endpoint exercised against
    production, including the failure paths. `/api/health` reports `db: "ok"`, `llm: "configured"`, 7,141 jobs.
  - Web: <https://talentlens-silk.vercel.app>, Vercel. Pages render against the live API and browser-side calls
    work: the API returns `access-control-allow-origin` for this origin on search, click and score, answers the
    preflight 204 with `GET,POST` and `content-type`, and returns no header for a foreign origin.
  - Reranking confirmed on production: `/api/match` returned `reranked: true` with fit scores 95/90/88/85 and
    grounded reasons, and `/api/jobs/score` returned a rewritten title and three suggested edits.
- T22, the open task: the automated relevance judge is built and run, and **its labels failed validation**
  (Cohen's kappa -0.051 against the owner's hand labels; both labelers call ~9 in 10 pooled jobs relevant). The
  metrics cannot separate the three modes: nDCG@10 is 0.861 keyword, 0.855 vector, 0.867 hybrid. No search
  quality number is published anywhere. ADR-017 records the method and the failure.
- Next step for T22, the owner's call: change the evaluation design rather than retrying the judge. The options,
  cheapest first: pool deeper than 20 per mode so clearly irrelevant jobs enter the pool; move to graded
  relevance (0-3) instead of binary; or judge pairwise preferences between modes, which is robust to a lenient
  absolute scale. Bump `RUBRIC_VERSION` in `eval/rubric.ts` on any rubric change so cached labels are
  invalidated, then `pnpm --filter eval judge --force`.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - **Verify a negative result with a second tool before acting on it.** A CORS outage was reported here that
    never existed: the probe built a plain dictionary from the response headers and looked up
    `Access-Control-Allow-Origin` case-sensitively, while the header arrives lower-cased over HTTP/2. `curl -D -`
    showed it present all along. ADR-018 records the correction. Use `r.headers.get(...)`, which is
    case-insensitive, or curl.
  - **The model is `gemini-3.8-flash`** (ADR-019); `gemini-2.5-flash` was retired for new keys. `thinkingBudget:
    0` is still the right switch and `thinkingLevel: 'MINIMAL'` is rejected by this model, so do not "modernize"
    that config without measuring.
  - **Free-tier quotas bite.** On the retired model's key the limits were 20 requests per day and 5 per minute,
    which is what stopped the judge at 14 of 50 queries. The new key's limits have not been measured. When the
    quota is spent the deployment falls back to similarity-only matches and an unannotated score, which is
    ADR-008 behaving correctly, not a fault. A transient `503 UNAVAILABLE` from the model produces the same
    fallback and was seen once during the ADR-019 verification.
  - **Two local traps cost time during the ADR-019 check, both worth remembering:** a stale dev server kept port
    4000 and served the retired model, because the new one failed to start with `EADDRINUSE` and the failure was
    only in its log (`lsof -ti tcp:4000 | xargs kill -9` first); and the resume hash cache replayed the failed
    results instantly afterwards (`TRUNCATE matches, resumes;` before re-testing).
  - **The resume cache hides a model change.** `/api/match` replays a stored answer by resume text hash. Test
    with new text, or `TRUNCATE matches, resumes;` first.
  - **The free Render instance is slow at embedding**: live p50 keyword 102 ms, vector 730 ms, hybrid 757 ms,
    against 1.3 / 8.7 / 14.4 ms locally. ARCHITECTURE §12 says its budgets describe an unthrottled instance.
  - **A browser was never driven against the deployment** (the Chrome extension is not connected here). Pages
    and API calls were verified over HTTP; a manual click-through of `/match` and `/score` is still worth doing.
  - **A password with an unencoded `@` breaks the URL on some parsers**; write it `%40` in `DATABASE_URL_PROD`.
  - **Never print or log `DATABASE_URL_PROD`.**
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna.
  - Do not re-ingest for production: the Adzuna key is a trial key (ADR-014).
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (159 tests, 20 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All done and deployed except T22, which is open
on a design decision: its automated labels failed validation.

## Log

- 2026-10-03 · T24 done: CORS, reranking and the scorer all verified against production. The earlier CORS outage was my own measurement error, corrected in ADR-018. T22 is the only open task.
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
