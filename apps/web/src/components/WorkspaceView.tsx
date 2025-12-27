import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type Node,
  type XYPosition,
} from "reactflow";
import type {
  DriftState,
  Layer,
  NodeKind,
  Plan,
  PlanVersion,
} from "@planemgr/domain";
import { api } from "../api";
import {
  flowToGraph,
  graphToFlowEdges,
  graphToFlowNodes,
  type PlanNodeData,
} from "../graph";
import { PlanNode } from "./PlanNode";
import "reactflow/dist/style.css";

const nodePalette: { kind: NodeKind; label: string; description: string }[] = [
  {
    kind: "compute",
    label: "Compute",
    description: "Bare metal or VM capacity.",
  },
  {
    kind: "service",
    label: "Service",
    description: "Applications and workloads.",
  },
  {
    kind: "network",
    label: "Network",
    description: "Routes, gateways, links.",
  },
  { kind: "storage", label: "Storage", description: "Stateful data systems." },
  {
    kind: "control",
    label: "Control",
    description: "Schedulers and control loops.",
  },
  { kind: "data", label: "Data", description: "Streams and data flows." },
  { kind: "security", label: "Security", description: "Secrets and policy." },
];

const createId = (prefix: string) => {
  if ("randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const mapVisibility = (layers: Layer[]) =>
  new Map(layers.map((layer) => [layer.id, layer.visible]));

const applyLayerVisibility = (
  nodes: Node<PlanNodeData>[],
  layers: Layer[],
): Node<PlanNodeData>[] => {
  const visibility = mapVisibility(layers);
  return nodes.map((node) => ({
    ...node,
    hidden: !(visibility.get(node.data.layerId) ?? true),
  }));
};

const applyEdgeVisibility = (
  edges: Edge[],
  nodes: Node<PlanNodeData>[],
): Edge[] => {
  const hiddenNodes = new Set(
    nodes.filter((node) => node.hidden).map((node) => node.id),
  );
  return edges.map((edge) => ({
    ...edge,
    hidden: hiddenNodes.has(edge.source) || hiddenNodes.has(edge.target),
  }));
};

const applyDriftStatus = (
  nodes: Node<PlanNodeData>[],
  drift: DriftState,
): Node<PlanNodeData>[] =>
  nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      driftStatus: drift[node.id]?.status ?? "unknown",
    },
  }));

export const WorkspaceView = ({
  username,
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) => {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [drift, setDrift] = useState<DriftState>({});
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionNotes, setVersionNotes] = useState("");
  const [baseVersionId, setBaseVersionId] = useState<string | undefined>(
    undefined,
  );
  const [activeLayerId, setActiveLayerId] = useState<string | undefined>(
    undefined,
  );

  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<PlanNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ planNode: PlanNode }), []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    const workspace = await api.getWorkspace();
    setLayers(workspace.layers);
    setDrift(workspace.drift);
    setActiveLayerId((current) => current ?? workspace.layers[0]?.id);
    const flowNodes = graphToFlowNodes(
      workspace.graph,
      workspace.layers,
      workspace.drift,
    );
    const flowEdges = applyEdgeVisibility(
      graphToFlowEdges(workspace.graph),
      flowNodes,
    );
    setNodes(flowNodes);
    setEdges(flowEdges);
    setDirty(false);
    setLoading(false);
  }, [setEdges, setNodes]);

  const loadVersions = useCallback(async () => {
    const response = await api.listVersions();
    setVersions(response.versions);
    setBaseVersionId((current) => current ?? response.versions[0]?.id);
  }, []);

  useEffect(() => {
    Promise.all([loadWorkspace(), loadVersions()]).catch((error) => {
      console.error(error);
      setStatus("Failed to load workspace.");
      setLoading(false);
    });
  }, [loadWorkspace, loadVersions]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      if (changes.length > 0) {
        setDirty(true);
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (changes.length > 0) {
        setDirty(true);
      }
    },
    [onEdgesChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      const edge: Edge = {
        id: createId("edge"),
        source: connection.source,
        target: connection.target,
        type: "smoothstep",
        data: { kind: "data" },
      };
      setEdges((current) => addEdge(edge, current));
      setDirty(true);
    },
    [setEdges],
  );

  const handleToggleLayer = (layerId: string) => {
    const updated = layers.map((layer) =>
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
    );
    setLayers(updated);
    const updatedNodes = applyLayerVisibility(nodes, updated);
    setNodes(updatedNodes);
    setEdges((current) => applyEdgeVisibility(current, updatedNodes));
    setDirty(true);
  };

  const handleAddNode = useCallback(
    (kind: NodeKind, position?: XYPosition) => {
      const layerId = activeLayerId ?? layers[0]?.id;
      if (!layerId) {
        return;
      }
      const layer = layers.find((item) => item.id === layerId);
      const newNode: Node<PlanNodeData> = {
        id: createId("node"),
        type: "planNode",
        position:
          position ?? {
            x: 180 + Math.random() * 220,
            y: 120 + Math.random() * 200,
          },
        data: {
          label: `${kind[0].toUpperCase()}${kind.slice(1)}`,
          kind,
          layerId,
          layerColor: layer?.color ?? "#ffffff",
          driftStatus: "unknown",
          config: { provider: "generic" },
        },
      };
      setNodes((current) => [...current, newNode]);
      setDirty(true);
    },
    [activeLayerId, layers, setNodes],
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
      event.dataTransfer.setData("application/planemgr-node", kind);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const kind = event.dataTransfer.getData("application/planemgr-node");
      if (!kind || !nodePalette.some((item) => item.kind === kind)) {
        return;
      }

      const instance = reactFlowInstance.current;
      if (!instance) {
        return;
      }

      const screenPosition = { x: event.clientX, y: event.clientY };
      let position: XYPosition;

      if ("screenToFlowPosition" in instance) {
        position = instance.screenToFlowPosition(screenPosition);
      } else if (reactFlowWrapper.current) {
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        position = instance.project({
          x: screenPosition.x - bounds.left,
          y: screenPosition.y - bounds.top,
        });
      } else {
        position = instance.project(screenPosition);
      }

      handleAddNode(kind as NodeKind, position);
    },
    [handleAddNode],
  );

  const handleSaveWorkspace = async () => {
    try {
      const graph = flowToGraph(nodes, edges);
      const updated = await api.updateWorkspace({
        graph,
        layers,
        drift,
      });
      setLayers(updated.layers);
      setDrift(updated.drift);
      const flowNodes = graphToFlowNodes(
        updated.graph,
        updated.layers,
        updated.drift,
      );
      const flowEdges = applyEdgeVisibility(
        graphToFlowEdges(updated.graph),
        flowNodes,
      );
      setNodes(flowNodes);
      setEdges(flowEdges);
      setDirty(false);
      setStatus("Workspace saved.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to save workspace.");
    }
  };

  const handleCreateVersion = async () => {
    if (!versionName.trim()) {
      setStatus("Version name is required.");
      return;
    }
    try {
      const version = await api.createVersion(
        versionName.trim(),
        versionNotes.trim() || undefined,
      );
      setVersions((current) => [version, ...current]);
      setBaseVersionId(version.id);
      setVersionName("");
      setVersionNotes("");
      setStatus("Version saved.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to save version.");
    }
  };

  const handleGeneratePlan = async () => {
    try {
      const generated = await api.createPlan(baseVersionId);
      setPlan(generated);
      setStatus("Plan generated.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to generate plan.");
    }
  };

  const handleUpdateDrift = async (
    nodeId: string,
    status: "in_sync" | "drifted",
  ) => {
    try {
      const updated = await api.updateDrift({ nodeId, status });
      setDrift(updated.drift);
      setNodes((current) => applyDriftStatus(current, updated.drift));
      setStatus("Drift updated.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to update drift.");
    }
  };

  const handleResetStatus = () => setStatus(null);

  const driftNodes = nodes;

  return (
    <div className="workspace">
      <header className="workspace__header">
        <div>
          <div className="workspace__title">Plane Manager</div>
          <div className="workspace__subtitle">
            Infrastructure as visualization
          </div>
        </div>
        <div className="workspace__header-actions">
          <div className="workspace__user">{username}</div>
          <button className="ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace__body">
        <aside className="workspace__sidebar">
          <section className="panel">
            <div className="panel__title">Palette</div>
            <div className="panel__content">
              {nodePalette.map((item) => (
                <button
                  key={item.kind}
                  className="palette__item"
                  draggable
                  onClick={() => handleAddNode(item.kind)}
                  onDragStart={(event) => handleDragStart(event, item.kind)}
                >
                  <div>
                    <div className="palette__label">{item.label}</div>
                    <div className="palette__desc">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__title">Planes</div>
            <div className="panel__content">
              {layers.map((layer) => (
                <div key={layer.id} className="layer">
                  <button
                    className={`layer__toggle ${layer.visible ? "is-active" : ""}`}
                    onClick={() => handleToggleLayer(layer.id)}
                    style={{ borderColor: layer.color }}
                  >
                    <span
                      className="layer__dot"
                      style={{ background: layer.color }}
                    />
                    {layer.name}
                  </button>
                  <button
                    className={`layer__select ${activeLayerId === layer.id ? "is-active" : ""}`}
                    onClick={() => setActiveLayerId(layer.id)}
                  >
                    Active
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__title">Workspace</div>
            <div className="panel__content panel__content--stack">
              <button onClick={handleSaveWorkspace} disabled={loading}>
                Save workspace
              </button>
              <button className="ghost" onClick={loadWorkspace}>
                Reload
              </button>
              <div className={`workspace__status ${dirty ? "is-dirty" : ""}`}>
                {dirty ? "Unsaved changes" : "All changes saved"}
              </div>
            </div>
          </section>
        </aside>

        <main
          className="workspace__canvas"
          ref={reactFlowWrapper}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="canvas__overlay">
            <span>Visual Infrastructure Plane</span>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              reactFlowInstance.current = instance;
            }}
            proOptions={{ hideAttribution: true }}
            fitView
          >
            <Background gap={24} size={1} />
            <MiniMap zoomable pannable />
            <Controls />
          </ReactFlow>
        </main>

        <aside className="workspace__sidebar workspace__sidebar--right">
          <section className="panel">
            <div className="panel__title">Plan Versions</div>
            <div className="panel__content panel__content--stack">
              <label className="field">
                <span>Version name</span>
                <input
                  value={versionName}
                  onChange={(event) => setVersionName(event.target.value)}
                  placeholder="e.g. multi-region rollout"
                />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  value={versionNotes}
                  onChange={(event) => setVersionNotes(event.target.value)}
                  placeholder="What changed and why?"
                />
              </label>
              <button onClick={handleCreateVersion}>Save version</button>
              <div className="versions">
                {versions.length === 0 ? (
                  <div className="muted">No versions yet.</div>
                ) : (
                  versions.map((version) => (
                    <button
                      key={version.id}
                      className={`version ${baseVersionId === version.id ? "is-active" : ""}`}
                      onClick={() => setBaseVersionId(version.id)}
                    >
                      <div>{version.name}</div>
                      <div className="version__meta">
                        {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__title">Execution Plan</div>
            <div className="panel__content panel__content--stack">
              <button onClick={handleGeneratePlan}>Generate plan</button>
              {plan ? (
                <div className="plan">
                  <div className="plan__stats">
                    <span>+{plan.stats.adds}</span>
                    <span>~{plan.stats.updates}</span>
                    <span>-{plan.stats.deletes}</span>
                  </div>
                  <div className="plan__list">
                    {plan.operations.map((op) => (
                      <div
                        key={op.id}
                        className={`plan__item plan__item--${op.action}`}
                      >
                        <div className="plan__item-title">{op.summary}</div>
                        <div className="plan__item-meta">
                          {op.target} · {op.targetId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="muted">
                  Generate a plan to see the execution steps.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__title">Drift</div>
            <div className="panel__content panel__content--stack">
              {driftNodes.length === 0 ? (
                <div className="muted">No nodes available yet.</div>
              ) : (
                driftNodes.map((node) => (
                  <div key={node.id} className="drift">
                    <div>
                      <div className="drift__label">{node.data.label}</div>
                      <div className="drift__meta">
                        {node.data.kind} · {node.data.driftStatus}
                      </div>
                    </div>
                    <div className="drift__actions">
                      <button
                        onClick={() => handleUpdateDrift(node.id, "drifted")}
                        className="ghost"
                      >
                        Mark drifted
                      </button>
                      <button
                        onClick={() => handleUpdateDrift(node.id, "in_sync")}
                        className="ghost"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div className="drift__hint">
                Use drift to reconcile live infra vs planned changes.
              </div>
            </div>
          </section>
        </aside>
      </div>

      {status ? (
        <div className="toast" onClick={handleResetStatus}>
          {status}
        </div>
      ) : null}

      {loading ? <div className="loading">Loading workspace...</div> : null}
    </div>
  );
};
