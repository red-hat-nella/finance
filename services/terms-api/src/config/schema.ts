import { z } from 'zod';

const databaseSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  name: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(12),
  sslMode: z.enum(['disable', 'require', 'verify-full']),
  ca: z.string().min(1).optional(),
  serverName: z.string().min(1).optional(),
  poolMax: z.number().int().min(1).max(50),
  statementTimeoutMs: z.number().int().min(100).max(30_000),
});

export const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  port: z.number().int().min(1024).max(65_535),
  database: databaseSchema,
  auth: z.object({
    issuer: z.url(),
    audience: z.string().min(3),
    jwksUrl: z.url(),
    algorithms: z.array(z.enum(['RS256', 'ES256'])).min(1),
  }),
  serviceAuth: z.object({
    token: z.string().min(32),
  }),
  privacy: z.object({
    acceptanceHmacKey: z.string().min(32),
  }),
  http: z.object({
    jsonLimit: z.string().regex(/^\d+(?:kb|mb)$/i),
    publicRateLimit: z.number().int().min(1).max(10_000),
  }),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

export type AppConfig = z.infer<typeof configSchema>;
export type DatabaseConfig = z.infer<typeof databaseSchema>;
