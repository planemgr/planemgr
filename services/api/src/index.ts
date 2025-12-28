import { config } from "./config";
import { buildServer } from "./server";
import { createStorage } from "./storage";
import { ensureIacEnvironment } from "./services/iac";

const start = async () => {
  await ensureIacEnvironment(config.iacDir);
  const storage = createStorage({ iacDir: config.iacDir });
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
