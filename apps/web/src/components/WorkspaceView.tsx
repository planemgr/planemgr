import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  PlanVersion,
  UserProfile,
  Workspace,
} from "@planemgr/domain";
import { api } from "../api";
import {
  flowToGraph,
  graphToFlowEdges,
  graphToFlowNodes,
  DEFAULT_PLATFORM_SIZE,
  type PlanNodeData,
} from "../graph";
import { PlanNode } from "./PlanNode";
import { PlatformNode } from "./PlatformNode";
import "reactflow/dist/style.css";

const LOCAL_DRAFT_ID = "draft-local";
const DRAFT_COMMIT_NAME = "Draft: workspace";

const nodePaletteByKind: Record<
  NodeKind,
  { label: string; description: string }
> = {
  platform: {
    label: "Platform",
    description: "PaaS, cluster, or bare metal foundation.",
  },
  compute: {
    label: "Compute",
    description: "Bare metal or VM capacity.",
  },
  service: {
    label: "Service",
    description: "Applications and workloads.",
  },
  network: {
    label: "Network",
    description: "Routes, gateways, links.",
  },
  storage: {
    label: "Storage",
    description: "Stateful data systems.",
  },
  control: {
    label: "Control",
    description: "Schedulers and control loops.",
  },
  data: {
    label: "Data",
    description: "Streams and data flows.",
  },
  security: {
    label: "Security",
    description: "Secrets and policy.",
  },
};

const paletteByLayer: Record<string, NodeKind[]> = {
  physical: ["platform", "compute", "network", "storage", "security"],
  infra: ["platform", "compute", "network", "storage", "security"],
  control: ["control", "network", "security"],
  service: ["service", "data", "storage"],
};

const allPaletteKinds = Object.keys(nodePaletteByKind) as NodeKind[];

const resolvePaletteKinds = (layerId?: string) =>
  paletteByLayer[layerId ?? ""] ?? allPaletteKinds;

const layerPresets = [
  {
    id: "physical",
    name: "Physical",
    color: "#f2c879",
    order: 1,
  },
  {
    id: "infra",
    name: "Infrastructure",
    color: "#ffb454",
    order: 2,
  },
  {
    id: "control",
    name: "Control",
    color: "#7cc4ff",
    order: 3,
  },
  {
    id: "service",
    name: "Services",
    color: "#f37cc1",
    order: 4,
  },
];

const normalizeLayers = (layers: Layer[]): Layer[] => {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  return layerPresets.map((preset) => {
    const existing = byId.get(preset.id);
    return {
      id: preset.id,
      name: preset.name,
      color: existing?.color ?? preset.color,
      visible: existing?.visible ?? true,
      order: preset.order,
    };
  });
};

const createId = (prefix: string) => {
  if ("randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const isPlatformNode = (node: Node<PlanNodeData>) => node.data.kind === "platform";

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

const resolvePlatformSize = (node: Node<PlanNodeData>) => {
  const width = parseNumericStyle(node.width ?? node.style?.width) ?? DEFAULT_PLATFORM_SIZE.width;
  const height =
    parseNumericStyle(node.height ?? node.style?.height) ?? DEFAULT_PLATFORM_SIZE.height;
  return { width, height };
};

const resolveAbsolutePosition = (node: Node<PlanNodeData>, nodes: Node<PlanNodeData>[]) => {
  if (node.parentNode) {
    const parent = nodes.find((candidate) => candidate.id === node.parentNode);
    if (parent) {
      const parentPosition = parent.position;
      return {
        x: parentPosition.x + node.position.x,
        y: parentPosition.y + node.position.y,
      };
    }
  }
  return node.position;
};

// Map a drop position to a platform container so UI grouping matches persisted platform membership.
const findPlatformAtPosition = (
  position: XYPosition,
  nodes: Node<PlanNodeData>[],
) => {
  const platforms = nodes.filter(isPlatformNode);
  const matches = platforms.filter((platform) => {
    const platformPosition = resolveAbsolutePosition(platform, nodes);
    const { width, height } = resolvePlatformSize(platform);
    return (
      position.x >= platformPosition.x &&
      position.x <= platformPosition.x + width &&
      position.y >= platformPosition.y &&
      position.y <= platformPosition.y + height
    );
  });
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
};

const mapVisibility = (layers: Layer[]) =>
  new Map(layers.map((layer) => [layer.id, layer.visible]));

const applyLayerVisibility = (
  nodes: Node<PlanNodeData>[],
  layers: Layer[],
  activeLayerId?: string,
): Node<PlanNodeData>[] => {
  const visibility = mapVisibility(layers);
  return nodes.map((node) => ({
    ...node,
    hidden: activeLayerId
      ? node.data.layerId !== activeLayerId
      : !(visibility.get(node.data.layerId) ?? true),
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

export const WorkspaceView = ({
  username,
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [drift, setDrift] = useState<DriftState>({});
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionNotes, setVersionNotes] = useState("");
  const [baseVersionId, setBaseVersionId] = useState<string | undefined>(
    undefined,
  );
  const [draftCreatedAt, setDraftCreatedAt] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | undefined>(
    undefined,
  );

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const activeLayerRef = useRef<string | undefined>(undefined);
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<PlanNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(
    () => ({ planNode: PlanNode, platformNode: PlatformNode }),
    [],
  );

  useEffect(() => {
    activeLayerRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    let isActive = true;
    api
      .getProfile()
      .then((data) => {
        if (isActive) {
          setProfile(data);
        }
      })
      .catch((error) => {
        console.error(error);
        if (isActive) {
          setProfileError("Unable to load profile key.");
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && profileMenuRef.current?.contains(target)) {
        return;
      }
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [profileOpen]);

  const activeVersion = useMemo(
    () => versions.find((version) => version.id === baseVersionId),
    [versions, baseVersionId],
  );

  const paletteKinds = useMemo(
    () => resolvePaletteKinds(activeLayerId),
    [activeLayerId],
  );
  const paletteItems = useMemo(
    () =>
      paletteKinds.map((kind) => ({
        kind,
        ...nodePaletteByKind[kind],
      })),
    [paletteKinds],
  );

  const isActiveDraft =
    !baseVersionId ||
    baseVersionId === LOCAL_DRAFT_ID ||
    activeVersion?.name === DRAFT_COMMIT_NAME;
  const isReadOnly = !isActiveDraft;
  const isBusy = isBootstrapping || isSwitchingVersion;
  const isEditingLocked = isReadOnly || isBusy;
  const overlayLabel = isBusy
    ? isSwitchingVersion
      ? "Loading version..."
      : "Loading workspace..."
    : null;

  const applyWorkspace = useCallback(
    (workspace: Workspace) => {
      const normalizedLayers = normalizeLayers(workspace.layers);
      const nextActiveLayerId =
        activeLayerRef.current &&
        normalizedLayers.some((layer) => layer.id === activeLayerRef.current)
          ? activeLayerRef.current
          : normalizedLayers[0]?.id;
      setLayers(normalizedLayers);
      setDrift(workspace.drift);
      setActiveLayerId(nextActiveLayerId);
      const flowNodes = graphToFlowNodes(
        workspace.graph,
        normalizedLayers,
        workspace.drift,
      );
      const visibleNodes = applyLayerVisibility(
        flowNodes,
        normalizedLayers,
        nextActiveLayerId,
      );
      const flowEdges = applyEdgeVisibility(
        graphToFlowEdges(workspace.graph),
        visibleNodes,
      );
      setNodes(visibleNodes);
      setEdges(flowEdges);
      setDirty(false);
    },
    [setEdges, setNodes],
  );

  const loadWorkspace = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const workspace = await api.getWorkspace();
      applyWorkspace(workspace);
    } finally {
      setIsBootstrapping(false);
    }
  }, [applyWorkspace]);

  const loadVersions = useCallback(
    async (options?: { selectId?: string; preserveSelection?: boolean }) => {
      const response = await api.listVersions();
      const defaultId =
        response.versions.find((version) => version.name === DRAFT_COMMIT_NAME)?.id ??
        response.versions[0]?.id;
      setVersions(response.versions);
      setBaseVersionId((current) => {
        if (options?.selectId) {
          return options.selectId;
        }
        if (
          options?.preserveSelection &&
          current &&
          response.versions.some((version) => version.id === current)
        ) {
          return current;
        }
        if (current === LOCAL_DRAFT_ID) {
          return defaultId ?? current;
        }
        if (current && response.versions.some((version) => version.id === current)) {
          return current;
        }
        return defaultId ?? current;
      });
    },
    [],
  );

  useEffect(() => {
    if (dirty) {
      setDraftCreatedAt((current) => current ?? new Date().toISOString());
    } else {
      setDraftCreatedAt(null);
    }
  }, [dirty]);

  useEffect(() => {
    if (!dirty && baseVersionId === LOCAL_DRAFT_ID) {
      const draftId = versions.find((version) => version.name === DRAFT_COMMIT_NAME)?.id;
      setBaseVersionId(draftId ?? versions[0]?.id);
    }
  }, [dirty, baseVersionId, versions]);

  useEffect(() => {
    if (dirty && !versions.some((version) => version.name === DRAFT_COMMIT_NAME)) {
      setBaseVersionId((current) => current ?? LOCAL_DRAFT_ID);
    }
  }, [dirty, versions]);

  const displayVersions = useMemo(() => {
    if (!dirty || versions.some((version) => version.name === DRAFT_COMMIT_NAME)) {
      return versions;
    }
    const graph = flowToGraph(nodes, edges);
    const draft: PlanVersion = {
      id: LOCAL_DRAFT_ID,
      workspaceId: "local",
      name: DRAFT_COMMIT_NAME,
      notes: "Unsaved local changes.",
      graph,
      layers,
      createdAt: draftCreatedAt ?? new Date().toISOString(),
    };
    return [draft, ...versions];
  }, [dirty, versions, nodes, edges, layers, draftCreatedAt]);

  useEffect(() => {
    Promise.all([loadWorkspace(), loadVersions()]).catch((error) => {
      console.error(error);
      setStatus("Failed to load workspace.");
      setIsBootstrapping(false);
    });
  }, [loadWorkspace, loadVersions]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (isEditingLocked) {
        return;
      }
      onNodesChange(changes);
      if (changes.length > 0) {
        setDirty(true);
      }
    },
    [onNodesChange, isEditingLocked],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (isEditingLocked) {
        return;
      }
      onEdgesChange(changes);
      if (changes.length > 0) {
        setDirty(true);
      }
    },
    [onEdgesChange, isEditingLocked],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      if (isEditingLocked) {
        if (isReadOnly) {
          setStatus("Check out the draft to edit.");
        }
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
    [setEdges, isEditingLocked, isReadOnly],
  );

  const handleSelectLayer = useCallback(
    (layerId: string) => {
      if (layerId === activeLayerId) {
        return;
      }
      setActiveLayerId(layerId);
      setNodes((current) => {
        const updatedNodes = applyLayerVisibility(current, layers, layerId);
        setEdges((currentEdges) => applyEdgeVisibility(currentEdges, updatedNodes));
        return updatedNodes;
      });
    },
    [activeLayerId, layers, setEdges, setNodes],
  );

  const handleAddNode = useCallback(
    (kind: NodeKind, position?: XYPosition) => {
      if (isEditingLocked) {
        if (isReadOnly) {
          setStatus("Check out the draft to edit.");
        }
        return;
      }
      const layerId = activeLayerId ?? layers[0]?.id;
      if (!layerId) {
        return;
      }
      const layer = layers.find((item) => item.id === layerId);
      const basePosition =
        position ?? {
          x: 180 + Math.random() * 220,
          y: 120 + Math.random() * 200,
        };
      const targetPlatform =
        kind !== "platform" && position
          ? findPlatformAtPosition(basePosition, nodes)
          : undefined;
      const platformPosition = targetPlatform
        ? resolveAbsolutePosition(targetPlatform, nodes)
        : null;
      const resolvedPosition = platformPosition
        ? {
            x: basePosition.x - platformPosition.x,
            y: basePosition.y - platformPosition.y,
          }
        : basePosition;
      const config =
        kind === "platform"
          ? { platform: "generic" }
          : { provider: "generic" };
      const newNode: Node<PlanNodeData> = {
        id: createId("node"),
        type: kind === "platform" ? "platformNode" : "planNode",
        position: resolvedPosition,
        parentNode: targetPlatform?.id,
        extent: targetPlatform ? "parent" : undefined,
        zIndex: kind === "platform" ? 0 : 1,
        style:
          kind === "platform"
            ? {
                width: DEFAULT_PLATFORM_SIZE.width,
                height: DEFAULT_PLATFORM_SIZE.height,
              }
            : undefined,
        data: {
          label: kind === "platform" ? "Platform" : `${kind[0].toUpperCase()}${kind.slice(1)}`,
          kind,
          layerId,
          layerColor: layer?.color ?? "#ffffff",
          driftStatus: "unknown",
          config,
        },
      };
      setNodes((current) => [...current, newNode]);
      setDirty(true);
    },
    [activeLayerId, layers, nodes, setNodes, isEditingLocked, isReadOnly],
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
      if (isEditingLocked) {
        return;
      }
      event.dataTransfer.setData("application/planemgr-node", kind);
      event.dataTransfer.effectAllowed = "move";
    },
    [isEditingLocked],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (isEditingLocked) {
        if (isReadOnly) {
          setStatus("Check out the draft to edit.");
        }
        return;
      }

      const kind = event.dataTransfer.getData("application/planemgr-node");
      if (!kind || !paletteKinds.includes(kind as NodeKind)) {
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
    [handleAddNode, isEditingLocked, isReadOnly, paletteKinds],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, draggedNode: Node<PlanNodeData>) => {
      if (isEditingLocked || draggedNode.data.kind === "platform") {
        return;
      }
      const absolutePosition = resolveAbsolutePosition(draggedNode, nodes);
      const targetPlatform = findPlatformAtPosition(absolutePosition, nodes);
      const nextParentId = targetPlatform?.id;
      if ((draggedNode.parentNode ?? null) === (nextParentId ?? null)) {
        return;
      }
      setNodes((current) => {
        const parent = nextParentId
          ? current.find((node) => node.id === nextParentId)
          : undefined;
        const parentPosition = parent ? parent.position : null;
        return current.map((node) => {
          if (node.id !== draggedNode.id) {
            return node;
          }
          if (parent && parentPosition) {
            return {
              ...node,
              parentNode: parent.id,
              extent: "parent",
              zIndex: 1,
              position: {
                x: absolutePosition.x - parentPosition.x,
                y: absolutePosition.y - parentPosition.y,
              },
              positionAbsolute: undefined,
              dragging: false,
            };
          }
          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
            zIndex: 1,
            position: absolutePosition,
            positionAbsolute: undefined,
            dragging: false,
          };
        });
      });
      setDirty(true);
    },
    [isEditingLocked, nodes, setNodes],
  );

  const handleCreateVersion = async () => {
    if (isEditingLocked) {
      setStatus(
        isReadOnly
          ? "Check out the draft to save a version."
          : "Version is loading.",
      );
      return;
    }
    if (!versionName.trim()) {
      setStatus("Version name is required.");
      return;
    }
    try {
      await api.createVersion(
        versionName.trim(),
        versionNotes.trim() || undefined,
      );
      await loadVersions({ preserveSelection: false });
      setVersionName("");
      setVersionNotes("");
      setStatus("Version saved.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to save version.");
    }
  };

  const handleCheckoutVersion = async (versionId: string) => {
    if (versionId === LOCAL_DRAFT_ID) {
      setStatus("Draft already loaded.");
      return;
    }
    if (isSwitchingVersion) {
      return;
    }
    try {
      setIsSwitchingVersion(true);
      if (isActiveDraft && dirty) {
        const graph = flowToGraph(nodes, edges);
        await api.updateWorkspace({ graph, layers, drift });
      }
      const workspace = await api.checkoutVersion(versionId, isActiveDraft);
      applyWorkspace(workspace);
      await loadVersions({ selectId: versionId });
      setStatus("Version checked out.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to check out version.");
    } finally {
      setIsSwitchingVersion(false);
    }
  };

  const handleResetStatus = () => setStatus(null);
  const handleCopyPublicKey = async () => {
    if (!profile?.sshPublicKey) {
      return;
    }
    if (!navigator.clipboard) {
      setProfileStatus("Clipboard unavailable.");
      window.setTimeout(() => setProfileStatus(null), 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.sshPublicKey);
      setProfileStatus("Public key copied.");
    } catch (error) {
      console.error(error);
      setProfileStatus("Unable to copy key.");
    }
    window.setTimeout(() => setProfileStatus(null), 2000);
  };

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
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="profile-menu__trigger"
              onClick={() => setProfileOpen((current) => !current)}
            >
              <span>{username}</span>
              <span className="profile-menu__chevron">▾</span>
            </button>
            {profileOpen ? (
              <div className="profile-menu__panel">
                <div className="profile-menu__title">Profile</div>
                <div className="profile-menu__label">SSH public key</div>
                {profileError ? (
                  <div className="muted">{profileError}</div>
                ) : profile ? (
                  <div className="profile-menu__key">{profile.sshPublicKey}</div>
                ) : (
                  <div className="muted">Generating key...</div>
                )}
                <div className="profile-menu__actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleCopyPublicKey}
                    disabled={!profile?.sshPublicKey}
                  >
                    Copy key
                  </button>
                </div>
                {profileStatus ? (
                  <div className="profile-menu__status">{profileStatus}</div>
                ) : null}
              </div>
            ) : null}
          </div>
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
              {paletteItems.map((item) => (
                <button
                  key={item.kind}
                  className="palette__item"
                  draggable={!isEditingLocked}
                  disabled={isEditingLocked}
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

        </aside>

        <main className={`workspace__canvas ${isReadOnly ? "is-readonly" : ""}`}>
          <div
            className="workspace__canvas-body"
            ref={reactFlowWrapper}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="canvas__overlay">
              <span>Visual Infrastructure Plane</span>
            </div>
            {isBusy || isReadOnly ? (
              <div className="canvas__readonly">
                {overlayLabel ? <span>{overlayLabel}</span> : null}
              </div>
            ) : null}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeDragStop={handleNodeDragStop}
              nodesDraggable={!isEditingLocked}
              nodesConnectable={!isEditingLocked}
              elementsSelectable={!isEditingLocked}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                reactFlowInstance.current = instance;
              }}
              proOptions={{ hideAttribution: true }}
              elevateNodesOnSelect={false}
              fitView
            >
              <Background gap={24} size={1} />
              <MiniMap zoomable pannable />
              <Controls />
            </ReactFlow>
          </div>
          <div className="layer-tabs" role="tablist" aria-label="Workspace layers">
            {layers
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  role="tab"
                  aria-selected={activeLayerId === layer.id}
                  className={`layer-tab ${activeLayerId === layer.id ? "is-active" : ""}`}
                  onClick={() => handleSelectLayer(layer.id)}
                  style={
                    {
                      "--layer-color": layer.color,
                    } as CSSProperties
                  }
                >
                  {layer.name}
                </button>
              ))}
          </div>
        </main>

        <aside className="workspace__sidebar workspace__sidebar--right">
          <section className="panel">
            <div className="panel__title">Plan Versions</div>
            <div className="panel__content panel__content--stack">
              <label className="field">
                <span>Version name</span>
                <input
                  value={versionName}
                  disabled={isEditingLocked}
                  onChange={(event) => setVersionName(event.target.value)}
                  placeholder="e.g. multi-region rollout"
                />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  value={versionNotes}
                  disabled={isEditingLocked}
                  onChange={(event) => setVersionNotes(event.target.value)}
                  placeholder="What changed and why?"
                />
              </label>
              <button onClick={handleCreateVersion} disabled={isEditingLocked}>
                Save version
              </button>
              <div className="versions">
                {displayVersions.length === 0 ? (
                  <div className="muted">No versions yet.</div>
                ) : (
                  displayVersions.map((version) => (
                    <button
                      key={version.id}
                      className={`version ${baseVersionId === version.id ? "is-active" : ""}`}
                      onClick={() => handleCheckoutVersion(version.id)}
                      disabled={version.id === LOCAL_DRAFT_ID || isBusy}
                    >
                      <div>
                        {version.id === LOCAL_DRAFT_ID
                          ? "Draft (unsaved)"
                          : version.name === DRAFT_COMMIT_NAME
                            ? dirty
                              ? "Draft (unsaved)"
                              : "Draft (current)"
                            : version.name}
                      </div>
                      <div className="version__meta">
                        {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
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

    </div>
  );
};
