import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encryptionKeyForVersion,
  loadVersionedPiiKeys,
} from "../../../src/config/pii-keyring.js";

describe("versioned PII keyring", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("loads the active and historical keys from exact versioned files", () => {
    const directory = mkdtempSync(join(tmpdir(), "pii-keyring-"));
    try {
      writeFileSync(join(directory, "encryption-key-v1"), Buffer.alloc(32, 1));
      writeFileSync(join(directory, "encryption-key-v2"), Buffer.alloc(32, 2));
      vi.stubEnv("PII_KEYRING_DIR", directory);
      vi.stubEnv("PII_KEY_VERSIONS", "1,2");
      const keys = loadVersionedPiiKeys(2, Buffer.alloc(32, 2));
      expect(keys["1"]).toEqual(Buffer.alloc(32, 1));
      expect(encryptionKeyForVersion({
        encryptionKey: Buffer.alloc(32, 2),
        hmacKey: Buffer.alloc(32, 3),
        keyVersion: 2,
        encryptionKeys: keys,
      }, 1)).toEqual(Buffer.alloc(32, 1));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("blocks startup when the active version is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "pii-keyring-"));
    try {
      writeFileSync(join(directory, "encryption-key-v1"), Buffer.alloc(32, 1));
      vi.stubEnv("PII_KEYRING_DIR", directory);
      vi.stubEnv("PII_KEY_VERSIONS", "1");
      expect(() => loadVersionedPiiKeys(2, Buffer.alloc(32, 2))).toThrow(
        /active PII key version is absent/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses to decrypt a version that was not retained", () => {
    expect(() => encryptionKeyForVersion({
      encryptionKey: Buffer.alloc(32, 2),
      hmacKey: Buffer.alloc(32, 3),
      keyVersion: 2,
      encryptionKeys: { "2": Buffer.alloc(32, 2) },
    }, 1)).toThrow(/version 1 is unavailable/);
  });
});
