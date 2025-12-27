# Plane Manager

Visual infrastructure manager. Build, layer, and verify infrastructure changes using a visual canvas that compiles into execution plans.

## Quick start

1. Copy env defaults:
   - `cp .env.example .env`
2. Start Postgres:
   - `docker-compose up -d`
3. Install dependencies:
   - `pnpm install`
4. Start dev servers:
   - `docker compose up` or `pnpm dev` if you use your own PostgreSQL instance

If you run the API outside Docker, apply migrations with:
- `pnpm -C services/api migrate`

Web: `http://localhost:5173`
API: `http://localhost:4000`

## Structure

- `apps/web` - React + Vite UI with React Flow canvas.
- `services/api` - Fastify API, session auth, plan diff engine, Postgres storage.
- `packages/domain` - Shared types and schemas.
- `docs` - Architecture, ADRs, and roadmap.
- `deploy/helm/planemgr` - Helm chart scaffolding.

## Notes

- Node positions are treated as layout metadata and do not affect the execution plan.
- The plan engine currently diffs graph state; provider adapters will expand it into IaC tool plans.
