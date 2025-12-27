import "fastify";
import "@fastify/secure-session";
import type { Storage } from "./storage/storage";

declare module "fastify" {
  interface FastifyInstance {
    storage: Storage;
  }
}
