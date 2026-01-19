import type { FastifyInstance } from "fastify";
import { ensureUserSshKeyPair } from "../services/ssh.js";
import { requireAuth } from "../utils/auth.js";

export const registerProfileRoutes = async (app: FastifyInstance) => {
  app.get("/api/profile", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) {
      return;
    }
    try {
      const keys = await ensureUserSshKeyPair(app.db, user.username);
      reply.send({ username: user.username, sshPublicKey: keys.publicKey });
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: "profile_unavailable" });
    }
  });
};
