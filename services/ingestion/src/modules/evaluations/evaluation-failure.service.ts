import type pg from "pg";
import { inTransaction } from "../../infrastructure/db/transaction.js";

export interface EvaluationFailureCommand {
  readonly evaluationId: string;
  readonly revisionId: string;
  readonly applicationId: string;
  readonly errorCode: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly actorRoles: readonly string[];
  readonly orgId: string;
}

export async function finalizeEvaluationFailure(
  pool: pg.Pool,
  command: EvaluationFailureCommand,
): Promise<void> {
  await inTransaction(pool, async (database) => {
    const evaluation = await database.query(
      `UPDATE scoring.evaluations SET status='error',score=NULL,risk_band=NULL,recommendation_code=NULL,recommendation_text=NULL,error_code=$2,completed_at=now(),retention_until=now()+interval '5 years' WHERE id=$1 AND status='evaluando' RETURNING id`,
      [command.evaluationId, command.errorCode],
    );
    if (evaluation.rowCount === 0) return;

    await database.query(
      `UPDATE scoring.application_revisions SET status='error' WHERE id=$1 AND status='evaluando'`,
      [command.revisionId],
    );
    await database.query(
      `UPDATE scoring.applications SET current_status='error' WHERE id=$1 AND current_revision_id=$2 AND current_status='evaluando'`,
      [command.applicationId, command.revisionId],
    );
    await database.query(
      `INSERT INTO scoring.audit_events(org_scope_id,actor_id,actor_roles,event_type,application_id,evaluation_id,correlation_id,outcome,metadata) VALUES($1,$2,$3,'EVALUATION_FAILED',$4,$5,$6,'error',$7)`,
      [
        command.orgId,
        command.actorId,
        command.actorRoles,
        command.applicationId,
        command.evaluationId,
        command.correlationId,
        { errorCode: command.errorCode, toStatus: "error" },
      ],
    );
  });
}
