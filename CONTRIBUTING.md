# Contributing to TalentLens

Use Node.js 20 and the pnpm version pinned in `package.json`. Follow the local setup in [README.md](README.md).

Before submitting a change:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
```

Tests need the separate PostgreSQL test database from `docker compose up -d`.
TalentLens also needs pgvector; test setup migrates and seeds the fixture corpus.
Use local test credentials, never a production database.

Keep request and response validation in `packages/shared`. Add migrations for schema changes; do not rewrite existing migrations.
Include a regression check for behavior changes. Keep secrets out of source control and document configuration in `.env.example`.

[Architecture](docs/ARCHITECTURE.md) describes the contracts; [decisions](docs/DECISIONS.md) records their trade-offs.
Preserve the evaluation limitations and the commands behind published results.
