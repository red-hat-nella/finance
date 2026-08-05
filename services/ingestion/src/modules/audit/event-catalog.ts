export const AUDIT_EVENT_CATALOG = {
  APPLICATION_CREATED: "Application draft was created",
  APPLICATION_UPDATED: "Application revision was created or draft fields changed",
  DRAFT_RETENTION_DELETED: "Expired draft and its identifying data were deleted",
  CONSENT_RECORDED: "Consent was accepted, denied, revoked, or blocked evaluation",
  CRITERIA_VERSION_ACTIVATED: "A criteria version became available for new evaluations",
  EVALUATION_STARTED: "Input snapshot was locked and criteria version selected",
  EVALUATION_COMPLETED: "Deterministic evaluation reached a terminal result",
  EVALUATION_FAILED: "Evaluation reached a safe operational error",
  EVALUATION_RETRIED: "A new attempt was linked to a failed evaluation",
  EVALUATION_VIEWED: "Authorized evaluation detail was read",
  HISTORY_SEARCHED: "Authorized history search was executed",
  AUDIT_VIEWED: "Audit timeline access succeeded or was denied",
  RETENTION_COMPLETED: "Retention run deleted or anonymized eligible records",
} as const;

export type AuditEventType = keyof typeof AUDIT_EVENT_CATALOG;

export const SAFE_AUDIT_METADATA_FIELDS = Object.freeze([
  "revisionNumber",
  "attemptNumber",
  "state",
  "riskBand",
  "criteriaVersion",
  "errorCode",
  "filterTypes",
  "resultCount",
  "retentionRunId",
  "retentionAction",
  "affectedCount",
  "draftDeleted",
  "evaluationsAnonymized",
  "consentsDeleted",
  "auditEventsAnonymized",
  "fromStatus",
  "toStatus",
  "retryOfEvaluationId",
] as const);

export const AUDIT_COVERAGE = Object.freeze({
  creation: "APPLICATION_CREATED",
  revision: "APPLICATION_UPDATED",
  consentAndBlocking: "CONSENT_RECORDED",
  inputLockAndCriteria: "EVALUATION_STARTED",
  criteriaActivation: "CRITERIA_VERSION_ACTIVATED",
  evaluation: ["EVALUATION_COMPLETED", "EVALUATION_FAILED"],
  retry: "EVALUATION_RETRIED",
  search: "HISTORY_SEARCHED",
  detail: "EVALUATION_VIEWED",
  retention: "RETENTION_COMPLETED",
} as const);
