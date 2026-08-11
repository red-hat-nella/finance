import { describe, expect, it } from "vitest";
import { MIGRATION_LOCK_NAME, migrationChecksum } from "../config/database.js";

describe("release migration primitives", () => {
  it("uses a stable global advisory lock identity", () => {
    expect(MIGRATION_LOCK_NAME).toBe("finance2-schema-migrations-v1");
  });

  it("computes deterministic, content-sensitive checksums", () => {
    expect(migrationChecksum("select 1;")).toBe(migrationChecksum("select 1;"));
    expect(migrationChecksum("select 1;")).not.toBe(migrationChecksum("select 2;"));
    expect(migrationChecksum("select 1;")).toMatch(/^[0-9a-f]{64}$/);
  });
});
