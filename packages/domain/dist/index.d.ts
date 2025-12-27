import { z } from "zod";
export declare const nodeKindSchema: z.ZodEnum<["compute", "service", "network", "storage", "control", "data", "security"]>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export declare const edgeKindSchema: z.ZodEnum<["data", "control", "network"]>;
export type EdgeKind = z.infer<typeof edgeKindSchema>;
export declare const positionSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
export type Position = z.infer<typeof positionSchema>;
export declare const graphNodeSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["compute", "service", "network", "storage", "control", "data", "security"]>;
    label: z.ZodString;
    layerId: z.ZodString;
    position: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
    label: string;
    layerId: string;
    position: {
        x: number;
        y: number;
    };
    config?: Record<string, unknown> | undefined;
}, {
    id: string;
    kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
    label: string;
    layerId: string;
    position: {
        x: number;
        y: number;
    };
    config?: Record<string, unknown> | undefined;
}>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export declare const graphEdgeSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["data", "control", "network"]>;
    source: z.ZodString;
    target: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "network" | "control" | "data";
    source: string;
    target: string;
    label?: string | undefined;
}, {
    id: string;
    kind: "network" | "control" | "data";
    source: string;
    target: string;
    label?: string | undefined;
}>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export declare const graphSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["compute", "service", "network", "storage", "control", "data", "security"]>;
        label: z.ZodString;
        layerId: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
        label: string;
        layerId: string;
        position: {
            x: number;
            y: number;
        };
        config?: Record<string, unknown> | undefined;
    }, {
        id: string;
        kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
        label: string;
        layerId: string;
        position: {
            x: number;
            y: number;
        };
        config?: Record<string, unknown> | undefined;
    }>, "many">;
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["data", "control", "network"]>;
        source: z.ZodString;
        target: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "network" | "control" | "data";
        source: string;
        target: string;
        label?: string | undefined;
    }, {
        id: string;
        kind: "network" | "control" | "data";
        source: string;
        target: string;
        label?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
        label: string;
        layerId: string;
        position: {
            x: number;
            y: number;
        };
        config?: Record<string, unknown> | undefined;
    }[];
    edges: {
        id: string;
        kind: "network" | "control" | "data";
        source: string;
        target: string;
        label?: string | undefined;
    }[];
}, {
    nodes: {
        id: string;
        kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
        label: string;
        layerId: string;
        position: {
            x: number;
            y: number;
        };
        config?: Record<string, unknown> | undefined;
    }[];
    edges: {
        id: string;
        kind: "network" | "control" | "data";
        source: string;
        target: string;
        label?: string | undefined;
    }[];
}>;
export type Graph = z.infer<typeof graphSchema>;
export declare const layerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    color: z.ZodString;
    visible: z.ZodBoolean;
    order: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    order: number;
}, {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    order: number;
}>;
export type Layer = z.infer<typeof layerSchema>;
export declare const driftStatusSchema: z.ZodEnum<["unknown", "in_sync", "drifted"]>;
export type DriftStatus = z.infer<typeof driftStatusSchema>;
export declare const driftItemSchema: z.ZodObject<{
    status: z.ZodEnum<["unknown", "in_sync", "drifted"]>;
    lastCheckedAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "unknown" | "in_sync" | "drifted";
    lastCheckedAt?: string | undefined;
    note?: string | undefined;
}, {
    status: "unknown" | "in_sync" | "drifted";
    lastCheckedAt?: string | undefined;
    note?: string | undefined;
}>;
export type DriftItem = z.infer<typeof driftItemSchema>;
export declare const driftStateSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    status: z.ZodEnum<["unknown", "in_sync", "drifted"]>;
    lastCheckedAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "unknown" | "in_sync" | "drifted";
    lastCheckedAt?: string | undefined;
    note?: string | undefined;
}, {
    status: "unknown" | "in_sync" | "drifted";
    lastCheckedAt?: string | undefined;
    note?: string | undefined;
}>>;
export type DriftState = z.infer<typeof driftStateSchema>;
export declare const workspaceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    graph: z.ZodObject<{
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["compute", "service", "network", "storage", "control", "data", "security"]>;
            label: z.ZodString;
            layerId: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }, {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }>, "many">;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["data", "control", "network"]>;
            source: z.ZodString;
            target: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }, {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    }, {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    }>;
    layers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        color: z.ZodString;
        visible: z.ZodBoolean;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }, {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }>, "many">;
    drift: z.ZodRecord<z.ZodString, z.ZodObject<{
        status: z.ZodEnum<["unknown", "in_sync", "drifted"]>;
        lastCheckedAt: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }>>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    graph: {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    };
    layers: {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }[];
    drift: Record<string, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }>;
    updatedAt: string;
}, {
    id: string;
    name: string;
    graph: {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    };
    layers: {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }[];
    drift: Record<string, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }>;
    updatedAt: string;
}>;
export type Workspace = z.infer<typeof workspaceSchema>;
export declare const planActionSchema: z.ZodEnum<["create", "update", "delete"]>;
export type PlanAction = z.infer<typeof planActionSchema>;
export declare const planTargetSchema: z.ZodEnum<["node", "edge"]>;
export type PlanTarget = z.infer<typeof planTargetSchema>;
export declare const planOperationSchema: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodEnum<["create", "update", "delete"]>;
    target: z.ZodEnum<["node", "edge"]>;
    targetId: z.ZodString;
    summary: z.ZodString;
    changes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    target: "node" | "edge";
    action: "create" | "update" | "delete";
    targetId: string;
    summary: string;
    changes?: Record<string, unknown> | undefined;
}, {
    id: string;
    target: "node" | "edge";
    action: "create" | "update" | "delete";
    targetId: string;
    summary: string;
    changes?: Record<string, unknown> | undefined;
}>;
export type PlanOperation = z.infer<typeof planOperationSchema>;
export declare const planSchema: z.ZodObject<{
    generatedAt: z.ZodString;
    workspaceId: z.ZodString;
    baseVersionId: z.ZodOptional<z.ZodString>;
    operations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        action: z.ZodEnum<["create", "update", "delete"]>;
        target: z.ZodEnum<["node", "edge"]>;
        targetId: z.ZodString;
        summary: z.ZodString;
        changes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        target: "node" | "edge";
        action: "create" | "update" | "delete";
        targetId: string;
        summary: string;
        changes?: Record<string, unknown> | undefined;
    }, {
        id: string;
        target: "node" | "edge";
        action: "create" | "update" | "delete";
        targetId: string;
        summary: string;
        changes?: Record<string, unknown> | undefined;
    }>, "many">;
    stats: z.ZodObject<{
        adds: z.ZodNumber;
        updates: z.ZodNumber;
        deletes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        adds: number;
        updates: number;
        deletes: number;
    }, {
        adds: number;
        updates: number;
        deletes: number;
    }>;
}, "strip", z.ZodTypeAny, {
    generatedAt: string;
    workspaceId: string;
    operations: {
        id: string;
        target: "node" | "edge";
        action: "create" | "update" | "delete";
        targetId: string;
        summary: string;
        changes?: Record<string, unknown> | undefined;
    }[];
    stats: {
        adds: number;
        updates: number;
        deletes: number;
    };
    baseVersionId?: string | undefined;
}, {
    generatedAt: string;
    workspaceId: string;
    operations: {
        id: string;
        target: "node" | "edge";
        action: "create" | "update" | "delete";
        targetId: string;
        summary: string;
        changes?: Record<string, unknown> | undefined;
    }[];
    stats: {
        adds: number;
        updates: number;
        deletes: number;
    };
    baseVersionId?: string | undefined;
}>;
export type Plan = z.infer<typeof planSchema>;
export declare const planVersionSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    graph: z.ZodObject<{
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["compute", "service", "network", "storage", "control", "data", "security"]>;
            label: z.ZodString;
            layerId: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }, {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }>, "many">;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["data", "control", "network"]>;
            source: z.ZodString;
            target: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }, {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    }, {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    }>;
    layers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        color: z.ZodString;
        visible: z.ZodBoolean;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }, {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }>, "many">;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    graph: {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    };
    layers: {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }[];
    workspaceId: string;
    createdAt: string;
    notes?: string | undefined;
}, {
    id: string;
    name: string;
    graph: {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    };
    layers: {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }[];
    workspaceId: string;
    createdAt: string;
    notes?: string | undefined;
}>;
export type PlanVersion = z.infer<typeof planVersionSchema>;
export declare const sessionUserSchema: z.ZodObject<{
    username: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
}, {
    username: string;
}>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export declare const loginInputSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export declare const workspaceUpdateSchema: z.ZodObject<{
    graph: z.ZodObject<{
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["compute", "service", "network", "storage", "control", "data", "security"]>;
            label: z.ZodString;
            layerId: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }, {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }>, "many">;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["data", "control", "network"]>;
            source: z.ZodString;
            target: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }, {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    }, {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    }>;
    layers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        color: z.ZodString;
        visible: z.ZodBoolean;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }, {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }>, "many">;
    drift: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        status: z.ZodEnum<["unknown", "in_sync", "drifted"]>;
        lastCheckedAt: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    graph: {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    };
    layers: {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }[];
    drift?: Record<string, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }> | undefined;
}, {
    graph: {
        nodes: {
            id: string;
            kind: "compute" | "service" | "network" | "storage" | "control" | "data" | "security";
            label: string;
            layerId: string;
            position: {
                x: number;
                y: number;
            };
            config?: Record<string, unknown> | undefined;
        }[];
        edges: {
            id: string;
            kind: "network" | "control" | "data";
            source: string;
            target: string;
            label?: string | undefined;
        }[];
    };
    layers: {
        id: string;
        name: string;
        color: string;
        visible: boolean;
        order: number;
    }[];
    drift?: Record<string, {
        status: "unknown" | "in_sync" | "drifted";
        lastCheckedAt?: string | undefined;
        note?: string | undefined;
    }> | undefined;
}>;
export declare const versionCreateSchema: z.ZodObject<{
    name: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    notes?: string | undefined;
}, {
    name: string;
    notes?: string | undefined;
}>;
export declare const driftUpdateSchema: z.ZodObject<{
    nodeId: z.ZodString;
    status: z.ZodEnum<["unknown", "in_sync", "drifted"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "unknown" | "in_sync" | "drifted";
    nodeId: string;
    note?: string | undefined;
}, {
    status: "unknown" | "in_sync" | "drifted";
    nodeId: string;
    note?: string | undefined;
}>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;
export type DriftUpdateInput = z.infer<typeof driftUpdateSchema>;
export declare const DEFAULT_LAYERS: Layer[];
export declare const DEFAULT_GRAPH: Graph;
export declare const EMPTY_DRIFT: DriftState;
//# sourceMappingURL=index.d.ts.map