import type {
  DriftState,
  DriftStatus,
  EdgeKind,
  Graph,
  GraphEdge,
  GraphNode,
  Layer,
  NodeKind
} from "@planemgr/domain";
import type { Edge, Node } from "reactflow";

export type PlanNodeData = {
  label: string;
  kind: NodeKind;
  layerId: string;
  layerColor: string;
  driftStatus: DriftStatus;
  config?: Record<string, unknown>;
};

const layerColorById = (layers: Layer[]) =>
  new Map(layers.map((layer) => [layer.id, layer.color]));

export const graphToFlowNodes = (
  graph: Graph,
  layers: Layer[],
  drift: DriftState
): Node<PlanNodeData>[] => {
  const colors = layerColorById(layers);
  const visibility = new Map(layers.map((layer) => [layer.id, layer.visible]));
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "planNode",
    position: node.position,
    hidden: !(visibility.get(node.layerId) ?? true),
    data: {
      label: node.label,
      kind: node.kind,
      layerId: node.layerId,
      layerColor: colors.get(node.layerId) ?? "#ffffff",
      driftStatus: drift[node.id]?.status ?? "unknown",
      config: node.config
    }
  }));
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
  const graphNodes: GraphNode[] = nodes.map((node) => ({
    id: node.id,
    kind: node.data.kind,
    label: node.data.label,
    layerId: node.data.layerId,
    position: node.position,
    config: node.data.config ?? {}
  }));

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
