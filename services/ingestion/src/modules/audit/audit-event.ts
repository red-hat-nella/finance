export const AUDIT_EVENT_TYPES = [
  "APPLICATION_CREATED",
  "APPLICATION_UPDATED",
  "CONSENT_RECORDED",
  "EVALUATION_STARTED",
  "EVALUATION_COMPLETED",
  "EVALUATION_FAILED",
  "EVALUATION_RETRIED",
  "EVALUATION_VIEWED",
  "HISTORY_SEARCHED",
  "AUDIT_VIEWED",
  "RETENTION_COMPLETED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export type AuditOutcome = "success" | "blocked" | "denied" | "error";
const SAFE_METADATA = new Set([
  "revisionNumber",
  "attemptNumber",
  "state",
  "riskBand",
  "criteriaVersion",
  "errorCode",
  "filterTypes",
  "resultCount",
  "retentionRunId",
  "fromStatus",
  "toStatus",
]);
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
  orgId: string;
  actorId: string;
  roles: readonly string[];
  applicationId?: string;
  evaluationId?: string;
  correlationId: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
}
