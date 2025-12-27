# ADR 0001: React + React Flow for the visual canvas

Date: 2024-10-05
Status: Accepted

## Context

We need a visual programming style interface with nodes, edges, and multiple layers. The UI must support drag/drop editing, connections, and custom node rendering.

## Decision

Use React + Vite with React Flow for the canvas and node graph interactions.

## Consequences

- Fast iteration on visual tooling using a mature graph library.
- Custom nodes and controls stay within React.
- The UI is tied to React Flow's node/edge model, so domain types mirror this shape.
