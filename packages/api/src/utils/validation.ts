import type { FastifyReply } from "fastify";
import type { ZodSchema } from "zod";

export const parseBody = <T>(schema: ZodSchema<T>, body: unknown, reply: FastifyReply) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    reply.code(400).send({
      error: "invalid_payload",
      details: result.error.flatten(),
    });
    return null;
  }
  return result.data;
};
