import { readFileSync } from "node:fs";
import { z } from "zod";
import type { AppConfig } from "./schema.js";

const databaseSchema = z.object({
  host: z.string().min(1),
  port: z.number().int(),
  name: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(8),
  sslMode: z.enum(["disable", "require", "verify-full"]),
  ca: z.string().min(1).optional(),
  serverName: z.string().min(1).optional(),
});

export function loadJobDatabaseConfig(): AppConfig["database"] {
  const passwordFile = process.env["DATABASE_PASSWORD_FILE"];
  const password = passwordFile
    ? readFileSync(passwordFile, "utf8").trim()
    : (process.env["DATABASE_PASSWORD"] ?? "local-development-password");
  return databaseSchema.parse({
    host: process.env["DATABASE_HOST"] ?? "localhost",
    port: Number(process.env["DATABASE_PORT"] ?? 5432),
    name: process.env["DATABASE_NAME"] ?? "alternative_scoring",
    user: process.env["DATABASE_USER"] ?? "scoring_app",
    password,
    sslMode: process.env["DATABASE_SSL_MODE"] ?? "disable",
    ...(process.env["DATABASE_CA_FILE"]
      ? { ca: readFileSync(process.env["DATABASE_CA_FILE"], "utf8") }
      : {}),
    ...(process.env["DATABASE_SERVER_NAME"]
      ? { serverName: process.env["DATABASE_SERVER_NAME"] }
      : {}),
  });
}
