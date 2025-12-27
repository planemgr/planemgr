# ADR 0003: Plan diff engine with future IaC adapters

Date: 2024-10-05
Status: Accepted

## Context

The product requires clear execution plans derived from visual edits. A provider-neutral plan should be created first, then mapped to specific IaC tools.

## Decision

Start with a graph diff engine that generates provider-neutral plan operations. Define adapter boundaries to map these operations into tools like OpenTofu in later phases.

## Consequences

- The MVP can ship without committing to a single IaC engine.
- Adapter interfaces make the backend extensible and avoid provider lock-in.
- The plan diff must remain deterministic and auditable.
