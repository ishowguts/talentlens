# TalentLens — Architecture

Status: design baseline, 2026-10-02. This document is the contract. Code follows it; when code must differ,
this file and `harness/DECISIONS.md` change in the same commit.

## 1. What it is

A semantic job search engine and resume matcher over thousands of real job postings.

- **Candidate:** uploads a resume, gets ranked jobs with a short explanation of fit and missing skills.
- **Recruiter:** pastes a job ad, gets a quality score, flagged wording, and a search-friendly title rewrite.
- **Search:** keyword, vector, and hybrid (Reciprocal Rank Fusion) over the same corpus, with filters.
- **Evaluation:** a labeled query set measures Recall@10 for keyword vs vector vs hybrid. That number is the
  headline result in the README.

## 2. System diagram

```mermaid
flowchart LR
  subgraph Sources
    R[Remotive API]
    A[Adzuna API]
  end
  subgraph API["apps/api (Node.js + Express, TypeScript)"]
    ING[Ingestion job]
    EMB[Embedding service<br/>all-MiniLM-L6-v2, 384-d]
    SRCH[Search service<br/>keyword / vector / hybrid RRF]
    MATCH[Match service<br/>vector top-20 → LLM rerank top-10]
    SCORE[Job ad scorer<br/>rules + LLM rewrite]
    LLM[LLM client<br/>Gemini, JSON mode + zod]
  end
  DB[(PostgreSQL 16 + pgvector<br/>tsvector GIN + HNSW)]
  WEB[apps/web<br/>Next.js 14 App Router]

  R --> ING
  A --> ING
  ING -->|upsert by content_hash| DB
  ING --> EMB --> DB
  WEB -->|REST JSON| SRCH & MATCH & SCORE
  SRCH --> DB
  SRCH --> EMB
  MATCH --> EMB
  MATCH --> DB
  MATCH --> LLM
  SCORE --> LLM
```

## 3. Stack (fixed; changes need an ADR)

| Layer | Choice |
| --- | --- |
| Language | TypeScript 5, `strict`, ESM, Node.js 20 LTS |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 14 App Router, React 18, Tailwind CSS |
| Backend | Express 4, zod, pino + pino-http, express-rate-limit, multer, helmet, cors |
| Database | PostgreSQL 16 + pgvector ≥ 0.8 locally (Docker); Supabase (PostgreSQL 17, pgvector 0.8) in prod, see ADR-015 |
| ORM / migrations | Drizzle ORM + drizzle-kit; migrations generated from the schema, with raw SQL statements added to a generated file when Drizzle cannot express something |
| Embeddings | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (Transformers.js), 384-d, mean pooling, L2-normalized, runs in-process |
| LLM | Gemini via `@google/genai`, JSON response mode, output validated with zod |
| PDF text | `unpdf` |
| Tests | Vitest + Supertest against a real Postgres (Docker, separate `talentlens_test` DB) |
| CI | GitHub Actions: guard, lint, typecheck, test |
| Deploy | Vercel (web), Render (api, `singapore`), Supabase (Postgres + pgvector, Tokyo); see ADR-015 |

## 4. Repository layout

```
talentlens/
├─ AGENTS.md                  operating manual (read first)
├─ harness/                   HANDOFF, STATE, TASKS, DECISIONS, CONTEXT
├─ docs/ARCHITECTURE.md       this file
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ server.ts         listen(); graceful shutdown
│  │  │  ├─ app.ts            createApp(): middleware + routes (imported by tests)
│  │  │  ├─ env.ts            zod-parsed env, fails fast on boot
│  │  │  ├─ routes/           health.ts, search.ts, jobs.ts, match.ts, stats.ts
│  │  │  ├─ services/         search.ts, match.ts, scorer.ts, embeddings.ts, llm.ts
│  │  │  ├─ ingest/           remotive.ts, adzuna.ts, normalize.ts, run.ts (CLI entry)
│  │  │  ├─ middleware/       error.ts, validate.ts, rateLimit.ts, requestId.ts
│  │  │  └─ lib/              hash.ts, text.ts, biasTerms.ts
│  │  └─ test/                *.test.ts (Vitest + Supertest)
│  └─ web/
│     └─ src/app/             / (search), /jobs/[id], /match, /score
├─ packages/
│  ├─ db/                     schema.ts, client.ts, migrations/
│  └─ shared/                 zod schemas + inferred types shared by api and web
├─ eval/
│  ├─ queries.jsonl           50 labeled queries (owner-labeled)
│  ├─ label.ts                pooling + interactive labeling CLI
│  └─ run.ts                  computes Recall@10, MRR@10 per mode → eval/results.md
├─ docker-compose.yml         postgres (pgvector/pgvector:pg16)
├─ .env.example
└─ scripts/                   guard.mjs, setup.sh, checkpoint.sh
```

## 5. Data model

Postgres extensions: `vector`, `pg_trgm` (optional, for company name lookup).

```sql
CREATE TABLE companies (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  name_norm   text NOT NULL UNIQUE           -- lower(trim(name)), collapsed spaces
);

CREATE TABLE jobs (
  id            bigserial PRIMARY KEY,
  company_id    bigint REFERENCES companies(id),
  title         text NOT NULL,
  description   text NOT NULL,               -- plain text, HTML stripped
  location      text,
  country       text,                        -- ISO-2 when known
  is_remote     boolean NOT NULL DEFAULT false,
  salary_min    integer,                     -- annual, in salary_currency
  salary_max    integer,
  salary_currency text,
  posted_at     timestamptz,
  source        text NOT NULL CHECK (source IN ('remotive','adzuna')),
  source_id     text NOT NULL,
  url           text NOT NULL,
  content_hash  text NOT NULL UNIQUE,        -- sha256 of normalized content, see §7.1
  search_tsv    tsvector GENERATED ALWAYS AS (
                  setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
                  setweight(to_tsvector('english', coalesce(description,'')), 'B')
                ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE INDEX jobs_search_tsv_gin ON jobs USING gin (search_tsv);
CREATE INDEX jobs_posted_at_idx  ON jobs (posted_at DESC);
CREATE INDEX jobs_filters_idx    ON jobs (is_remote, country);

CREATE TABLE job_embeddings (
  job_id      bigint PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  model       text NOT NULL,
  content_hash text NOT NULL,                -- hash the vector was computed from (cache key)
  embedding   vector(384) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_embeddings_hnsw ON job_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE resumes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash   text NOT NULL UNIQUE,
  text        text NOT NULL,
  embedding   vector(384) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  resume_id   uuid   REFERENCES resumes(id) ON DELETE CASCADE,
  job_id      bigint REFERENCES jobs(id) ON DELETE CASCADE,
  vector_score real  NOT NULL,
  fit_score   smallint,                      -- 0..100 from LLM, null if rerank failed
  explanation jsonb,                         -- { reasons: string[], missingSkills: string[] }
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resume_id, job_id)
);

CREATE TABLE search_logs (
  id             bigserial PRIMARY KEY,
  query          text NOT NULL,
  mode           text NOT NULL CHECK (mode IN ('keyword','vector','hybrid')),
  filters        jsonb NOT NULL DEFAULT '{}',
  latency_ms     integer NOT NULL,
  result_ids     bigint[] NOT NULL,
  clicked_job_id bigint REFERENCES jobs(id),
  clicked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

Notes:
- `search_tsv` is declared in the Drizzle schema as a `customType` tsvector with `generatedAlwaysAs`, and the GIN
  and HNSW indexes are declared there too, so `drizzle-kit generate` emits all of them (see ADR-009). Only
  `CREATE EXTENSION IF NOT EXISTS vector` is added to the generated file by hand, so a fresh database (the
  production one included) can be migrated without a manual step.
- Salary is normalized to annual. Adzuna gives annual figures; Remotive gives a free-text `salary` string, parsed
  best-effort (§7.1), left null when unparseable.

## 6. API contract (all JSON, prefix `/api`)

Errors always look like `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": ... }, "requestId": "..." }`
with codes `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429),
`UPSTREAM_ERROR` (502), `INTERNAL` (500). Every response carries `x-request-id`.

| Method & path | Request | Response |
| --- | --- | --- |
| `GET /health` | — | `{ status: "ok", db: "ok"\|"down", embeddingModel, jobs: number }` |
| `GET /search` | query: `q` (1–200 chars, required), `mode` = `hybrid`\|`vector`\|`keyword` (default `hybrid`), `remote` (bool), `country` (ISO-2), `salaryMin` (int), `page` (≥1), `pageSize` (1–50, default 20) | `{ results: [{ job: JobSummary, score: number, ranks: { keyword: number\|null, vector: number\|null } }], page, pageSize, hasMore, logId, latencyMs }` |
| `POST /search/click` | `{ logId: number, jobId: number }` | `204` |
| `GET /jobs/:id` | — | `Job` (full description, url, source) |
| `POST /match` | `multipart/form-data` with `file` (PDF, ≤ 2 MB) **or** JSON `{ text: string (200–20000 chars) }` | `{ resumeId, reranked: boolean, matches: [{ job: JobSummary, vectorScore, fitScore: number\|null, reasons: string[], missingSkills: string[] }] }` (10 items) |
| `POST /jobs/score` | `{ title (3–150), description (50–20000), location?, salaryMin?, salaryMax? }` | `{ score: 0..100, checks: [{ id, label, pass: boolean, detail }], flaggedTerms: [{ term, reason, suggestion }], rewrittenTitle: string\|null, notes: string[] }` |
| `GET /stats` | — | `{ jobs, embedded, bySource: { remotive, adzuna }, lastIngestAt }` |

`JobSummary = { id, title, company, location, isRemote, salaryMin, salaryMax, salaryCurrency, postedAt, snippet }`.
All request/response schemas are defined once in `packages/shared` and imported by both apps.

Rate limits (per IP, express-rate-limit, in-memory store): `/search` 60/min, `/match` 5/min, `/jobs/score` 10/min.

## 7. Core flows

### 7.1 Ingestion (`pnpm --filter api ingest [--source remotive|adzuna] [--limit N]`)

1. **Fetch.**
   - Remotive: `GET https://remotive.com/api/remote-jobs` (no key). Their terms ask for a link back to the original
     posting and credit to Remotive, and only a few requests a day. Store `url`, show "via Remotive" in the UI.
   - Adzuna: `GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?app_id&app_key&results_per_page=50&what=<term>`
     for countries `ADZUNA_COUNTRIES` (default `in,gb,us`) and a fixed list of tech search terms. Adzuna returns a
     truncated description snippet; keep it and the `redirect_url`. Sleep between calls; stop at `--limit`.
   - Every third-party response is parsed with a zod schema; malformed items are counted and skipped, never crash.
2. **Normalize.** Strip HTML to text, collapse whitespace, trim; `is_remote` from source flag or `/remote/i` in
   location; country to ISO-2; salary to annual integers.
3. **Dedupe.** `content_hash = sha256(lower(title) | lower(company_norm) | lower(location) | first 2000 chars of
   lower(description))`. Insert with `ON CONFLICT (content_hash) DO NOTHING`; `(source, source_id)` conflict updates
   `posted_at`/`url` only. The same job posted on both sources collapses to one row.
4. **Embed new or changed jobs only.** Select jobs with no `job_embeddings` row or whose stored `content_hash`
   differs; embed in batches of 32; upsert. Log `embedded=N skipped_cached=M` so the cache hit rate is measurable.

Target: ≥ 5,000 jobs after T08. Ingestion is idempotent: running it twice adds 0 rows the second time.

### 7.2 Embeddings

- Model `Xenova/all-MiniLM-L6-v2`, feature-extraction pipeline, `pooling: 'mean'`, `normalize: true` → unit vectors,
  so cosine distance = `1 − dot`. Loaded once per process (lazy singleton), warmed on boot.
- Input limit is 256 word pieces; longer text is truncated by the tokenizer.
- **Job text:** `title \n company \n location \n description[0..1200 chars]` (title-first so truncation keeps it).
- **Resume text:** split into ~180-word chunks with 30-word overlap, embed each, mean the vectors, re-normalize.
  This keeps skills listed late in a resume from being cut off.
- Embedding code sits behind an interface `Embedder { model: string; dims: 384; embed(texts: string[]): Promise<Float32Array[]> }`
  so a hosted embedding API can replace it without touching callers (dimension change = new migration + re-embed).

### 7.3 Search

All modes share the same filter clause: `($remote IS NULL OR j.is_remote = $remote) AND ($country IS NULL OR j.country = $country) AND ($salaryMin IS NULL OR j.salary_max >= $salaryMin)`.

- **keyword:** `websearch_to_tsquery('english', q)`, rank `ts_rank_cd(search_tsv, query)`, top 100.
- **vector:** embed `q`, `ORDER BY embedding <=> $vec LIMIT 100`. Per query set `SET LOCAL hnsw.ef_search = 100` and
  `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector 0.8) so filtered queries still return enough rows.
- **hybrid (RRF, k = 60):** the keyword and the vector candidate queries above run in parallel, and their two
  ranked id lists are fused in the API with `score = sum(1 / (60 + rank))`. Fusion needs only ranks, so it is a
  pure function (`services/rrf.ts`) that is unit-tested on hand-made lists; see ADR-011 for why it is not a
  single fused SQL statement. The response carries `ranks.keyword` and `ranks.vector`, either of which is null
  when that mode did not return the job.

  Pagination is over the fused top-200 at most; `hasMore` is false past that.
- Every search writes one `search_logs` row (query, mode, filters, latency, result ids) and returns its `logId`;
  the UI calls `/search/click` when a result is opened.

### 7.4 Resume match (`POST /match`)

1. Get text: PDF via `unpdf` (reject non-PDF mimetype or magic bytes, > 2 MB, or < 200 chars of extracted text with
   a clear error), or the JSON `text`.
2. `text_hash = sha256(normalized text)`. Reuse an existing `resumes` row (and its cached `matches`) if present.
3. Embed (chunked, §7.2), insert `resumes`.
4. Vector search top 20 (no filters).
5. **LLM rerank:** send the resume (first 6,000 chars) and the 20 jobs (id, title, company, first 800 chars) in one
   prompt. Ask for JSON: `{ "ranking": [{ "jobId": number, "fitScore": 0-100, "reasons": string[1..3], "missingSkills": string[0..5] }] }`
   for the best 10. Validate with zod and check every `jobId` is one of the 20 sent (drop invented ids).
6. **Bad output policy:** on parse/validation failure, retry once with the zod error appended to the prompt. If it
   fails again, or the call times out (15 s), return the vector top 10 with `fitScore: null`, empty reasons, and
   `reranked: false`. The endpoint never 500s because of the model.
7. Upsert `matches` rows; return.

### 7.5 Job ad scorer (`POST /jobs/score`)

The score is **deterministic** (rules only), so it is testable and explainable. The LLM only writes suggestions.

| Check id | Pass when | Weight |
| --- | --- | --- |
| `salary` | salaryMin or salaryMax present, or a salary pattern found in the text | 25 |
| `length` | description is 150–700 words | 15 |
| `title` | title ≤ 60 chars, no ALL CAPS words > 4 letters, no emoji, no internal codes like `REQ-1234` | 15 |
| `location` | location or "remote" stated | 10 |
| `requirements` | ≤ 10 bulleted requirement lines | 10 |
| `inclusive` | no terms from `lib/biasTerms.ts` (e.g. "rockstar", "ninja", "aggressive", "young", gendered pronouns for the candidate) | 15 |
| `structure` | has at least two of: responsibilities, requirements, benefits sections | 10 |

`score = sum(weights of passed checks)`. `flaggedTerms` lists each bias-term hit with a neutral suggestion from the
same table. One LLM call returns `{ rewrittenTitle, notes[] }` (zod-validated); on failure both are null/empty.

## 8. Evaluation (`eval/`)

- 50 queries in `eval/queries.jsonl`: `{ "id": "q01", "query": "...", "relevant": ["<content_hash>", ...] }`.
  Relevance is keyed by `content_hash` so labels survive re-ingestion.
- **Labeling is done by the owner by hand.** `eval/label.ts` pools the top 20 from each mode for a query (TREC-style
  pooling), shuffles them, and shows them one by one for a y/n judgment. Agents build the tool; they do not label.
- `eval/run.ts` runs each query in all three modes and writes `eval/results.md`:
  Recall@10, MRR@10, and mean latency per mode, plus the command and commit hash used.
- Query mix: 20 exact-title queries ("senior react developer"), 15 skill/intent queries ("build data pipelines in
  python"), 15 vague or synonym queries ("frontend role that pays well, remote"). The mix is reported with results.

## 9. Configuration

| Var | Used by | Example / default |
| --- | --- | --- |
| `DATABASE_URL` | api, eval | `postgres://postgres:postgres@localhost:5432/talentlens` |
| `DATABASE_URL_TEST` | api tests | `postgres://postgres:postgres@localhost:5432/talentlens_test` |
| `DATABASE_URL_PROD` | manual production operations only; no application reads it | (secret) |
| `PORT` | api | `4000` |
| `CORS_ORIGINS` | api | `http://localhost:3000` (comma-separated) |
| `LOG_LEVEL` | api | `info` |
| `EMBEDDING_MODEL` | api | `Xenova/all-MiniLM-L6-v2` |
| `GEMINI_API_KEY` | api | (secret) |
| `GEMINI_MODEL` | api | current Flash-tier model id |
| `LLM_TIMEOUT_MS` | api | `15000` |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | ingest | (secret) |
| `ADZUNA_COUNTRIES` | ingest | `in,gb,us` |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:4000` |

`apps/api/src/env.ts` parses these with zod at boot and exits with a readable message if any required var is
missing. Connection strings are checked for shape as well as presence (`packages/db/src/url.ts`): every
reserved character in a password must be percent-encoded (`@` as `%40`, `/` as `%2F`, and so on), because a
URL parser may split at the first `@` and silently connect to whatever follows it.

## 10. Testing

- **Unit:** normalize/hash, salary parser, RRF fusion (pure function over two ranked lists), scorer rules, bias
  terms, resume chunking, LLM output validation (valid, invalid JSON, invented job id).
- **API (Supertest on `createApp()`):** each endpoint happy path + one failure path; DB is the real Postgres test
  database, migrated and seeded with ~30 fixture jobs and precomputed embeddings in `apps/api/test/fixtures`.
- **LLM in tests:** `services/llm.ts` exports an interface; tests inject a fake. No network in CI.
- **CI:** `guard` → `pnpm lint` → `pnpm typecheck` → `pnpm test` (Postgres service container `pgvector/pgvector:pg16`).

## 11. Deployment

- **DB:** Supabase, region `ap-northeast-1` (Tokyo), reached through the session pooler (ADR-015). Create the
  `vector` and `pg_trgm` extensions **in `public`**, not in Supabase's `extensions` schema: `pg_dump` empties
  `search_path` and schema-qualifies the type as `public.vector`, so a restore fails otherwise. Run migrations
  from CI or locally with the prod `DATABASE_URL`.
- **API:** Render web service in `singapore`, the closest region Render offers to the Tokyo database, defined by
  `render.yaml`: build `pnpm install --frozen-lockfile && pnpm --filter db
  migrate`, start `pnpm --filter api start`, which runs the TypeScript entry point through `tsx` (ADR-013). The
  free instance sleeps when idle and has 512 MB RAM; the MiniLM model (~90 MB) fits. Health check `/api/health`.
- **Web:** Vercel, root `apps/web`, `NEXT_PUBLIC_API_URL` = Render URL. API `CORS_ORIGINS` = Vercel URL.
- **Ingestion in prod:** the first load copies the local database, embeddings included, straight into Supabase with
  `pg_dump | psql` (ADR-014), so the Adzuna trial quota is not spent twice. Later top-ups run locally against
  the production database, or from a manual GitHub Actions workflow (`workflow_dispatch`) with secrets. No cron for the demo.

## 12. Performance budgets (measure, record in STATE)

| Path | Budget (p50, warm, 5k jobs) |
| --- | --- |
| keyword search | < 50 ms |
| vector search (incl. query embedding) | < 120 ms |
| hybrid search | < 150 ms |
| match without LLM / with LLM | < 1 s / < 8 s |

## 13. Scaling notes (how this grows to millions of jobs)

- HNSW memory grows with rows × dims; at millions of rows move vectors to a dedicated store or partition by country
  / recency, and use `halfvec` to halve memory.
- Embedding becomes a queue-backed worker (new/changed jobs only, by content hash), not part of request handling.
- Keyword search moves to a search engine (OpenSearch/Elasticsearch) when tsvector ranking or faceting becomes the
  bottleneck; RRF fusion stays the same because it only needs ranks.
- Click logs (`search_logs`) become training data for a learned reranker.
- Rate limiting moves to a shared store (Redis) once there is more than one API instance.
