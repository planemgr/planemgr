import Fastify from "fastify";
import cors from "@fastify/cors";
import secureSession from "@fastify/secure-session";
import crypto from "crypto";
import { config } from "./config";
import type { Storage } from "./storage";
import { registerAuthRoutes } from "./routes/auth";
import { registerWorkspaceRoutes } from "./routes/workspace";

export const buildServer = (storage: Storage) => {
  const app = Fastify({
    logger: config.isProduction
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "SYS:standard",
              ignore: "pid,hostname"
            }
          }
        }
  });

  app.decorate("storage", storage);

  app.register(cors, {
    origin: config.corsOrigins,
    credentials: true
  });

  const sessionKey = crypto.createHash("sha256").update(config.sessionSecret).digest();

  app.register(secureSession, {
    key: sessionKey,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction
    }
  });

  app.register(registerAuthRoutes);
  app.register(registerWorkspaceRoutes);

  return app;
};
