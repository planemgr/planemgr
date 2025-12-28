import "fastify";
import "@fastify/secure-session";
import type { Pool } from "pg";
import type { Storage } from "./storage/storage";

declare module "fastify" {
  interface FastifyInstance {
    storage: Storage;
    db: Pool;
  }
}
