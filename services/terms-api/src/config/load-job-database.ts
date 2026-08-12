import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { DatabaseConfig } from './schema.js';

const schema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  name: z.string().min(1),
  user: z.literal('terms_migrator'),
  password: z.string().min(12),
  sslMode: z.enum(['disable', 'require', 'verify-full']),
  ca: z.string().min(1).optional(),
  serverName: z.string().min(1).optional(),
  poolMax: z.literal(1),
  statementTimeoutMs: z.number().int().min(100).max(120_000),
});

export function loadJobDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const passwordFile = environment.DATABASE_PASSWORD_FILE;
  return schema.parse({
    host: environment.DATABASE_HOST ?? 'localhost',
    port: Number(environment.DATABASE_PORT ?? 5432),
    name: environment.DATABASE_NAME ?? 'terms',
    user: environment.DATABASE_USER ?? 'terms_migrator',
    password: passwordFile
      ? readFileSync(passwordFile, 'utf8').trim()
      : (environment.DATABASE_PASSWORD ?? 'synthetic-local-migrator-password'),
    sslMode: environment.DATABASE_SSL_MODE ?? 'disable',
    ...(environment.DATABASE_CA_FILE
      ? { ca: readFileSync(environment.DATABASE_CA_FILE, 'utf8') }
      : {}),
    ...(environment.DATABASE_SERVER_NAME
      ? { serverName: environment.DATABASE_SERVER_NAME }
      : {}),
    poolMax: 1,
    statementTimeoutMs: Number(environment.DATABASE_STATEMENT_TIMEOUT_MS ?? 60_000),
  });
}
