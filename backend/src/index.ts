import { loadConfig } from "./config";
import { createDatabase } from "./db";
import { createServer } from "./server";
import { createSuiClient } from "./sui-client";
import { startNoFlakeEventPoller } from "./worker/event-poller";

const config = loadConfig();
const db = createDatabase(config.databasePath);
const app = createServer({ db });
const poller = startNoFlakeEventPoller({
  client: createSuiClient(config),
  db,
  packageId: config.packageId,
  intervalMs: config.pollIntervalMs,
  log: app.log,
});

async function shutdown() {
  poller.stop();
  await app.close();
  db.close();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`NoFlake backend listening on ${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  poller.stop();
  db.close();
  process.exit(1);
}
