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

## Authentication (single-user)

The API uses bearer tokens signed with `SESSION_SECRET` and a single set of
credentials (`APP_USERNAME`, `APP_PASSWORD`).

- `POST /api/auth` with JSON `{ "username": "...", "password": "..." }` to obtain
  access + refresh tokens.
- `GET /api/auth` with `Authorization: Bearer <refresh_token>` to refresh.
- `POST /api/user` validates the configured credentials and stores an SSH keypair (provided or generated).
- `GET /api/user` returns `{}` when the bearer access token is valid.

SSH keys are stored on disk in `SECURE_STORE` (default `./secure`) for provisioning workflows.

Chart repos are stored as bare git repos in `WORKDIR` (default `./srv`).
Chart file trees can be listed via `HEAD /api/chart/{id}?ref=...` (defaults to `HEAD`).
Chart file contents can be read via `GET /api/chart/{id}?file=...&ref=...` (defaults to `HEAD`).
Chart files can be updated via `PUT /api/chart/{id}` with JSON `{ "message": "...", "files": [{ "path": "...", "content": "..." }] }`.
Chart repos can be fetched read-only over smart HTTP at `GET /chart/{id}.git/info/refs?service=git-upload-pack` and `POST /chart/{id}.git/git-upload-pack` with the same access token in the `Authorization` header.

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

- [x] Accept SSH key pair from user at POST /api/user or generate key pair
- [ ] Deploy API endpoint /api/deploy
  - [ ] Build-gated module to just run opentofu in-process for the installer
  - [ ] Docker runner
  - [ ] K8S runner
- [ ] Sign git commits with the user's SSH key
- [ ] Installer

## Notes

- Node positions are treated as layout metadata and do not affect the execution plan.
- Platform nodes act as resizable containers; child nodes record their platform via `config.platformId`.
- The plan engine currently diffs graph state; provider adapters will expand it into IaC tool plans.
- Physical platform nodes can be typed (SSH) with a host IP; OpenTofu uses a local module under `iac/modules/planemgr-ssh-platform` and expects SSH keys via variables.
- SSH keypairs are stored on disk under `SECURE_STORE`; the public key is shown in the profile menu and the private key is reserved for provisioning.
