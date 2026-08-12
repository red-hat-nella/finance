import { createApp } from './app.js';
import { loadConfig } from './config/load-config.js';
import { createPool } from './infrastructure/db/pool.js';

const config = loadConfig();
const pool = createPool(config);
const app = createApp(config, pool);
const server = app.listen(config.port, '0.0.0.0');

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
}

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
