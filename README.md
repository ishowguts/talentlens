# TalentLens

Semantic job search and resume matcher. Next.js, Node.js + Express (TypeScript), PostgreSQL + pgvector, hybrid keyword + vector search with Reciprocal Rank Fusion, LLM reranking, measured Recall@10.

**Status:** in development. Design in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), progress in
[harness/STATE.md](harness/STATE.md). Results and a live link will appear here once measured and deployed.

## Run locally

Requirements: Node.js 20, pnpm, Docker.

```sh
sh scripts/setup.sh
pnpm install
docker compose up -d
```

Full command list: [AGENTS.md](AGENTS.md#commands).

## Author

Bittu Mandal · [@ishowguts](https://github.com/ishowguts)
