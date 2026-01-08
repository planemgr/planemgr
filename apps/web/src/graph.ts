import type {
  DriftState,
  DriftStatus,
  EdgeKind,
  Graph,
  GraphEdge,
  GraphNode,
  Layer,
  NodeKind,
  NodeSize
} from "@planemgr/domain";
import type { Edge, Node } from "reactflow";

export type PlanNodeData = {
  label: string;
  kind: NodeKind;
  layerId: string;
  layerColor: string;
  driftStatus: DriftStatus;
  config?: Record<string, unknown>;
  onUpdateConfig?: (config: Record<string, unknown>) => void;
  isEditingLocked?: boolean;
};

export const DEFAULT_PLATFORM_SIZE: NodeSize = { width: 360, height: 240 };

const layerColorById = (layers: Layer[]) =>
  new Map(layers.map((layer) => [layer.id, layer.color]));

const parseNumericStyle = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveNodeSize = (node: Node<PlanNodeData>): NodeSize | null => {
  const width = parseNumericStyle(node.width ?? node.style?.width);
  const height = parseNumericStyle(node.height ?? node.style?.height);
  if (width === null || height === null) {
    return null;
  }
  return { width, height };
};

// Platform membership is expressed through config.platformId to keep it in the graph model.
const platformParentId = (node: GraphNode, platformIds: Set<string>): string | undefined => {
  if (node.kind === "platform" || !node.config) {
    return undefined;
  }
  const candidate = node.config.platformId;
  if (typeof candidate !== "string" || !platformIds.has(candidate)) {
    return undefined;
  }
  return candidate;
};

export const graphToFlowNodes = (
  graph: Graph,
  layers: Layer[],
  drift: DriftState
): Node<PlanNodeData>[] => {
  const colors = layerColorById(layers);
  const visibility = new Map(layers.map((layer) => [layer.id, layer.visible]));
  const platformIds = new Set(
    graph.nodes.filter((node) => node.kind === "platform").map((node) => node.id)
  );
  return graph.nodes.map((node) => {
    const parentId = platformParentId(node, platformIds);
    return {
      id: node.id,
      type: node.kind === "platform" ? "platformNode" : "planNode",
      position: node.position,
      hidden: !(visibility.get(node.layerId) ?? true),
      zIndex: node.kind === "platform" ? 0 : 1,
      parentNode: parentId,
      extent: parentId ? "parent" : undefined,
      style:
        node.kind === "platform"
          ? {
              width: node.size?.width ?? DEFAULT_PLATFORM_SIZE.width,
              height: node.size?.height ?? DEFAULT_PLATFORM_SIZE.height
            }
          : undefined,
      data: {
        label: node.label,
        kind: node.kind,
        layerId: node.layerId,
        layerColor: colors.get(node.layerId) ?? "#ffffff",
        driftStatus: drift[node.id]?.status ?? "unknown",
        config: node.config
      }
    };
  });
};

export const graphToFlowEdges = (graph: Graph): Edge[] =>
  graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    data: { kind: edge.kind }
  }));

export const flowToGraph = (nodes: Node<PlanNodeData>[], edges: Edge[]): Graph => {
  const graphNodes: GraphNode[] = nodes.map((node) => {
    const config = { ...(node.data.config ?? {}) };
    if (node.data.kind === "platform") {
      delete config.platformId;
    } else if (node.parentNode) {
      config.platformId = node.parentNode;
    } else {
      delete config.platformId;
    }
    const size =
      node.data.kind === "platform"
        ? resolveNodeSize(node) ?? DEFAULT_PLATFORM_SIZE
        : undefined;
    return {
      id: node.id,
      kind: node.data.kind,
      label: node.data.label,
      layerId: node.data.layerId,
      position: node.position,
      size,
      config
    };
  });

  const graphEdges: GraphEdge[] = edges.map((edge) => ({
    id: edge.id,
    kind: (edge.data?.kind as EdgeKind) ?? "data",
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === "string" ? edge.label : undefined
  }));

  return {
    nodes: graphNodes,
    edges: graphEdges
  };
};
