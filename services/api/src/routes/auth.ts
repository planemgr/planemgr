import type { FastifyInstance } from "fastify";
import { loginInputSchema } from "@planemgr/domain";
import { config } from "../config";
import { parseBody } from "../utils/validation";
import crypto from "crypto";

const constantTimeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/api/session", async (request, reply) => {
    const payload = parseBody(loginInputSchema, request.body, reply);
    if (!payload) {
      return;
    }

    const usernameMatches = constantTimeEqual(payload.username, config.username);
    const passwordMatches = constantTimeEqual(payload.password, config.password);

    if (!usernameMatches || !passwordMatches) {
      reply.code(401).send({ error: "invalid_credentials" });
      return;
    }

    request.session.set("user", { username: payload.username });
    reply.send({ user: { username: payload.username } });
  });

  app.get("/api/session", async (request, reply) => {
    const user = request.session.get("user");
    if (!user) {
      reply.send({ authenticated: false });
      return;
    }
    reply.send({ authenticated: true, user });
  });

  app.delete("/api/session", async (request, reply) => {
    request.session.delete();
    reply.send({ ok: true });
  });
};
