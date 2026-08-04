import { loadConfig } from "./config/load-config.js";
import { createPool } from "./infrastructure/db/pool.js";
import { createApp } from "./app.js";
const config = loadConfig(),
  pool = createPool(config),
  app = createApp(config, pool);
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "server.started",
      port: config.port,
    }),
  );
});
async function shutdown() {
  server.close();
  await pool.end();
}
process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
