import type { FastifyInstance } from "fastify";
import {
  driftUpdateSchema,
  versionCreateSchema,
  workspaceUpdateSchema
} from "@planemgr/domain";
import { parseBody } from "../utils/validation";
import { createPlan } from "../services/plan";
import { requireAuth } from "../utils/auth";

export const registerWorkspaceRoutes = async (app: FastifyInstance) => {
  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/workspace", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const workspace = await app.storage.getWorkspace();
    reply.send(workspace);
  });

  app.put("/api/workspace", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const payload = parseBody(workspaceUpdateSchema, request.body, reply);
    if (!payload) {
      return;
    }
    const workspace = await app.storage.updateWorkspace(payload);
    reply.send(workspace);
  });

  app.get("/api/versions", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const versions = await app.storage.listVersions();
    reply.send({ versions });
  });

  app.get("/api/versions/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const { id } = request.params as { id: string };
    const version = await app.storage.getVersion(id);
    if (!version) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    reply.send(version);
  });

  app.post("/api/versions/:id/checkout", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const { id } = request.params as { id: string };
    try {
      const body = request.body as { commitDraft?: boolean } | undefined;
      const workspace = await app.storage.checkoutVersion(id, {
        commitDraft: body?.commitDraft
      });
      reply.send(workspace);
    } catch (error) {
      if (error instanceof Error && error.message === "version_not_found") {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      request.log.error(error);
      reply.code(500).send({ error: "checkout_failed" });
    }
  });

  app.post("/api/versions", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const payload = parseBody(versionCreateSchema, request.body, reply);
    if (!payload) {
      return;
    }
    const version = await app.storage.createVersion(payload);
    reply.send(version);
  });

  app.post("/api/plan", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const body = request.body as { baseVersionId?: string } | undefined;
    const workspace = await app.storage.getWorkspace();
    const baseVersion = body?.baseVersionId
      ? await app.storage.getVersion(body.baseVersionId)
      : await app.storage.getLatestVersion();

    const plan = createPlan(
      workspace.id,
      workspace.graph,
      baseVersion?.graph ?? null,
      baseVersion?.id
    );

    reply.send(plan);
  });

  app.patch("/api/drift", async (request, reply) => {
    if (!requireAuth(request, reply)) {
      return;
    }
    const payload = parseBody(driftUpdateSchema, request.body, reply);
    if (!payload) {
      return;
    }
    const workspace = await app.storage.updateDrift(payload);
    reply.send(workspace);
  });
};
