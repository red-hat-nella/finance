import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./schema.js";

export function loadVersionedPiiKeys(
  activeVersion: number,
  activeKey: Buffer,
): Record<string, Buffer> {
  const directory = process.env["PII_KEYRING_DIR"];
  if (!directory) return { [String(activeVersion)]: activeKey };
  const versions = (process.env["PII_KEY_VERSIONS"] ?? String(activeVersion))
    .split(",")
    .map((value) => Number(value.trim()));
  const result: Record<string, Buffer> = {};
  for (const version of versions) {
    if (!Number.isInteger(version) || version <= 0)
      throw new Error("PII_KEY_VERSIONS must contain positive integers");
    const versionText = String(version);
    const key = readFileSync(join(directory, `encryption-key-v${versionText}`));
    if (key.length !== 32)
      throw new Error(`PII encryption key v${versionText} must contain 32 bytes`);
    result[versionText] = key;
  }
  if (!result[String(activeVersion)])
    throw new Error("active PII key version is absent from the keyring");
  return result;
}

export function encryptionKeyForVersion(
  pii: AppConfig["pii"],
  version: number,
): Buffer {
  const key =
    pii.encryptionKeys?.[String(version)] ??
    (version === pii.keyVersion ? pii.encryptionKey : undefined);
  if (!key) throw new Error(`PII key version ${String(version)} is unavailable`);
  return key;
}
