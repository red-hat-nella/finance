import {
  AUDIT_EVENT_CATALOG,
  SAFE_AUDIT_METADATA_FIELDS,
  type AuditEventType,
} from "./event-catalog.js";

export const AUDIT_EVENT_TYPES = Object.freeze(
  Object.keys(AUDIT_EVENT_CATALOG) as AuditEventType[],
);
export type { AuditEventType } from "./event-catalog.js";
export type AuditOutcome = "success" | "blocked" | "denied" | "error";
const SAFE_METADATA = new Set<string>(SAFE_AUDIT_METADATA_FIELDS);
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key, value]) =>
        SAFE_METADATA.has(key) &&
        (["string", "number", "boolean"].includes(typeof value) ||
          value === null),
    ),
  );
}
export interface AuditEventInput {
  type: AuditEventType;
  orgId?: string;
  actorId?: string;
  roles: readonly string[];
  applicationId?: string;
  evaluationId?: string;
  correlationId: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
}
