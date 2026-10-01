# TalentLens — Context

## Why this exists

Recruitment advertising lives on two questions: *which candidate fits which job* and *how good is the job ad*.
Better matching and better ads mean more qualified applications per job. TalentLens is a working, measured answer
to both at small scale, built on a production-shaped stack.

## Goals

1. Hybrid semantic search over 5,000+ real postings, with a measured Recall@10 improvement over keyword search.
2. Resume → ranked jobs with grounded, validated explanations.
3. Job ad quality scoring that is deterministic and explainable.
4. A clean TypeScript monorepo: Express REST API, Next.js frontend, PostgreSQL + pgvector, tests, CI, live deploy.

## Non-goals

- User accounts, auth, saved searches.
- Scraping sites that forbid it. Only public APIs (Remotive, Adzuna), with credit and links back.
- Training custom models.
- Storing resumes beyond what the demo needs (no personal data other than the uploaded text).

## Success criteria

- Live link works. README shows Recall@10 for keyword vs vector vs hybrid on 50 owner-labeled queries.
- p50 hybrid search < 150 ms warm on 5k jobs.
- CI green; every endpoint tested.

## Design questions the owner must be able to answer (keep the code and docs consistent with these)

- What an embedding is, and why cosine similarity on normalized vectors.
- Why HNSW over exact search, and what is traded (recall vs speed vs memory).
- Why hybrid instead of pure vector search; why RRF instead of score blending.
- How this scales to millions of jobs (ARCHITECTURE §13).
- What happens when the model returns bad JSON (ADR-008, §7.4).
