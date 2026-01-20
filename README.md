# Plane Manager

Visual infrastructure manager. Build, layer, and verify infrastructure changes
using a visual canvas that compiles into execution plans.

## Quick start

1. Copy env defaults:
   - `cp .env.example .env`
2. Start dev servers:
   - `task dev`

Web: `http://localhost:5173`
API: `http://localhost:4000`
API Docs: `http://localhost:4000/api/doc`
OpenAPI JSON: `http://localhost:4000/api/openapi.json`

Chart repos are stored as bare git repos in `WORKDIR` (default `./srv`).

To build a production binary that serves the Vite bundle:
- `task build`

To regenerate OpenAPI docs manually:
- `task docs:api`

## Technical Details

- Uses OpenTofu to provision infrastructure (with config in JSON format)
- Stores and manages the OpenTofu config in Git
- Has a plugin architecture for various infrastructure elements

## Structure

- `web` - React + Vite UI with React Flow canvas.
- `cmd/server` + `internal/server` - Go HTTP API and static asset server.
- `packages/domain` - Shared types and schemas.
- `docs` - Architecture, ADRs, and roadmap.
- `deploy/helm/planemgr` - Helm chart scaffolding.

## Roadmap

- [ ] Installer

## Notes

- Node positions are treated as layout metadata and do not affect the execution plan.
- Platform nodes act as resizable containers; child nodes record their platform via `config.platformId`.
- The plan engine currently diffs graph state; provider adapters will expand it into IaC tool plans.
- Physical platform nodes can be typed (SSH) with a host IP; OpenTofu uses a local module under `iac/modules/planemgr-ssh-platform` and expects SSH keys via variables.
- SSH keypairs are generated on demand for the logged-in user and stored in Postgres; the public key is shown in the profile menu and the private key is reserved for provisioning.
