/* eslint-disable @typescript-eslint/no-deprecated */
import { z } from "zod";

export const configSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]),
  port: z.number().int().min(1024).max(65535),
  database: z.object({
    host: z.string().min(1),
    port: z.number().int(),
    name: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(8),
    sslMode: z.enum(["disable", "require", "verify-full"]),
    ca: z.string().min(1).optional(),
    serverName: z.string().min(1).optional(),
  }),
  scoring: z.object({
    baseUrl: z.string().url(),
    timeoutMs: z.number().int().min(100).max(1500),
    criteriaVersion: z.literal("SCORING-MVP-1.0.0"),
    token: z.string().min(32),
  }),
  auth: z.object({
    issuer: z.string().url(),
    audience: z.string().min(3),
    jwksUrl: z.string().url(),
    algorithms: z.array(z.enum(["RS256", "ES256"])).min(1),
  }),
  pii: z.object({
    encryptionKey: z.instanceof(Buffer).refine((value) => value.length === 32),
    hmacKey: z.instanceof(Buffer).refine((value) => value.length >= 32),
    keyVersion: z.number().int().positive(),
    encryptionKeys: z.record(z.string(), z.instanceof(Buffer)).optional(),
  }),
  corsAllowedOrigins: z.array(z.string().url()),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
});
export type AppConfig = z.infer<typeof configSchema>;
