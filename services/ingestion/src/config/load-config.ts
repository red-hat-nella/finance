import { readFileSync } from "node:fs";
import { configSchema, type AppConfig } from "./schema.js";

function secret(
  fileVariable: string,
  inlineVariable: string,
  fallback: string,
): string {
  const file = process.env[fileVariable];
  if (file) return readFileSync(file, "utf8").trim();
  const inline = process.env[inlineVariable];
  if (inline) return inline;
  return fallback;
}

function secretBuffer(
  fileVariable: string,
  inlineVariable: string,
  fallback: string,
): Buffer {
  const file = process.env[fileVariable];
  if (file) return readFileSync(file);
  return Buffer.from(process.env[inlineVariable] ?? fallback, "base64");
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const config = configSchema.parse({
    nodeEnv,
    port: Number(process.env.PORT ?? process.env.INGESTION_PORT ?? 8080),
    database: {
      host: process.env.DATABASE_HOST ?? "localhost",
      port: Number(process.env.DATABASE_PORT ?? 5432),
      name: process.env.DATABASE_NAME ?? "alternative_scoring",
      user: process.env.DATABASE_USER ?? "postgres",
      password: secret(
        "DATABASE_PASSWORD_FILE",
        "DATABASE_PASSWORD",
        "local-development-password",
      ),
      sslMode: process.env.DATABASE_SSL_MODE ?? "disable",
    },
    scoring: {
      baseUrl: process.env.SCORING_BASE_URL ?? "http://localhost:8081",
      timeoutMs: Number(process.env.SCORING_TIMEOUT_MS ?? 750),
      criteriaVersion:
        process.env.SCORING_CRITERIA_VERSION ?? "SCORING-MVP-1.0.0",
      token: secret(
        "SCORING_SERVICE_TOKEN_FILE",
        "SCORING_SERVICE_TOKEN",
        "development-scoring-token-32-bytes-minimum",
      ),
    },
    auth: {
      issuer: process.env.AUTH_ISSUER ?? "http://localhost:8090",
      audience: process.env.AUTH_AUDIENCE ?? "alternative-credit-scoring",
      jwksUrl:
        process.env.AUTH_JWKS_URL ??
        `${process.env.AUTH_ISSUER ?? "http://localhost:8090"}/.well-known/jwks.json`,
      algorithms: (process.env.AUTH_ALLOWED_ALGORITHMS ?? "RS256").split(","),
    },
    pii: {
      encryptionKey: secretBuffer(
        "PII_ENCRYPTION_KEY_FILE",
        "PII_ENCRYPTION_KEY",
        "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=",
      ),
      hmacKey: secretBuffer(
        "PII_HMAC_KEY_FILE",
        "PII_HMAC_KEY",
        "MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMQ==",
      ),
      keyVersion: Number(process.env.PII_KEY_VERSION ?? 1),
    },
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? "info",
  });
  if (nodeEnv === "production") {
    if (config.database.sslMode === "disable")
      throw new Error("DATABASE_SSL_MODE must protect production traffic");
    if (
      !process.env.DATABASE_PASSWORD_FILE ||
      !process.env.PII_ENCRYPTION_KEY_FILE ||
      !process.env.PII_HMAC_KEY_FILE ||
      !process.env.SCORING_SERVICE_TOKEN_FILE
    )
      throw new Error("production secrets must be mounted as files");
  }
  return config;
}
