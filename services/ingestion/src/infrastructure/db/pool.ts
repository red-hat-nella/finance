import pg from "pg";
import type { AppConfig } from "../../config/schema.js";
export function createPool(config: AppConfig): pg.Pool {
  return createDatabasePool(config.database);
}

export function createDatabasePool(config: AppConfig["database"]): pg.Pool {
  return new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
    max: 10,
    ssl:
      config.sslMode === "disable"
        ? false
        : { rejectUnauthorized: config.sslMode === "verify-full" },
  });
}
