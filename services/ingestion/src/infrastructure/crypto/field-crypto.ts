import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface CipherField {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
}
export function encryptField(value: string, key: Buffer): CipherField {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, nonce, tag: cipher.getAuthTag() };
}
export function decryptField(value: CipherField, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, value.nonce);
  decipher.setAuthTag(value.tag);
  return Buffer.concat([
    decipher.update(value.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
