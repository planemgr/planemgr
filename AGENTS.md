# Architecture

## Intent

Plane Manager provides a visual, layered model of infrastructure that compiles into reviewable execution plans. The system keeps domain concepts provider-neutral while allowing adapters to map into specific platforms.

## Structure

- `apps/web` - React + Vite UI with React Flow canvas.
- `services/api` - Fastify API, session auth, plan diff engine, file-backed IaC storage.
- `packages/domain` - Shared types and schemas.
- `docs` - Architecture, ADRs, and roadmap.
- `deploy/helm/planemgr` - Helm chart scaffolding.

## Components

- Web UI (`apps/web`): React + React Flow canvas with planes, nodes, edges, plan preview, and drift controls.
- API (`services/api`): Fastify service that manages sessions, workspace state, versions, and plan generation.
- Domain package (`packages/domain`): Shared schemas and types for graphs, layers, plans, and drift.
- Storage (Git + filesystem): OpenTofu JSON and metadata tracked in a git repo.

## Data model

- Workspace: active graph state, layers, drift map stored in OpenTofu JSON + metadata.
- Plan version: immutable snapshot stored as a git commit.
- Plan: diff between current workspace and a chosen git version.
- Platform node: resizable container for PaaS/bare-metal foundations; child nodes store `config.platformId`.
- User profile: SSH keypair stored in Postgres; UI exposes only the public key while provisioning uses both keys.
- Platform config: physical platform nodes store `platformType` and SSH host IP; OpenTofu maps SSH platforms to the `planemgr-ssh-platform` module in the IaC repo.

## Plan pipeline

1. User edits the graph visually.
2. Workspace is saved to OpenTofu JSON + metadata in the git repo.
3. Plan generation diffs current graph vs a base version to produce operations.
4. Operations are reviewed in the UI and later mapped to IaC tooling.

## Drift model

Drift is stored as a per-node status map. The UI surfaces drift and provides resolution actions. Provider adapters will be responsible for real drift detection.

## Extension points

- Provider adapters: map generic nodes (Compute, Network, Storage) into platform-specific resources.
- Plan adapters: translate the generic plan into tools like OpenTofu or Crossplane.
- Drift adapters: compare intended graph against live platform state.

## Deployment

- Two services: `web` (static assets) and `api` (Fastify).
- Helm chart scaffolding in `deploy/helm/planemgr`.

## Notes

- Comment your code if not trivial.
- Leave structural comments to explain architecture choices and implementation approach.
- Always update README.md files and AGENTS.md when architecture changes or new features introduced.

# Coding

- Always run `pnpm lint`, `pnpm format` and `pnpm typecheck` after finishing and fix issues to keep the code tidy.
