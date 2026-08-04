import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
describe("production configuration", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("fails fast without mounted secret files", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_SSL_MODE", "require");
    const { loadConfig } = await import("../../../src/config/load-config.js");
    expect(() => loadConfig()).toThrow(/secrets must be mounted/);
  });
  it("rejects a weak mounted service token", async () => {
    const directory = mkdtempSync(join(tmpdir(), "scoring-config-"));
    try {
      const files = {
        database: join(directory, "database"),
        encryption: join(directory, "encryption"),
        hmac: join(directory, "hmac"),
        scoring: join(directory, "scoring"),
      };
      writeFileSync(files.database, "database-password");
      writeFileSync(files.encryption, Buffer.alloc(32, 1));
      writeFileSync(files.hmac, Buffer.alloc(32, 2));
      writeFileSync(files.scoring, "weak");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DATABASE_SSL_MODE", "require");
      vi.stubEnv("DATABASE_PASSWORD_FILE", files.database);
      vi.stubEnv("PII_ENCRYPTION_KEY_FILE", files.encryption);
      vi.stubEnv("PII_HMAC_KEY_FILE", files.hmac);
      vi.stubEnv("SCORING_SERVICE_TOKEN_FILE", files.scoring);
      const { loadConfig } = await import("../../../src/config/load-config.js");
      expect(() => loadConfig()).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
