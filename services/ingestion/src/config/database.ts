import { createHash } from "node:crypto";

export const MIGRATION_LOCK_NAME = "finance2-schema-migrations-v1";

export function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}
