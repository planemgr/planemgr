import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DEFAULT_GRAPH,
  DEFAULT_LAYERS,
  driftItemSchema,
  edgeKindSchema,
  layerSchema,
  nodeKindSchema,
  type DriftItem,
  type DriftState,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type Layer,
  type PlanVersion,
  type Position,
  type Workspace,
  type WorkspaceUpdateInput,
  type VersionCreateInput,
  type DriftUpdateInput
} from "@planemgr/domain";
import type { Storage } from "./storage";

// OpenTofu JSON is the source of truth; planemgr.json only holds UI metadata keyed by node id.
const WORKSPACE_ID = "default";
const WORKSPACE_NAME = "Default Workspace";
const TF_FILENAME = "planemgr.tf.json";
const METADATA_FILENAME = "planemgr.json";
const DEFAULT_POSITION: Position = { x: 120, y: 160 };
const POSITION_OFFSET: Position = { x: 220, y: 120 };
const LOG_FIELD_SEPARATOR = "\x1f";
const LOG_RECORD_SEPARATOR = "\x1e";
const DRAFT_SUBJECT = "Draft: workspace";
const DRAFT_BODY = "Planemgr draft commit.";

type PlanemgrNodeDefinition = {
  kind: GraphNode["kind"];
  label: string;
  layerId: string;
  config?: Record<string, unknown>;
};

type PlanemgrEdgeDefinition = {
  kind: GraphEdge["kind"];
  source: string;
  target: string;
  label?: string;
};

type PlanemgrTfState = {
  nodes: Record<string, PlanemgrNodeDefinition>;
  edges: Record<string, PlanemgrEdgeDefinition>;
  layers: Layer[];
};

type NodeMetadata = {
  position?: Position;
  drift?: DriftItem;
  [key: string]: unknown;
};

type PlanemgrMetadata = {
  nodes?: Record<string, NodeMetadata>;
  [key: string]: unknown;
};

type VersionEntry = {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readJsonFile = async (filePath: string): Promise<unknown | null> => {
  try {
    const contents = await fs.readFile(filePath, "utf-8");
    return JSON.parse(contents) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const writeJsonFile = async (filePath: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, payload, "utf-8");
};

const parseLayers = (value: unknown): Layer[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const layers: Layer[] = [];
  for (const item of value) {
    const parsed = layerSchema.safeParse(item);
    if (parsed.success) {
      layers.push(parsed.data);
    }
  }
  return layers;
};

const parseNodeDefinitions = (value: unknown): Record<string, PlanemgrNodeDefinition> => {
  if (!isRecord(value)) {
    return {};
  }
  const nodes: Record<string, PlanemgrNodeDefinition> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    const kindParsed = nodeKindSchema.safeParse(entry.kind);
    const label = typeof entry.label === "string" ? entry.label : "";
    const layerId = typeof entry.layerId === "string" ? entry.layerId : "";
    if (!kindParsed.success || !label || !layerId) {
      continue;
    }
    nodes[id] = {
      kind: kindParsed.data,
      label,
      layerId,
      config: isRecord(entry.config) ? entry.config : undefined
    };
  }
  return nodes;
};

const parseEdgeDefinitions = (value: unknown): Record<string, PlanemgrEdgeDefinition> => {
  if (!isRecord(value)) {
    return {};
  }
  const edges: Record<string, PlanemgrEdgeDefinition> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    const kindParsed = edgeKindSchema.safeParse(entry.kind);
    const source = typeof entry.source === "string" ? entry.source : "";
    const target = typeof entry.target === "string" ? entry.target : "";
    const label = typeof entry.label === "string" ? entry.label : undefined;
    if (!kindParsed.success || !source || !target) {
      continue;
    }
    edges[id] = {
      kind: kindParsed.data,
      source,
      target,
      label
    };
  }
  return edges;
};

const parsePlanemgrTf = (raw: unknown): PlanemgrTfState => {
  if (!isRecord(raw)) {
    return { nodes: {}, edges: {}, layers: [] };
  }
  const locals = isRecord(raw.locals) ? raw.locals : {};
  const planemgr = isRecord(locals.planemgr) ? locals.planemgr : {};
  const nodesRaw = isRecord(planemgr.nodes)
    ? planemgr.nodes
    : isRecord(locals.planemgr_nodes)
      ? locals.planemgr_nodes
      : {};
  const edgesRaw = isRecord(planemgr.edges)
    ? planemgr.edges
    : isRecord(locals.planemgr_edges)
      ? locals.planemgr_edges
      : {};
  const layersRaw = Array.isArray(planemgr.layers)
    ? planemgr.layers
    : Array.isArray(locals.planemgr_layers)
      ? locals.planemgr_layers
      : [];
  return {
    nodes: parseNodeDefinitions(nodesRaw),
    edges: parseEdgeDefinitions(edgesRaw),
    layers: parseLayers(layersRaw)
  };
};

const buildTfPayload = (graph: Graph, layers: Layer[]) => {
  const nodes = Object.fromEntries(
    [...graph.nodes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => {
        const definition: PlanemgrNodeDefinition = {
          kind: node.kind,
          label: node.label,
          layerId: node.layerId
        };
        if (node.config && Object.keys(node.config).length > 0) {
          definition.config = node.config;
        }
        return [node.id, definition];
      })
  );
  const edges = Object.fromEntries(
    [...graph.edges]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => {
        const definition: PlanemgrEdgeDefinition = {
          kind: edge.kind,
          source: edge.source,
          target: edge.target
        };
        if (edge.label) {
          definition.label = edge.label;
        }
        return [edge.id, definition];
      })
  );
  return {
    locals: {
      planemgr: {
        nodes,
        edges,
        layers
      }
    }
  };
};

const parseMetadata = (raw: unknown): PlanemgrMetadata => {
  if (!isRecord(raw)) {
    return {};
  }
  return { ...raw };
};

const runGit = (cwd: string, args: string[], allowFailure = false): string | null => {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (result.error) {
    if (allowFailure) {
      return null;
    }
    throw new Error(`git ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (allowFailure) {
      return null;
    }
    const stderr = (result.stderr ?? "").toString().trim();
    throw new Error(`git ${args.join(" ")} failed: ${stderr || "unknown error"}`);
  }
  return result.stdout ?? "";
};

// Git commit subject/body map to version name/notes for the UI.
const parseGitRecord = (record: string): VersionEntry | null => {
  const parts = record.split(LOG_FIELD_SEPARATOR);
  if (parts.length < 3) {
    return null;
  }
  const [id, timestampRaw, name, ...rest] = parts;
  if (!id || !timestampRaw || !name) {
    return null;
  }
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const notesRaw = rest.join(LOG_FIELD_SEPARATOR).trim();
  return {
    id,
    name,
    notes: notesRaw ? notesRaw : undefined,
    createdAt: new Date(timestamp * 1000).toISOString()
  };
};

const parseGitLog = (output: string): VersionEntry[] => {
  const records = output
    .split(LOG_RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean);
  const versions: VersionEntry[] = [];
  for (const record of records) {
    const entry = parseGitRecord(record);
    if (entry) {
      versions.push(entry);
    }
  }
  return versions;
};

const isDraftSubject = (subject: string) => subject.trim() === DRAFT_SUBJECT;

const buildWorkspaceGraph = (
  tfState: PlanemgrTfState,
  metadata: PlanemgrMetadata
): { graph: Graph; drift: DriftState; metadata: PlanemgrMetadata; updated: boolean } => {
  const nodesMetadata = isRecord(metadata.nodes) ? { ...metadata.nodes } : {};
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const drift: DriftState = {};
  let lastPosition: Position | null = null;
  let updated = false;

  for (const [id, definition] of Object.entries(tfState.nodes)) {
    const metaEntry = isRecord(nodesMetadata[id]) ? { ...nodesMetadata[id] } : {};
    const positionValue = isRecord(metaEntry.position) ? metaEntry.position : null;
    const positionIsValid =
      positionValue && typeof positionValue.x === "number" && typeof positionValue.y === "number";
    const position = positionIsValid
      ? { x: positionValue.x, y: positionValue.y }
      : lastPosition
        ? { x: lastPosition.x + POSITION_OFFSET.x, y: lastPosition.y + POSITION_OFFSET.y }
        : { ...DEFAULT_POSITION };
    if (!positionIsValid) {
      metaEntry.position = position;
      updated = true;
    }
    nodesMetadata[id] = metaEntry;
    lastPosition = position;

    const driftValue = isRecord(metaEntry.drift) ? metaEntry.drift : undefined;
    const driftParsed = driftItemSchema.safeParse(driftValue);
    if (driftParsed.success) {
      drift[id] = driftParsed.data;
    } else {
      const defaultDrift: DriftItem = { status: "unknown" };
      drift[id] = defaultDrift;
      metaEntry.drift = defaultDrift;
      updated = true;
    }

    nodes.push({
      id,
      kind: definition.kind,
      label: definition.label,
      layerId: definition.layerId,
      position,
      config: definition.config
    });
  }

  for (const [id, definition] of Object.entries(tfState.edges)) {
    edges.push({
      id,
      kind: definition.kind,
      source: definition.source,
      target: definition.target,
      label: definition.label
    });
  }

  return {
    graph: { nodes, edges },
    drift,
    metadata: { ...metadata, nodes: nodesMetadata },
    updated
  };
};

export class IacStorage implements Storage {
  constructor(private readonly iacDir: string) {}

  private tfPath() {
    return path.join(this.iacDir, TF_FILENAME);
  }

  private metadataPath() {
    return path.join(this.iacDir, METADATA_FILENAME);
  }

  private runGit(args: string[], allowFailure = false) {
    return runGit(this.iacDir, args, allowFailure);
  }

  private hasHeadCommit() {
    const output = this.runGit(["rev-parse", "--verify", "HEAD"], true);
    return Boolean(output?.trim());
  }

  private headSubject(): string | null {
    if (!this.hasHeadCommit()) {
      return null;
    }
    const output = this.runGit(["show", "-s", "--format=%s", "HEAD"], true);
    return output ? output.trim() : null;
  }

  private isDraftHead() {
    const subject = this.headSubject();
    return subject ? isDraftSubject(subject) : false;
  }

  private isWorkingTreeDirty() {
    const output = this.runGit(
      ["status", "--porcelain", "--", TF_FILENAME, METADATA_FILENAME],
      true
    );
    return Boolean(output?.trim());
  }

  private stageWorkspaceFiles() {
    this.runGit(["add", TF_FILENAME, METADATA_FILENAME]);
  }

  private commitDraft() {
    // Draft commits keep the repo clean between explicit version saves.
    this.stageWorkspaceFiles();
    const args = this.isDraftHead()
      ? ["commit", "--amend", "--allow-empty", "-m", DRAFT_SUBJECT, "-m", DRAFT_BODY]
      : ["commit", "--allow-empty", "-m", DRAFT_SUBJECT, "-m", DRAFT_BODY];
    this.runGit(args);
  }

  private ensureDraftCommit() {
    if (!this.isWorkingTreeDirty()) {
      return;
    }
    this.commitDraft();
  }

  private readCommitMetadata(commitId: string): VersionEntry | null {
    const output = this.runGit(
      ["show", "-s", `--format=%H%x1f%ct%x1f%s%x1f%b`, commitId],
      true
    );
    if (!output) {
      return null;
    }
    return parseGitRecord(output.trim());
  }

  private listCommitMetadata(): VersionEntry[] {
    const output = this.runGit(
      ["log", `--format=%H%x1f%ct%x1f%s%x1f%b%x1e`],
      true
    );
    if (!output) {
      return [];
    }
    return parseGitLog(output);
  }

  private readTfAtCommit(commitId: string): PlanemgrTfState | null {
    const output = this.runGit(["show", `${commitId}:${TF_FILENAME}`], true);
    if (!output) {
      return null;
    }
    try {
      const parsed = JSON.parse(output) as unknown;
      return parsePlanemgrTf(parsed);
    } catch (error) {
      return null;
    }
  }

  private async loadTfState(filePath: string): Promise<PlanemgrTfState> {
    const raw = await readJsonFile(filePath);
    if (!raw) {
      return { nodes: {}, edges: {}, layers: [] };
    }
    return parsePlanemgrTf(raw);
  }

  private async ensureWorkspaceFiles(): Promise<void> {
    const tfPath = this.tfPath();
    const existing = await readJsonFile(tfPath);
    if (existing) {
      return;
    }
    const tfPayload = buildTfPayload(DEFAULT_GRAPH, DEFAULT_LAYERS);
    await writeJsonFile(tfPath, tfPayload);

    const metadata: PlanemgrMetadata = {
      nodes: Object.fromEntries(
        DEFAULT_GRAPH.nodes.map((node) => [node.id, { position: node.position }])
      )
    };
    await writeJsonFile(this.metadataPath(), metadata);
  }

  private async loadMetadata(): Promise<PlanemgrMetadata> {
    const raw = await readJsonFile(this.metadataPath());
    return parseMetadata(raw);
  }

  private async saveMetadata(metadata: PlanemgrMetadata): Promise<void> {
    await writeJsonFile(this.metadataPath(), metadata);
  }

  private async loadWorkspace(): Promise<{
    graph: Graph;
    layers: Layer[];
    drift: DriftState;
    metadata: PlanemgrMetadata;
    metadataUpdated: boolean;
  }> {
    await this.ensureWorkspaceFiles();
    const tfState = await this.loadTfState(this.tfPath());
    const layers = tfState.layers.length > 0 ? tfState.layers : DEFAULT_LAYERS;
    const metadata = await this.loadMetadata();
    const { graph, drift, metadata: merged, updated } = buildWorkspaceGraph(
      { ...tfState, layers },
      metadata
    );
    return {
      graph,
      layers,
      drift,
      metadata: merged,
      metadataUpdated: updated
    };
  }

  async getWorkspace(): Promise<Workspace> {
    const { graph, layers, drift, metadata, metadataUpdated } = await this.loadWorkspace();
    if (metadataUpdated) {
      await this.saveMetadata(metadata);
    }
    return {
      id: WORKSPACE_ID,
      name: WORKSPACE_NAME,
      graph,
      layers,
      drift,
      updatedAt: new Date().toISOString()
    };
  }

  async updateWorkspace(input: WorkspaceUpdateInput): Promise<Workspace> {
    const tfPayload = buildTfPayload(input.graph, input.layers);
    await writeJsonFile(this.tfPath(), tfPayload);

    const existingMetadata = await this.loadMetadata();
    const metadataNodes = isRecord(existingMetadata.nodes) ? { ...existingMetadata.nodes } : {};
    const driftState = input.drift ?? {};

    for (const node of input.graph.nodes) {
      const metaEntry = isRecord(metadataNodes[node.id]) ? { ...metadataNodes[node.id] } : {};
      metaEntry.position = node.position;
      if (driftState[node.id]) {
        metaEntry.drift = driftState[node.id];
      }
      metadataNodes[node.id] = metaEntry;
    }

    const nextMetadata: PlanemgrMetadata = { ...existingMetadata, nodes: metadataNodes };
    await this.saveMetadata(nextMetadata);
    this.ensureDraftCommit();

    return this.getWorkspace();
  }

  async listVersions(): Promise<PlanVersion[]> {
    const entries = this.listCommitMetadata();
    const versions: PlanVersion[] = [];

    for (const entry of entries) {
      const tfState = this.readTfAtCommit(entry.id);
      if (!tfState) {
        continue;
      }
      const layers = tfState.layers.length > 0 ? tfState.layers : DEFAULT_LAYERS;
      const { graph } = buildWorkspaceGraph({ ...tfState, layers }, {});
      versions.push({
        id: entry.id,
        workspaceId: WORKSPACE_ID,
        name: entry.name,
        notes: entry.notes,
        graph,
        layers,
        createdAt: entry.createdAt
      });
    }

    return versions;
  }

  async getVersion(id: string): Promise<PlanVersion | null> {
    const entry = this.readCommitMetadata(id);
    if (!entry) {
      return null;
    }
    const tfState = this.readTfAtCommit(entry.id);
    if (!tfState) {
      return null;
    }
    const layers = tfState.layers.length > 0 ? tfState.layers : DEFAULT_LAYERS;
    const { graph } = buildWorkspaceGraph({ ...tfState, layers }, {});
    return {
      id: entry.id,
      workspaceId: WORKSPACE_ID,
      name: entry.name,
      notes: entry.notes,
      graph,
      layers,
      createdAt: entry.createdAt
    };
  }

  async getLatestVersion(): Promise<PlanVersion | null> {
    const versions = await this.listVersions();
    return versions[0] ?? null;
  }

  async createVersion(input: VersionCreateInput): Promise<PlanVersion> {
    const workspace = await this.getWorkspace();
    this.stageWorkspaceFiles();
    const commitArgs = this.isDraftHead()
      ? ["commit", "--amend", "--allow-empty", "-m", input.name]
      : ["commit", "--allow-empty", "-m", input.name];
    if (input.notes) {
      commitArgs.push("-m", input.notes);
    }
    this.runGit(commitArgs);
    const entry = this.readCommitMetadata("HEAD");
    if (!entry) {
      throw new Error("Failed to read version commit metadata.");
    }
    this.commitDraft();

    return {
      id: entry.id,
      workspaceId: workspace.id,
      name: entry.name,
      notes: entry.notes,
      graph: workspace.graph,
      layers: workspace.layers,
      createdAt: entry.createdAt
    };
  }

  async updateDrift(input: DriftUpdateInput): Promise<Workspace> {
    const metadata = await this.loadMetadata();
    const nodesMetadata = isRecord(metadata.nodes) ? { ...metadata.nodes } : {};
    const metaEntry = isRecord(nodesMetadata[input.nodeId]) ? { ...nodesMetadata[input.nodeId] } : {};
    metaEntry.drift = {
      status: input.status,
      note: input.note,
      lastCheckedAt: new Date().toISOString()
    };
    nodesMetadata[input.nodeId] = metaEntry;
    await this.saveMetadata({ ...metadata, nodes: nodesMetadata });

    return this.getWorkspace();
  }

  async checkoutVersion(
    id: string,
    options?: { commitDraft?: boolean }
  ): Promise<Workspace> {
    if (options?.commitDraft ?? true) {
      this.ensureDraftCommit();
    }
    const entry = this.readCommitMetadata(id);
    if (!entry) {
      throw new Error("version_not_found");
    }
    this.runGit(["checkout", id, "--", TF_FILENAME, METADATA_FILENAME]);
    return this.getWorkspace();
  }
}
