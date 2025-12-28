import { z } from "zod";

export const nodeKindSchema = z.enum([
  "platform",
  "compute",
  "service",
  "network",
  "storage",
  "control",
  "data",
  "security"
]);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const nodeSizeSchema = z.object({
  width: z.number(),
  height: z.number()
});
export type NodeSize = z.infer<typeof nodeSizeSchema>;

export const edgeKindSchema = z.enum(["data", "control", "network"]);
export type EdgeKind = z.infer<typeof edgeKindSchema>;

export const positionSchema = z.object({
  x: z.number(),
  y: z.number()
});
export type Position = z.infer<typeof positionSchema>;

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKindSchema,
  label: z.string().min(1),
  layerId: z.string().min(1),
  position: positionSchema,
  size: nodeSizeSchema.optional(),
  config: z.record(z.unknown()).optional()
});
export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  kind: edgeKindSchema,
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional()
});
export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema)
});
export type Graph = z.infer<typeof graphSchema>;

export const layerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int()
});
export type Layer = z.infer<typeof layerSchema>;

export const driftStatusSchema = z.enum(["unknown", "in_sync", "drifted"]);
export type DriftStatus = z.infer<typeof driftStatusSchema>;

export const driftItemSchema = z.object({
  status: driftStatusSchema,
  lastCheckedAt: z.string().optional(),
  note: z.string().optional()
});
export type DriftItem = z.infer<typeof driftItemSchema>;

export const driftStateSchema = z.record(driftItemSchema);
export type DriftState = z.infer<typeof driftStateSchema>;

export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  graph: graphSchema,
  layers: z.array(layerSchema),
  drift: driftStateSchema,
  updatedAt: z.string()
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const planActionSchema = z.enum(["create", "update", "delete"]);
export type PlanAction = z.infer<typeof planActionSchema>;

export const planTargetSchema = z.enum(["node", "edge"]);
export type PlanTarget = z.infer<typeof planTargetSchema>;

export const planOperationSchema = z.object({
  id: z.string().min(1),
  action: planActionSchema,
  target: planTargetSchema,
  targetId: z.string().min(1),
  summary: z.string().min(1),
  changes: z.record(z.unknown()).optional()
});
export type PlanOperation = z.infer<typeof planOperationSchema>;

export const planSchema = z.object({
  generatedAt: z.string().min(1),
  workspaceId: z.string().min(1),
  baseVersionId: z.string().optional(),
  operations: z.array(planOperationSchema),
  stats: z.object({
    adds: z.number().int(),
    updates: z.number().int(),
    deletes: z.number().int()
  })
});
export type Plan = z.infer<typeof planSchema>;

export const planVersionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  notes: z.string().optional(),
  graph: graphSchema,
  layers: z.array(layerSchema),
  createdAt: z.string().min(1)
});
export type PlanVersion = z.infer<typeof planVersionSchema>;

export const sessionUserSchema = z.object({
  username: z.string().min(1)
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const loginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const workspaceUpdateSchema = z.object({
  graph: graphSchema,
  layers: z.array(layerSchema),
  drift: driftStateSchema.optional()
});

export const versionCreateSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional()
});

export const driftUpdateSchema = z.object({
  nodeId: z.string().min(1),
  status: driftStatusSchema,
  note: z.string().optional()
});

export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;
export type DriftUpdateInput = z.infer<typeof driftUpdateSchema>;

export const DEFAULT_LAYERS: Layer[] = [
  { id: "physical", name: "Physical", color: "#f2c879", visible: true, order: 1 },
  { id: "infra", name: "Infrastructure", color: "#ffb454", visible: true, order: 2 },
  { id: "control", name: "Control", color: "#7cc4ff", visible: true, order: 3 },
  { id: "service", name: "Services", color: "#f37cc1", visible: true, order: 4 }
];

export const DEFAULT_GRAPH: Graph = {
  nodes: [
    {
      id: "node-compute-1",
      kind: "compute",
      label: "Compute",
      layerId: "infra",
      position: { x: 120, y: 160 },
      config: { provider: "generic" }
    },
    {
      id: "node-service-1",
      kind: "service",
      label: "Core Service",
      layerId: "service",
      position: { x: 420, y: 260 },
      config: { replicas: 2 }
    }
  ],
  edges: [
    {
      id: "edge-1",
      kind: "data",
      source: "node-compute-1",
      target: "node-service-1",
      label: "deploys"
    }
  ]
};

export const EMPTY_DRIFT: DriftState = {};
