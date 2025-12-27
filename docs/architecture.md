# Architecture

## Intent

Plane Manager provides a visual, layered model of infrastructure that compiles into reviewable execution plans. The system keeps domain concepts provider-neutral while allowing adapters to map into specific platforms.

## Components

- Web UI (`apps/web`): React + React Flow canvas with planes, nodes, edges, plan preview, and drift controls.
- API (`services/api`): Fastify service that manages sessions, workspace state, versions, and plan generation.
- Domain package (`packages/domain`): Shared schemas and types for graphs, layers, plans, and drift.
- Storage (Postgres): JSONB-backed workspace and version persistence.

## Data model

- Workspace: active graph state, layers, drift map.
- Plan version: immutable snapshot of workspace graph and layers.
- Plan: diff between current workspace and a chosen version.

## Plan pipeline

1. User edits the graph visually.
2. Workspace is saved to Postgres.
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
