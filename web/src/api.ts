import type {
  DriftUpdateInput,
  Plan,
  PlanVersion,
  SessionUser,
  UserProfile,
  Workspace,
  WorkspaceUpdateInput,
} from "./domain";

const baseUrl = import.meta.env.VITE_API_URL ?? "";

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const hasBody = options?.body !== undefined;
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

export const api = {
  getSession: () => request<{ authenticated: boolean; user?: SessionUser }>("/api/session"),
  login: (username: string, password: string) =>
    request<{ user: SessionUser }>("/api/session", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/session", { method: "DELETE" }),
  getProfile: () => request<UserProfile>("/api/profile"),
  getWorkspace: () => request<Workspace>("/api/workspace"),
  updateWorkspace: (payload: WorkspaceUpdateInput) =>
    request<Workspace>("/api/workspace", { method: "PUT", body: JSON.stringify(payload) }),
  listVersions: () => request<{ versions: PlanVersion[] }>("/api/versions"),
  createVersion: (name: string, notes?: string) =>
    request<PlanVersion>("/api/versions", {
      method: "POST",
      body: JSON.stringify({ name, notes }),
    }),
  checkoutVersion: (id: string, commitDraft?: boolean) =>
    request<Workspace>(`/api/versions/${id}/checkout`, {
      method: "POST",
      ...(commitDraft !== undefined ? { body: JSON.stringify({ commitDraft }) } : {}),
    }),
  createPlan: (baseVersionId?: string) =>
    request<Plan>("/api/plan", {
      method: "POST",
      body: JSON.stringify({ baseVersionId }),
    }),
  updateDrift: (payload: DriftUpdateInput) =>
    request<Workspace>("/api/drift", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
