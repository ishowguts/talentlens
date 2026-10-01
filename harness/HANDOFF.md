# TalentLens — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: T19 Resume match endpoint
- Doing now: `POST /api/match` end to end (ARCHITECTURE §7.4): PDF text via `unpdf` or JSON text, resume hash
  and reuse, chunked embedding, vector top 20, one LLM rerank call validated with zod, one retry, timeout, and
  the deterministic fallback that returns the vector top 10 with `reranked: false`.
- Done this session: T01 (99caed0), T02 (a3a9a51), T03 (faae2ce), T04 (cf40909), T05 (pushed; CI result not
  verifiable here), T06 (7989c47), T07 (9f73fb0), T08 (d3ddf06), T09 (e88ca1f), T10 (8a44e54), T11 (d0716b6),
  T12 (d07c44d), T13 (0632125), T14 (c81cc51).
- Next step: build the LLM client behind an interface with a fake for tests, then the match service, then the
  route; test valid output, invalid JSON then valid on retry, invalid twice (fallback), an invented job id,
  a non-PDF upload (400) and an oversized upload (413).
- Files in flight (uncommitted): none.
- Open problems / gotchas:
  - Task order for this session is the owner's: T01–T14, T19, T15–T18, T21, T22, T24, T25, with T20 last.
    T23 (test coverage pass) follows whatever remains.
  - T05 is `in-progress`: the workflow is pushed but neither `gh` nor a GitHub token is available here and the
    repository is private, so the run result could not be confirmed. The owner should check the Actions tab.
  - Search fuses in the API rather than in one SQL statement; ADR-011 explains why.
  - Tests never download the embedding model: `apps/api/test/fakeEmbedder.ts` is a deterministic bag-of-words
    embedder, and `globalSetup` migrates the test database and seeds 30 fixture jobs.
  - Remotive's public feed returns only 16 jobs whatever `limit` is passed, so the corpus is effectively Adzuna.
  - Adzuna's free tier has a small daily quota; a full ingest is ~150 requests. Use `--limit` while developing.
  - Local Node is v25.7.0 while `.nvmrc` and CI pin 20 (ARCHITECTURE §3). CI is the source of truth.
  - `psql` is not installed locally. Use `docker compose exec -T db psql -U postgres -d talentlens`.
  - A filled `.env` already exists. Never overwrite, print or log it. Only `.env.example` carries placeholders.

## Session plan (whole project, in this order)

T01–T14, T19, T15–T18, T21, T22, T24, T25, then T20 and T23 if time allows.

## Log

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
