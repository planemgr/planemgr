import type { FastifyReply, FastifyRequest } from "fastify";

export const requireAuth = (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.session.get("user");
  if (!user) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return user;
};
