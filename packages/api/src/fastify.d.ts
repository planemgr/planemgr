import "fastify";
import "@fastify/secure-session";
import type { Pool } from "pg";
import type { Storage } from "./storage/storage.ts";

declare module "@fastify/secure-session" {
  interface SessionData {
    user: {
      username: string;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    storage: Storage;
    db: Pool;
  }
}
