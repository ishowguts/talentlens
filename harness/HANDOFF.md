# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T24 Deploy
- Doing now: nothing. Two inputs are missing, both on the owner's side (see Next step).
- Done this session: every task except T24. T05 is green on GitHub (c72c4e9). Commits: T01 99caed0, T02 a3a9a51,
  T03 faae2ce, T04 cf40909, T05 c72c4e9, T06 7989c47, T07 9f73fb0, T08 d3ddf06, T09 e88ca1f, T10 8a44e54,
  T11 d0716b6, T12 d07c44d, T13 0632125, T14 c81cc51, T19 13a1d8b, T15 8d29f2c, T16 b855757, T17 2ec76ca,
  T18 7d4a2ab, T20 + T21 5bc3e70, T22 71d3289, T23 e055972, T25 a185bd2.
- T24 progress: the database (Supabase, Tokyo) and the API (Render, `singapore`,
  <https://talentlens-api-k0rp.onrender.com>) are live and verified end to end. Every endpoint was exercised
  against production: health, stats, all three search modes, job detail, click logging, match, score, plus a 404
  and a 400 in the documented error shape. Production latency is recorded in STATE.
- Next step, to finish T24:
  1. **Set `GEMINI_API_KEY` and `GEMINI_MODEL` (`gemini-2.5-flash`) on the Render service.** They are not set:
     `/api/match` returns `reranked: false` and `/api/jobs/score` returns `rewrittenTitle: null`. A match takes
     3.3 s with no model wait at all, which is the signature of `createLlmClient` returning null because a
     variable is missing, rather than a call that failed. Both endpoints are behaving exactly as ADR-008 says
     they should; they simply have no model to call.
  2. **Record the web URL.** The message that reported it contained the literal placeholder `<vercel url>`, so
     nothing was written down and the browser path could not be verified. With the real URL: check that a search
     renders, that `/jobs/[id]` opens, and that `/match` accepts a PDF, then set `CORS_ORIGINS` on Render to that
     origin (an arbitrary origin is correctly refused today, so the allowlist is active and must name it), and
     add the link to STATE and to the README status line.
  3. Then T24 is done and T25 needs only the demo GIF, which is the owner's to record.
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - **The free Render instance is slow at embedding.** Live p50: keyword 102 ms, vector 730 ms, hybrid 757 ms
    server-side, against 1.3 / 8.7 / 14.4 ms locally. Keyword is mostly the Singapore-to-Tokyo round trip; the
    rest is MiniLM on a throttled shared CPU. ARCHITECTURE §12 now says the budgets describe an unthrottled
    instance. A paid instance, or a hosted embedding API behind the existing `Embedder` interface, is the fix if
    this ever needs to be fast.
  - **A password with an unencoded `@` breaks the URL on some parsers and not others.** It parsed under the Node
    version on this machine but not under Render's Node 20, which is why the first deploy failed rather than
    local development. `packages/db/src/url.ts` rejects it everywhere now, so `.env` should be fixed too: write
    the `@` in `DATABASE_URL_PROD` as `%40`. Until then `pnpm --filter db migrate` against production fails on
    purpose.
  - **Never print or log `DATABASE_URL_PROD`.** It stays in `.env` only.
  - Production holds the corpus and nothing else, apart from what the verification wrote: a handful of
    `search_logs` rows and one resume with its matches. `TRUNCATE matches, resumes, search_logs;` clears them.
  - **Recall@10 and MRR@10 are unmeasured by design.** The 50 queries in `eval/queries.jsonl` have empty
    `relevant` lists. Only the owner labels: `pnpm --filter eval label`, then `pnpm eval`.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna.
  - Do not re-ingest for production: the Adzuna key is a trial key (ADR-014).
  - Reranking needs model thinking disabled to fit the 15 s timeout (ADR-012).
  - Hybrid search never returns an empty list, because the vector leg always returns its nearest neighbours.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed on the host. Use `docker compose exec -T db psql -U postgres -d talentlens`.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test` (136 tests, 17 files, green)

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23. All of them are done except T24, which is
blocked on deployment credentials.

## Log

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
