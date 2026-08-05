import type pg from "pg";
import type { ActorContext } from "../../domain/authorization/policies.js";
import { sanitizeAuditMetadata } from "./audit-event.js";

interface EvaluationScopeRow extends pg.QueryResultRow {
  id: string;
}

interface AuditRow extends pg.QueryResultRow {
  event_id: string;
  event_type: string;
  outcome: "success" | "blocked" | "denied" | "error";
  actor_id: string | null;
  actor_roles: string[];
  occurred_at: Date;
  metadata: Record<string, unknown>;
}

export interface SafeAuditEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly outcome: AuditRow["outcome"];
  readonly actorDisplay: string;
  readonly actorRole: "credit_analyst" | "supervisor" | "auditor" | "system";
  readonly occurredAt: string;
  readonly safeMetadata: Record<string, string | number | boolean | null>;
}

export class AuditRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findEvaluationInScope(
    evaluationPublicId: string,
    actor: ActorContext,
  ): Promise<string | null> {
    const result = await this.pool.query<EvaluationScopeRow>(
      `SELECT id FROM scoring.evaluations
        WHERE public_id=$1::uuid AND org_scope_id=$2 AND anonymized_at IS NULL`,
      [evaluationPublicId, actor.orgId],
    );
    return result.rows[0]?.id ?? null;
  }

  async listEvents(evaluationId: string): Promise<readonly SafeAuditEvent[]> {
    const result = await this.pool.query<AuditRow>(
      `SELECT event_id,event_type,outcome,actor_id,actor_roles,occurred_at,metadata
         FROM scoring.audit_events
        WHERE evaluation_id=$1
        ORDER BY occurred_at,id`,
      [evaluationId],
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      outcome: row.outcome,
      actorDisplay: actorDisplay(row.actor_id, row.actor_roles),
      actorRole: actorRole(row.actor_roles),
      occurredAt: row.occurred_at.toISOString(),
      safeMetadata: sanitizeAuditMetadata(row.metadata) as Record<
        string,
        string | number | boolean | null
      >,
    }));
  }
}

function actorRole(
  roles: readonly string[],
): SafeAuditEvent["actorRole"] {
  if (roles.includes("credit_analyst")) return "credit_analyst";
  if (roles.includes("supervisor")) return "supervisor";
  if (roles.includes("auditor")) return "auditor";
  return "system";
}

function actorDisplay(actorId: string | null, roles: readonly string[]): string {
  const role = actorRole(roles);
  const label =
    role === "credit_analyst"
      ? "Analista"
      : role === "supervisor"
        ? "Supervisor"
        : role === "auditor"
          ? "Auditor"
          : "Sistema";
  if (!actorId || role === "system") return label;
  return `${label} •${actorId.slice(-3).padStart(3, "0")}`;
}
