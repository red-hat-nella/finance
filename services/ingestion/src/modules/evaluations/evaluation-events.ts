import type { ActorContext } from "../../domain/authorization/policies.js";
import type { AuditEventInput } from "../audit/audit-event.js";

interface EvaluationEventContext {
  readonly actor: ActorContext;
  readonly applicationId: string;
  readonly evaluationId: string;
  readonly correlationId: string;
  readonly revisionNumber: number;
  readonly attemptNumber: number;
  readonly criteriaVersion: string;
}

function base(
  context: EvaluationEventContext,
): Pick<
  AuditEventInput,
  | "orgId"
  | "actorId"
  | "roles"
  | "applicationId"
  | "evaluationId"
  | "correlationId"
> {
  return {
    orgId: context.actor.orgId,
    actorId: context.actor.actorId,
    roles: context.actor.roles,
    applicationId: context.applicationId,
    evaluationId: context.evaluationId,
    correlationId: context.correlationId,
  };
}

export function evaluationStartedEvent(
  context: EvaluationEventContext,
): AuditEventInput {
  return {
    type: "EVALUATION_STARTED",
    ...base(context),
    outcome: "success",
    metadata: {
      revisionNumber: context.revisionNumber,
      attemptNumber: context.attemptNumber,
      fromStatus: "borrador",
      toStatus: "evaluando",
      state: "evaluando",
      criteriaVersion: context.criteriaVersion,
    },
  };
}

export function evaluationRetriedEvent(
  context: EvaluationEventContext,
  retryOfEvaluationId: string,
): AuditEventInput {
  return {
    type: "EVALUATION_RETRIED",
    ...base(context),
    outcome: "success",
    metadata: {
      revisionNumber: context.revisionNumber,
      attemptNumber: context.attemptNumber,
      retryOfEvaluationId,
      fromStatus: "error",
      toStatus: "evaluando",
      state: "evaluando",
      criteriaVersion: context.criteriaVersion,
    },
  };
}

export function evaluationCompletedEvent(
  context: EvaluationEventContext,
  result: {
    readonly state: "evaluada" | "revision_manual";
    readonly riskBand: "riesgo_bajo" | "riesgo_medio" | "riesgo_alto" | null;
  },
): AuditEventInput {
  return {
    type: "EVALUATION_COMPLETED",
    ...base(context),
    outcome: "success",
    metadata: {
      revisionNumber: context.revisionNumber,
      attemptNumber: context.attemptNumber,
      fromStatus: "evaluando",
      toStatus: result.state,
      state: result.state,
      riskBand: result.riskBand,
      criteriaVersion: context.criteriaVersion,
    },
  };
}
