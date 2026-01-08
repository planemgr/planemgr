# Plane Manager

Visual infrastructure manager. Build, layer, and verify infrastructure changes using a visual canvas that compiles into execution plans.

## Quick start

1. Copy env defaults:
   - `cp .env.example .env`
2. Install dependencies:
   - `pnpm install`
3. Start dev servers:
   - `docker compose up` or `pnpm dev`

Web: `http://localhost:5173`
API: `http://localhost:4000`

## Structure

- `apps/web` - React + Vite UI with React Flow canvas.
- `services/api` - Fastify API, session auth, plan diff engine, OpenTofu git-backed storage.
- `packages/domain` - Shared types and schemas.
- `docs` - Architecture, ADRs, and roadmap.
- `deploy/helm/planemgr` - Helm chart scaffolding.

## Notes

- Node positions are treated as layout metadata and do not affect the execution plan.
- Platform nodes act as resizable containers; child nodes record their platform via `config.platformId`.
- The plan engine currently diffs graph state; provider adapters will expand it into IaC tool plans.
- Physical platform nodes can be typed (SSH) with a host IP; OpenTofu uses a local module under `iac/modules/planemgr-ssh-platform` and expects SSH keys via variables.
- SSH keypairs are generated on demand for the logged-in user and stored in Postgres; the public key is shown in the profile menu and the private key is reserved for provisioning.
