import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const environment = process.env.NODE_ENV ?? "development";
const isProduction = environment === "production";

const username = process.env.APP_USERNAME ?? "admin";
const password = process.env.APP_PASSWORD ?? "admin";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-session-secret-change-me";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://planemgr:planemgr@localhost:5432/planemgr";
const port = Number(process.env.API_PORT ?? "4000");
const iacDir = process.env.IAC_DIR
  ? path.resolve(process.env.IAC_DIR)
  : path.resolve(process.cwd(), "iac");
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!process.env.APP_USERNAME || !process.env.APP_PASSWORD) {
  console.warn("APP_USERNAME/APP_PASSWORD are not set. Using defaults for development.");
}

if (!process.env.SESSION_SECRET && isProduction) {
  throw new Error("SESSION_SECRET must be set in production.");
}

export const config = {
  environment,
  isProduction,
  username,
  password,
  sessionSecret,
  databaseUrl,
  port,
  iacDir,
  corsOrigins
};
