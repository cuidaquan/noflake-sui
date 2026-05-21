import { loadConfig } from "./config";
import { createDatabase } from "./db";
import { createServer } from "./server";

const config = loadConfig();
const db = createDatabase(config.databasePath);
const app = createServer({ db });

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`NoFlake backend listening on ${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  db.close();
  process.exit(1);
}
