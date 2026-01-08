import { config } from "./config.js";
import { createPool } from "./db.js";
import { buildServer } from "./server.js";
import { createStorage } from "./storage/index.js";
import { ensureIacEnvironment } from "./services/iac.js";

const start = async () => {
  await ensureIacEnvironment(config.iacDir);
  const storage = createStorage({ iacDir: config.iacDir });
  const db = createPool(config.databaseUrl);
  const app = buildServer(storage, db);

  try {
    await app.listen({
      port: config.port,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
