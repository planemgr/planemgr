import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
  DEFAULT_GRAPH,
  DEFAULT_LAYERS,
  EMPTY_DRIFT,
  type DriftUpdateInput,
  type PlanVersion,
  type Workspace,
  type WorkspaceUpdateInput,
  type VersionCreateInput
} from "@planemgr/domain";
import type { Storage } from "./storage";

const WORKSPACE_ID = "default";
const WORKSPACE_NAME = "Default Workspace";
const toJson = (value: unknown) => JSON.stringify(value);

export class PostgresStorage implements Storage {
  constructor(private readonly pool: Pool) {}

  async getWorkspace(): Promise<Workspace> {
    await this.ensureWorkspace();
    const result = await this.pool.query(
      "select id, name, graph, layers, drift, updated_at from workspace where id = $1",
      [WORKSPACE_ID]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      graph: row.graph,
      layers: row.layers,
      drift: row.drift,
      updatedAt: row.updated_at.toISOString()
    };
  }

  async updateWorkspace(input: WorkspaceUpdateInput): Promise<Workspace> {
    const current = await this.getWorkspace();
    const drift = input.drift ?? current.drift;
    await this.pool.query(
      "update workspace set graph = $2, layers = $3, drift = $4, updated_at = now() where id = $1",
      [WORKSPACE_ID, toJson(input.graph), toJson(input.layers), toJson(drift)]
    );
    return this.getWorkspace();
  }

  async listVersions(): Promise<PlanVersion[]> {
    const result = await this.pool.query(
      "select id, workspace_id, name, notes, graph, layers, created_at from plan_version where workspace_id = $1 order by created_at desc",
      [WORKSPACE_ID]
    );
    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      notes: row.notes ?? undefined,
      graph: row.graph,
      layers: row.layers,
      createdAt: row.created_at.toISOString()
    }));
  }

  async getVersion(id: string): Promise<PlanVersion | null> {
    const result = await this.pool.query(
      "select id, workspace_id, name, notes, graph, layers, created_at from plan_version where id = $1",
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      notes: row.notes ?? undefined,
      graph: row.graph,
      layers: row.layers,
      createdAt: row.created_at.toISOString()
    };
  }

  async getLatestVersion(): Promise<PlanVersion | null> {
    const result = await this.pool.query(
      "select id, workspace_id, name, notes, graph, layers, created_at from plan_version where workspace_id = $1 order by created_at desc limit 1",
      [WORKSPACE_ID]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      notes: row.notes ?? undefined,
      graph: row.graph,
      layers: row.layers,
      createdAt: row.created_at.toISOString()
    };
  }

  async createVersion(input: VersionCreateInput): Promise<PlanVersion> {
    const workspace = await this.getWorkspace();
    const id = uuidv4();
    const createdAt = new Date();
    await this.pool.query(
      "insert into plan_version (id, workspace_id, name, notes, graph, layers, created_at) values ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        workspace.id,
        input.name,
        input.notes ?? null,
        toJson(workspace.graph),
        toJson(workspace.layers),
        createdAt
      ]
    );
    return {
      id,
      workspaceId: workspace.id,
      name: input.name,
      notes: input.notes,
      graph: workspace.graph,
      layers: workspace.layers,
      createdAt: createdAt.toISOString()
    };
  }

  async updateDrift(input: DriftUpdateInput): Promise<Workspace> {
    const workspace = await this.getWorkspace();
    const drift = {
      ...workspace.drift,
      [input.nodeId]: {
        status: input.status,
        note: input.note,
        lastCheckedAt: new Date().toISOString()
      }
    };
    await this.pool.query(
      "update workspace set drift = $2, updated_at = now() where id = $1",
      [WORKSPACE_ID, toJson(drift)]
    );
    return this.getWorkspace();
  }

  private async ensureWorkspace(): Promise<void> {
    const result = await this.pool.query("select id from workspace where id = $1", [WORKSPACE_ID]);
    if (result.rows.length > 0) {
      return;
    }
    await this.pool.query(
      "insert into workspace (id, name, graph, layers, drift, updated_at) values ($1, $2, $3, $4, $5, now())",
      [
        WORKSPACE_ID,
        WORKSPACE_NAME,
        toJson(DEFAULT_GRAPH),
        toJson(DEFAULT_LAYERS),
        toJson(EMPTY_DRIFT)
      ]
    );
  }
}
