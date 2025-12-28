import type {
  DriftUpdateInput,
  PlanVersion,
  Workspace,
  WorkspaceUpdateInput,
  VersionCreateInput
} from "@planemgr/domain";

export interface Storage {
  getWorkspace(): Promise<Workspace>;
  updateWorkspace(input: WorkspaceUpdateInput): Promise<Workspace>;
  listVersions(): Promise<PlanVersion[]>;
  getVersion(id: string): Promise<PlanVersion | null>;
  getLatestVersion(): Promise<PlanVersion | null>;
  createVersion(input: VersionCreateInput): Promise<PlanVersion>;
  checkoutVersion(id: string, options?: { commitDraft?: boolean }): Promise<Workspace>;
  updateDrift(input: DriftUpdateInput): Promise<Workspace>;
}
