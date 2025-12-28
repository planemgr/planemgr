import { config } from "./config";
import { createPool } from "./db";
import { buildServer } from "./server";
import { createStorage } from "./storage";
import { ensureIacEnvironment } from "./services/iac";

const start = async () => {
  await ensureIacEnvironment(config.iacDir);
  const storage = createStorage({ iacDir: config.iacDir });
  const db = createPool(config.databaseUrl);
  const app = buildServer(storage, db);

  try {
    await app.listen({
      port: config.port,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
