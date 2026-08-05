import { randomUUID } from "node:crypto";
import type { ActorContext } from "../../domain/authorization/policies.js";
import type { AuditWriter } from "./audit-writer.js";
import type { AuditRepository, SafeAuditEvent } from "./audit.repository.js";

export class AuditNotFoundError extends Error {
  constructor() {
    super("No se encontró una evaluación accesible.");
    this.name = "AuditNotFoundError";
  }
}

export interface AuditTimeline {
  readonly evaluationId: string;
  readonly events: readonly SafeAuditEvent[];
}

export class GetEvaluationAuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly writer: AuditWriter,
  ) {}

  async execute(
    evaluationPublicId: string,
    actor: ActorContext,
    correlationId: string,
  ): Promise<AuditTimeline> {
    const evaluationId = await this.repository.findEvaluationInScope(
      evaluationPublicId,
      actor,
    );
    if (!evaluationId) {
      await this.recordDenied(actor, correlationId);
      throw new AuditNotFoundError();
    }
    await this.writer.write({
      type: "AUDIT_VIEWED",
      orgId: actor.orgId,
      actorId: actor.actorId,
      roles: actor.roles,
      evaluationId,
      correlationId,
      outcome: "success",
      metadata: {},
    });
    return {
      evaluationId: evaluationPublicId,
      events: await this.repository.listEvents(evaluationId),
    };
  }

  async recordDenied(
    actor: ActorContext,
    correlationId: string = randomUUID(),
  ): Promise<void> {
    await this.writer.write({
      type: "AUDIT_VIEWED",
      orgId: actor.orgId,
      actorId: actor.actorId,
      roles: actor.roles,
      correlationId,
      outcome: "denied",
      metadata: {},
    });
  }
}
