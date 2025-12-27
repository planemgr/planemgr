import { config } from "./config";
import { buildServer } from "./server";
import { createStorage } from "./storage";

const start = async () => {
  const storage = createStorage(config.databaseUrl);
  const app = buildServer(storage);

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
