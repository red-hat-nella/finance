import { randomBytes } from "node:crypto";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { documentBlindIndex } from "../../../src/infrastructure/crypto/blind-index.js";
import {
  canonicalHash,
  canonicalJson,
} from "../../../src/infrastructure/crypto/canonical-hash.js";
import {
  decryptField,
  encryptField,
} from "../../../src/infrastructure/crypto/field-crypto.js";
import { createLogger } from "../../../src/infrastructure/logging/logger.js";
import { sanitizeAuditMetadata } from "../../../src/modules/audit/audit-event.js";
describe("PII cryptography", () => {
  it("uses AES-GCM with a unique nonce and authenticates ciphertext", () => {
    const key = randomBytes(32),
      first = encryptField("1001032", key),
      second = encryptField("1001032", key);
    expect(first.nonce).not.toEqual(second.nonce);
    expect(decryptField(first, key)).toBe("1001032");
    expect(first.tag).toHaveLength(16);
  });
  it("creates stable scoped blind indexes", () => {
    const key = randomBytes(32);
    expect(documentBlindIndex("org", "CC", "1 001-032", key)).toEqual(
      documentBlindIndex("org", "CC", "1001032", key),
    );
    expect(documentBlindIndex("other", "CC", "1001032", key)).not.toEqual(
      documentBlindIndex("org", "CC", "1001032", key),
    );
  });
  it("hashes canonical JSON deterministically", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalHash({ b: 2, a: 1 })).toEqual(
      canonicalHash({ a: 1, b: 2 }),
    );
  });
});
describe("redaction and audit allowlist", () => {
  it("removes PII and arbitrary metadata", () => {
    expect(
      sanitizeAuditMetadata({
        state: "evaluada",
        documentNumber: "1001032",
        monthlyIncomeCop: "4000000",
        nested: { secret: true },
      }),
    ).toEqual({ state: "evaluada" });
  });
  it("redacts secrets and personal values from JSON logs", () => {
    let output = "";
    const stream = new Writable({
      write(
        chunk: Buffer | string,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void,
      ) {
        output += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        callback();
      },
    });
    const logger = createLogger({ logLevel: "info" }, stream);
    logger.info(
      {
        req: {
          headers: { authorization: "Bearer secret", cookie: "sid=secret" },
          body: { documentNumber: "1001032" },
        },
        monthlyIncomeCop: "4000000",
      },
      "canary",
    );
    expect(output).not.toContain("Bearer secret");
    expect(output).not.toContain("1001032");
    expect(output).not.toContain("4000000");
    expect(output).toContain("[REDACTED]");
  });
});
