import Fastify from "fastify";
import cors from "@fastify/cors";
import secureSession from "@fastify/secure-session";
import crypto from "crypto";
import { config } from "./config.js";
import type { Storage } from "./storage/index.js";
import type { Pool } from "pg";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";

export const buildServer = (storage: Storage, db: Pool) => {
  const app = Fastify({
    logger: config.isProduction
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        },
  });

  app.decorate("storage", storage);
  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await db.end();
  });

  app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  const sessionKey = crypto.createHash("sha256").update(config.sessionSecret).digest();

  app.register(secureSession, {
    key: sessionKey,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
    },
  });

  app.register(registerAuthRoutes);
  app.register(registerProfileRoutes);
  app.register(registerWorkspaceRoutes);

  return app;
};
