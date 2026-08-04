import pg from "pg";
import type { AppConfig } from "../../config/schema.js";
export function createPool(config: AppConfig): pg.Pool {
  return new pg.Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: 10,
    ssl:
      config.database.sslMode === "disable"
        ? false
        : { rejectUnauthorized: config.database.sslMode === "verify-full" },
  });
}
