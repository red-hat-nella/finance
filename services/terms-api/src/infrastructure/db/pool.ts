import pg from 'pg';
import type { AppConfig, DatabaseConfig } from '../../config/schema.js';

export function createPool(config: Pick<AppConfig, 'database'>): pg.Pool {
  return createDatabasePool(config.database);
}

export function createDatabasePool(config: DatabaseConfig): pg.Pool {
  return new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
    max: config.poolMax,
    application_name: 'finance2-terms-api',
    statement_timeout: config.statementTimeoutMs,
    options: '-c search_path=terms,public',
    ssl:
      config.sslMode === 'disable'
        ? false
        : {
            rejectUnauthorized: config.sslMode === 'verify-full',
            ...(config.ca ? { ca: config.ca } : {}),
            ...(config.serverName ? { servername: config.serverName } : {}),
          },
  });
}
