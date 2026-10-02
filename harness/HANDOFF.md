# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T24 Deploy
- Doing now: nothing. Two settings on the API host have not taken effect; both are dashboard changes.
- Done this session: every task except T24. Commits: T01 99caed0, T02 a3a9a51, T03 faae2ce, T04 cf40909,
  T05 c72c4e9, T06 7989c47, T07 9f73fb0, T08 d3ddf06, T09 e88ca1f, T10 8a44e54, T11 d0716b6, T12 d07c44d,
  T13 0632125, T14 c81cc51, T19 13a1d8b, T15 8d29f2c, T16 b855757, T17 2ec76ca, T18 7d4a2ab, T20 + T21 5bc3e70,
  T22 71d3289, T23 e055972, T25 a185bd2.
- T24 progress: all three services are live and both URLs are recorded in STATE.
  - Database: Supabase, Tokyo. API: <https://talentlens-api-k0rp.onrender.com>, every endpoint verified.
  - Web: <https://talentlens-silk.vercel.app>. Every server-rendered page works against the live API.
- Next step, to finish T24. **Both are host settings, not code:**
  1. **`CORS_ORIGINS` matches no origin.** The API returns no `Access-Control-Allow-Origin` for
     `https://talentlens-silk.vercel.app`, for `http://localhost:3000`, or for anything else, and a preflight
     answers 204 with no CORS headers. That is an allowlist that rejects everything, so the value on the host is
     not the app's origin as a browser sends it — a trailing slash (`https://talentlens-silk.vercel.app/`) is
     the usual cause, a stale value or an unrestarted instance the other. The code now normalizes both sides
     (ADR-016), so once the service runs this commit a trailing slash no longer matters; check the value, then
     confirm the redeploy actually replaced the running instance.
  2. **No reranking model is configured on the API host.** `/api/match` returns `reranked: false` and
     `/api/jobs/score` returns `rewrittenTitle: null`. `GET /api/health` now reports
     `llm: "configured" | "not configured"`, so this can be read straight off the deployment instead of guessed.
     If it says `not configured`, `GEMINI_API_KEY` or `GEMINI_MODEL` is missing from the running process. If it
     says `configured` and matches still come back `reranked: false`, the call itself is failing and the reason
     is in the Render log as `match: rerank failed after 2 attempts (...)`.
  3. Then re-check: `/api/health` shows `llm: "configured"`; a *new* resume text returns `reranked: true` with
     fit scores; the app's origin gets an `Access-Control-Allow-Origin` header. Mark T24 done and add the live
     web link to the README status line.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - **The resume cache hides a model fix.** `/api/match` reuses a stored resume and its matches by text hash, so
    re-sending the same resume replays the old similarity-only answer however well the model is configured
    (ARCHITECTURE §7.4 step 2). Use different text, or `TRUNCATE matches, resumes;` first. This was mistaken for
    "the key still is not working" once already.
  - **The free Render instance is slow at embedding.** Live p50: keyword 102 ms, vector 730 ms, hybrid 757 ms
    server-side, against 1.3 / 8.7 / 14.4 ms locally. ARCHITECTURE §12 now says its budgets describe an
    unthrottled instance.
  - **A browser was never driven against the deployment.** The Chrome extension is not connected in this
    environment, so `/match` and `/score` were checked by fetching their HTML and by probing the API directly.
    Someone should click through both pages once CORS is fixed.
  - **A password with an unencoded `@` breaks the URL on some parsers and not others.** `packages/db/src/url.ts`
    rejects it everywhere now; write the `@` in `DATABASE_URL_PROD` in `.env` as `%40`.
  - **Never print or log `DATABASE_URL_PROD`.** It stays in `.env` only.
  - Production holds the corpus plus whatever the verifications wrote (a few `search_logs`, one resume and its
    matches). `TRUNCATE matches, resumes, search_logs;` clears them.
  - **Recall@10 and MRR@10 are unmeasured by design.** The 50 queries in `eval/queries.jsonl` have empty
    `relevant` lists. Only the owner labels: `pnpm --filter eval label`, then `pnpm eval`.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna.
  - Do not re-ingest for production: the Adzuna key is a trial key (ADR-014).
  - Reranking needs model thinking disabled to fit the 15 s timeout (ADR-012).
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (144 tests, 18 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All of them are done except T24, which is
blocked on deployment credentials.

## Log

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
