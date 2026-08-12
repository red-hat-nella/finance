import { readFileSync } from 'node:fs';
import { configSchema, type AppConfig } from './schema.js';

function secret(
  environment: NodeJS.ProcessEnv,
  fileVariable: string,
  inlineVariable: string,
  fallback: string,
): string {
  const filename = environment[fileVariable];
  if (filename) return readFileSync(filename, 'utf8').trim();
  return environment[inlineVariable] ?? fallback;
}

function csv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  const issuer = environment.AUTH_ISSUER ?? 'http://localhost:8090';
  const config = configSchema.parse({
    nodeEnv,
    port: Number(environment.PORT ?? environment.TERMS_API_PORT ?? 8080),
    database: {
      host: environment.DATABASE_HOST ?? 'localhost',
      port: Number(environment.DATABASE_PORT ?? 5432),
      name: environment.DATABASE_NAME ?? 'terms',
      user: environment.DATABASE_USER ?? 'terms_app',
      password: secret(
        environment,
        'DATABASE_PASSWORD_FILE',
        'DATABASE_PASSWORD',
        'synthetic-local-terms-password',
      ),
      sslMode: environment.DATABASE_SSL_MODE ?? 'disable',
      ...(environment.DATABASE_CA_FILE
        ? { ca: readFileSync(environment.DATABASE_CA_FILE, 'utf8') }
        : {}),
      ...(environment.DATABASE_SERVER_NAME
        ? { serverName: environment.DATABASE_SERVER_NAME }
        : {}),
      poolMax: Number(environment.DATABASE_POOL_MAX ?? 10),
      statementTimeoutMs: Number(environment.DATABASE_STATEMENT_TIMEOUT_MS ?? 3000),
    },
    auth: {
      issuer,
      audience: environment.AUTH_AUDIENCE ?? 'finance2-terms',
      jwksUrl: environment.AUTH_JWKS_URL ?? `${issuer}/.well-known/jwks.json`,
      algorithms: csv(environment.AUTH_ALLOWED_ALGORITHMS ?? 'RS256'),
    },
    serviceAuth: {
      token: secret(
        environment,
        'TERMS_SERVICE_TOKEN_FILE',
        'TERMS_SERVICE_TOKEN',
        'synthetic-local-service-token-000000000000',
      ),
    },
    privacy: {
      acceptanceHmacKey: secret(
        environment,
        'TERMS_ACCEPTANCE_HMAC_KEY_FILE',
        'TERMS_ACCEPTANCE_HMAC_KEY',
        'synthetic-local-acceptance-hmac-key-000000',
      ),
    },
    http: {
      jsonLimit: environment.HTTP_JSON_LIMIT ?? '512kb',
      publicRateLimit: Number(environment.HTTP_PUBLIC_RATE_LIMIT ?? 120),
    },
    logLevel: environment.LOG_LEVEL ?? 'info',
  });

  if (nodeEnv === 'production') {
    if (config.database.sslMode === 'disable') {
      throw new Error('DATABASE_SSL_MODE must protect production traffic');
    }
    if (
      config.database.sslMode === 'verify-full' &&
      (!config.database.ca || !config.database.serverName)
    ) {
      throw new Error('verify-full requires DATABASE_CA_FILE and DATABASE_SERVER_NAME');
    }
    if (
      !environment.DATABASE_PASSWORD_FILE ||
      !environment.TERMS_SERVICE_TOKEN_FILE ||
      !environment.TERMS_ACCEPTANCE_HMAC_KEY_FILE
    ) {
      throw new Error('production secrets must be mounted as separate files');
    }
    if (config.database.user !== 'terms_app') {
      throw new Error('runtime database identity must be terms_app');
    }
  }

  return config;
}
