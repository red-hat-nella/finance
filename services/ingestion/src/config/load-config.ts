import { readFileSync } from "node:fs";
import { configSchema, type AppConfig } from "./schema.js";
import { loadVersionedPiiKeys } from "./pii-keyring.js";

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
  const keyVersion = Number(process.env.PII_KEY_VERSION ?? 1);
  const encryptionKey = secretBuffer(
    "PII_ENCRYPTION_KEY_FILE",
    "PII_ENCRYPTION_KEY",
    "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=",
  );
  const hmacKey = secretBuffer(
    "PII_HMAC_KEY_FILE",
    "PII_HMAC_KEY",
    "MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMQ==",
  );
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
      ...(process.env.DATABASE_CA_FILE
        ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
        : {}),
      ...(process.env.DATABASE_SERVER_NAME
        ? { serverName: process.env.DATABASE_SERVER_NAME }
        : {}),
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
    termsAccess: {
      baseUrl: process.env.TERMS_ACCESS_BASE_URL ?? "http://localhost:8082",
      timeoutMs: Number(process.env.TERMS_ACCESS_TIMEOUT_MS ?? 500),
      token: secret(
        "TERMS_SERVICE_TOKEN_FILE",
        "TERMS_SERVICE_TOKEN",
        "development-terms-service-token-32-bytes-minimum",
      ),
    },
    termsGateTestBypass: process.env.TERMS_GATE_TEST_BYPASS === "true",
    auth: {
      issuer: process.env.AUTH_ISSUER ?? "http://localhost:8090",
      audience: process.env.AUTH_AUDIENCE ?? "alternative-credit-scoring",
      jwksUrl:
        process.env.AUTH_JWKS_URL ??
        `${process.env.AUTH_ISSUER ?? "http://localhost:8090"}/.well-known/jwks.json`,
      algorithms: (process.env.AUTH_ALLOWED_ALGORITHMS ?? "RS256").split(","),
    },
    pii: {
      encryptionKey,
      hmacKey,
      keyVersion,
      encryptionKeys: loadVersionedPiiKeys(keyVersion, encryptionKey),
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
      config.database.sslMode === "verify-full" &&
      (!config.database.ca || !config.database.serverName)
    )
      throw new Error("verify-full requires DATABASE_CA_FILE and DATABASE_SERVER_NAME");
    if (
      !process.env.DATABASE_PASSWORD_FILE ||
      !process.env.PII_ENCRYPTION_KEY_FILE ||
      !process.env.PII_HMAC_KEY_FILE ||
      !process.env.SCORING_SERVICE_TOKEN_FILE ||
      !process.env.TERMS_SERVICE_TOKEN_FILE
    )
      throw new Error("production secrets must be mounted as files");
  }
  return config;
}
