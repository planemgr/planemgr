# ADR 0002: Fastify API with Postgres JSONB storage

Date: 2024-10-05
Status: Accepted

## Context

We need a backend with broad community support, good TypeScript ergonomics, and easy integration with IaC tooling and adapters. The backend must persist workspace state and version snapshots.

## Decision

Use a Node.js + TypeScript API built on Fastify and store workspace data in Postgres using JSONB columns for graph state.

## Consequences

- Fastify keeps the API lightweight while retaining strong plugin support.
- Postgres JSONB stores the evolving graph schema without heavy migrations.
- The backend shares types with the frontend for consistent modeling.
