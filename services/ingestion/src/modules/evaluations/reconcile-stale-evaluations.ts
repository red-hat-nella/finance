import { randomUUID } from "node:crypto";
import type pg from "pg";
import { inTransaction } from "../../infrastructure/db/transaction.js";

export interface ReconcileResult {
  readonly lockAcquired: boolean;
  readonly reconciled: number;
}

export async function reconcileStaleEvaluations(
  pool: pg.Pool,
  staleAfterSeconds = 120,
): Promise<ReconcileResult> {
  return inTransaction(pool, async (db) => {
    const lock = await db.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtext('scoring.reconcile-stale-evaluations')) acquired`,
    );
    if (!lock.rows[0]?.acquired) return { lockAcquired: false, reconciled: 0 };
    const stale = await db.query<{
      evaluation_id: string;
      application_id: string;
      revision_id: string;
      org_scope_id: string;
      owner_actor_id: string;
    }>(
      `SELECT e.id evaluation_id,a.id application_id,r.id revision_id,
              e.org_scope_id,e.owner_actor_id
         FROM scoring.evaluations e
         JOIN scoring.application_revisions r ON r.id=e.revision_id
         JOIN scoring.applications a ON a.id=r.application_id
        WHERE e.status='evaluando'
          AND e.started_at < now() - make_interval(secs => $1)
        ORDER BY e.started_at,e.id
        FOR UPDATE OF e,a,r SKIP LOCKED
        LIMIT 500`,
      [staleAfterSeconds],
    );
    let reconciled = 0;
    for (const item of stale.rows) {
      const completed = await db.query(
        `UPDATE scoring.evaluations SET status='error',error_code='ORCHESTRATION_INTERRUPTED',
                completed_at=now(),retention_until=now()+interval '5 years'
          WHERE id=$1 AND status='evaluando' RETURNING id`,
        [item.evaluation_id],
      );
      if ((completed.rowCount ?? 0) !== 1) continue;
      await db.query(
        `UPDATE scoring.application_revisions SET status='error',updated_at=now()
          WHERE id=$1 AND status='evaluando'`,
        [item.revision_id],
      );
      await db.query(
        `UPDATE scoring.applications SET current_status='error',updated_at=now()
          WHERE id=$1 AND current_revision_id=$2 AND current_evaluation_id=$3
            AND current_status='evaluando'`,
        [item.application_id, item.revision_id, item.evaluation_id],
      );
      await db.query(
        `INSERT INTO scoring.audit_events(
           org_scope_id,actor_id,actor_roles,event_type,application_id,evaluation_id,
           correlation_id,outcome,metadata
         ) VALUES($1,$2,$3,'EVALUATION_FAILED',$4,$5,$6,'error',$7::jsonb)`,
        [
          item.org_scope_id,
          "system:reconciler",
          ["system"],
          item.application_id,
          item.evaluation_id,
          randomUUID(),
          JSON.stringify({
            errorCode: "ORCHESTRATION_INTERRUPTED",
            fromStatus: "evaluando",
            toStatus: "error",
          }),
        ],
      );
      reconciled += 1;
    }
    return { lockAcquired: true, reconciled };
  });
}
