import { createHmac } from "node:crypto";
export function documentBlindIndex(
  orgId: string,
  type: string,
  number: string,
  key: Buffer,
): Buffer {
  return createHmac("sha256", key)
    .update(
      `${orgId}|${type}|${number.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`,
    )
    .digest();
}
