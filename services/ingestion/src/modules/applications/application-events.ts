import type { ActorContext } from "../../domain/authorization/policies.js";
import type { AuditEventInput } from "../audit/audit-event.js";

interface ApplicationEventContext {
  readonly actor: ActorContext;
  readonly applicationId: string;
  readonly correlationId: string;
  readonly revisionNumber: number;
}

function base(
  context: ApplicationEventContext,
): Pick<
  AuditEventInput,
  "orgId" | "actorId" | "roles" | "applicationId" | "correlationId"
> {
  return {
    orgId: context.actor.orgId,
    actorId: context.actor.actorId,
    roles: context.actor.roles,
    applicationId: context.applicationId,
    correlationId: context.correlationId,
  };
}

export function applicationCreatedEvent(
  context: ApplicationEventContext,
): AuditEventInput {
  return {
    type: "APPLICATION_CREATED",
    ...base(context),
    outcome: "success",
    metadata: {
      revisionNumber: context.revisionNumber,
      fromStatus: null,
      toStatus: "borrador",
      state: "borrador",
    },
  };
}

export function applicationUpdatedEvent(
  context: ApplicationEventContext,
): AuditEventInput {
  return {
    type: "APPLICATION_UPDATED",
    ...base(context),
    outcome: "success",
    metadata: {
      revisionNumber: context.revisionNumber,
      fromStatus: "borrador",
      toStatus: "borrador",
      state: "borrador",
    },
  };
}

export function consentRecordedEvent(
  context: ApplicationEventContext,
  decision: "accepted" | "denied" | "revoked" | "absent",
): AuditEventInput {
  return {
    type: "CONSENT_RECORDED",
    ...base(context),
    outcome: decision === "accepted" ? "success" : "blocked",
    metadata: {
      revisionNumber: context.revisionNumber,
      state: decision,
    },
  };
}
