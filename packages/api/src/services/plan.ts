import { v4 as uuidv4 } from "uuid";
import type { Graph, GraphEdge, GraphNode, Plan, PlanOperation } from "@planemgr/domain";

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true;
  }
  if (typeof left !== typeof right) {
    return false;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (!deepEqual(leftKeys, rightKeys)) {
      return false;
    }
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
};

const diffNode = (current: GraphNode, base: GraphNode) => {
  // Visual layout changes should not create execution plan operations.
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (current.kind !== base.kind) {
    changes.kind = { from: base.kind, to: current.kind };
  }
  if (current.label !== base.label) {
    changes.label = { from: base.label, to: current.label };
  }
  if (current.layerId !== base.layerId) {
    changes.layerId = { from: base.layerId, to: current.layerId };
  }
  if (!deepEqual(current.config ?? {}, base.config ?? {})) {
    changes.config = { from: base.config ?? {}, to: current.config ?? {} };
  }
  return changes;
};

const diffEdge = (current: GraphEdge, base: GraphEdge) => {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (current.kind !== base.kind) {
    changes.kind = { from: base.kind, to: current.kind };
  }
  if (current.source !== base.source) {
    changes.source = { from: base.source, to: current.source };
  }
  if (current.target !== base.target) {
    changes.target = { from: base.target, to: current.target };
  }
  if ((current.label ?? "") !== (base.label ?? "")) {
    changes.label = { from: base.label ?? "", to: current.label ?? "" };
  }
  return changes;
};

export const createPlan = (
  workspaceId: string,
  current: Graph,
  base: Graph | null,
  baseVersionId?: string,
): Plan => {
  const operations: PlanOperation[] = [];
  const baseNodes = new Map(base?.nodes.map((node) => [node.id, node]));
  const baseEdges = new Map(base?.edges.map((edge) => [edge.id, edge]));

  const currentNodeIds = new Set(current.nodes.map((node) => node.id));
  const currentEdgeIds = new Set(current.edges.map((edge) => edge.id));

  for (const node of current.nodes) {
    const baseNode = baseNodes.get(node.id);
    if (!baseNode) {
      operations.push({
        id: uuidv4(),
        action: "create",
        target: "node",
        targetId: node.id,
        summary: `Create node ${node.label}`,
        changes: { to: node },
      });
      continue;
    }
    const changes = diffNode(node, baseNode);
    if (Object.keys(changes).length > 0) {
      operations.push({
        id: uuidv4(),
        action: "update",
        target: "node",
        targetId: node.id,
        summary: `Update node ${node.label}`,
        changes,
      });
    }
  }

  if (base) {
    for (const node of base.nodes) {
      if (!currentNodeIds.has(node.id)) {
        operations.push({
          id: uuidv4(),
          action: "delete",
          target: "node",
          targetId: node.id,
          summary: `Remove node ${node.label}`,
          changes: { from: node },
        });
      }
    }
  }

  for (const edge of current.edges) {
    const baseEdge = baseEdges.get(edge.id);
    if (!baseEdge) {
      operations.push({
        id: uuidv4(),
        action: "create",
        target: "edge",
        targetId: edge.id,
        summary: `Create ${edge.kind} connection`,
        changes: { to: edge },
      });
      continue;
    }
    const changes = diffEdge(edge, baseEdge);
    if (Object.keys(changes).length > 0) {
      operations.push({
        id: uuidv4(),
        action: "update",
        target: "edge",
        targetId: edge.id,
        summary: `Update ${edge.kind} connection`,
        changes,
      });
    }
  }

  if (base) {
    for (const edge of base.edges) {
      if (!currentEdgeIds.has(edge.id)) {
        operations.push({
          id: uuidv4(),
          action: "delete",
          target: "edge",
          targetId: edge.id,
          summary: `Remove ${edge.kind} connection`,
          changes: { from: edge },
        });
      }
    }
  }

  const stats = operations.reduce(
    (accumulator, operation) => {
      if (operation.action === "create") {
        accumulator.adds += 1;
      } else if (operation.action === "update") {
        accumulator.updates += 1;
      } else {
        accumulator.deletes += 1;
      }
      return accumulator;
    },
    { adds: 0, updates: 0, deletes: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    workspaceId,
    baseVersionId,
    operations,
    stats,
  };
};
