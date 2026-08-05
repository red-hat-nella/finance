import { randomUUID } from "node:crypto";
import type pg from "pg";
import { PostgresAuditWriter } from "../audit/audit-writer.js";

export interface RetentionOptions {
  readonly dryRun: boolean;
  readonly batchSize?: number;
  readonly now?: Date;
  readonly initiatedBy?: string;
}

export interface RetentionResult {
  readonly lockAcquired: boolean;
  readonly dryRun: boolean;
  readonly runId: string | null;
  readonly draftDeleted: number;
  readonly evaluationsAnonymized: number;
  readonly consentsDeleted: number;
  readonly auditEventsAnonymized: number;
}

interface DraftRow extends pg.QueryResultRow {
  id: string;
  org_scope_id: string;
  applicant_id: string | null;
}

interface EvaluationRow extends pg.QueryResultRow {
  id: string;
  revision_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
}

const LOCK_KEY = "alternative-credit-scoring-retention-v1";

export class RetentionService {
  constructor(private readonly pool: pg.Pool) {}

  async run(options: RetentionOptions): Promise<RetentionResult> {
    const batchSize = options.batchSize ?? 500;
    if (!Number.isInteger(batchSize) || batchSize < 10 || batchSize > 1000)
      throw new Error("Retention batch size must be between 10 and 1000");
    const now = options.now ?? new Date();
    const client = await this.pool.connect();
    let runId: string | null = null;
    try {
      const lock = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock(hashtext($1)) acquired",
        [LOCK_KEY],
      );
      if (!lock.rows[0]?.acquired) return emptyResult(options.dryRun, false);
      if (options.dryRun)
        return await this.preview(client, now, batchSize);

      runId = randomUUID();
      await client.query("BEGIN");
      await client.query("SET LOCAL scoring.retention_mode = 'on'");
      await client.query(
        `INSERT INTO scoring.retention_runs(id,initiated_by,status)
         VALUES($1,$2,'running')`,
        [runId, options.initiatedBy ?? "retention-job"],
      );
      const drafts = await this.deleteExpiredDrafts(client, now, batchSize, runId);
      const evaluations = await this.anonymizeEvaluations(
        client,
        now,
        batchSize,
      );
      const staleAudit = await this.anonymizeStaleAudit(client, now, batchSize);
      const result: RetentionResult = {
        lockAcquired: true,
        dryRun: false,
        runId,
        draftDeleted: drafts.deleted,
        evaluationsAnonymized: evaluations.anonymized,
        consentsDeleted: drafts.consents + evaluations.consents,
        auditEventsAnonymized: evaluations.auditEvents + staleAudit,
      };
      await client.query(
        `UPDATE scoring.retention_runs
            SET completed_at=now(),status='completed',draft_deleted=$2,
                evaluations_anonymized=$3,consents_deleted=$4,
                audit_events_anonymized=$5
          WHERE id=$1`,
        [
          runId,
          result.draftDeleted,
          result.evaluationsAnonymized,
          result.consentsDeleted,
          result.auditEventsAnonymized,
        ],
      );
      await new PostgresAuditWriter(this.pool).write(
        {
          type: "RETENTION_COMPLETED",
          roles: ["system"],
          correlationId: runId,
          outcome: "success",
          metadata: {
            retentionRunId: runId,
            retentionAction: "delete_and_anonymize",
            draftDeleted: result.draftDeleted,
            evaluationsAnonymized: result.evaluationsAnonymized,
            consentsDeleted: result.consentsDeleted,
            auditEventsAnonymized: result.auditEventsAnonymized,
          },
        },
        client,
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (runId)
        await client.query(
          `INSERT INTO scoring.retention_runs(id,initiated_by,status,completed_at,error_code)
           VALUES($1,$2,'failed',now(),'RETENTION_FAILED')
           ON CONFLICT(id) DO UPDATE SET status='failed',completed_at=now(),error_code='RETENTION_FAILED'`,
          [runId, options.initiatedBy ?? "retention-job"],
        );
      throw error;
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
      client.release();
    }
  }

  private async preview(
    client: pg.PoolClient,
    now: Date,
    batchSize: number,
  ): Promise<RetentionResult> {
    const drafts = await client.query<{ count: string }>(
        `SELECT count(*) FROM (
           SELECT id FROM scoring.applications
            WHERE current_status='borrador' AND deleted_at IS NULL
              AND draft_expires_at <= $1
            ORDER BY draft_expires_at,id LIMIT $2
         ) candidates`,
        [now, batchSize],
      );
    const evaluations = await client.query<{ count: string }>(
        `SELECT count(*) FROM (
           SELECT id FROM scoring.evaluations
            WHERE retention_until <= $1 AND anonymized_at IS NULL
            ORDER BY retention_until,id LIMIT $2
         ) candidates`,
        [now, batchSize],
      );
    const audit = await client.query<{ count: string }>(
        `SELECT count(*) FROM (
           SELECT id FROM scoring.audit_events
            WHERE occurred_at <= $1::timestamptz - interval '5 years'
              AND (org_scope_id IS NOT NULL OR actor_id IS NOT NULL OR application_id IS NOT NULL OR evaluation_id IS NOT NULL)
            ORDER BY occurred_at,id LIMIT $2
         ) candidates`,
        [now, batchSize],
      );
    return {
      lockAcquired: true,
      dryRun: true,
      runId: null,
      draftDeleted: Number(drafts.rows[0]?.count ?? 0),
      evaluationsAnonymized: Number(evaluations.rows[0]?.count ?? 0),
      consentsDeleted: 0,
      auditEventsAnonymized: Number(audit.rows[0]?.count ?? 0),
    };
  }

  private async deleteExpiredDrafts(
    client: pg.PoolClient,
    now: Date,
    batchSize: number,
    runId: string,
  ): Promise<{ deleted: number; consents: number }> {
    const rows = await client.query<DraftRow>(
      `SELECT id,org_scope_id,applicant_id
         FROM scoring.applications
        WHERE current_status='borrador' AND deleted_at IS NULL
          AND draft_expires_at <= $1
        ORDER BY draft_expires_at,id
        LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [now, batchSize],
    );
    let consents = 0;
    const writer = new PostgresAuditWriter(this.pool);
    for (const draft of rows.rows) {
      await writer.write(
        {
          type: "DRAFT_RETENTION_DELETED",
          orgId: draft.org_scope_id,
          roles: ["system"],
          applicationId: draft.id,
          correlationId: runId,
          outcome: "success",
          metadata: { retentionAction: "expired_draft_deleted" },
        },
        client,
      );
      await client.query(
        "UPDATE scoring.applications SET current_revision_id=NULL,current_evaluation_id=NULL WHERE id=$1",
        [draft.id],
      );
      await client.query(
        "DELETE FROM scoring.application_revisions WHERE application_id=$1",
        [draft.id],
      );
      const deletedConsents = await client.query(
        "DELETE FROM scoring.consents WHERE application_id=$1",
        [draft.id],
      );
      consents += deletedConsents.rowCount ?? 0;
      await client.query("DELETE FROM scoring.applications WHERE id=$1", [draft.id]);
      if (draft.applicant_id)
        await client.query(
          `DELETE FROM scoring.applicants a WHERE a.id=$1
            AND NOT EXISTS(SELECT 1 FROM scoring.applications x WHERE x.applicant_id=a.id)`,
          [draft.applicant_id],
        );
    }
    return { deleted: rows.rowCount ?? 0, consents };
  }

  private async anonymizeEvaluations(
    client: pg.PoolClient,
    now: Date,
    batchSize: number,
  ): Promise<{ anonymized: number; consents: number; auditEvents: number }> {
    const rows = await client.query<EvaluationRow>(
      `SELECT e.id,e.revision_id,r.application_id,a.applicant_id
         FROM scoring.evaluations e
         LEFT JOIN scoring.application_revisions r ON r.id=e.revision_id
         LEFT JOIN scoring.applications a ON a.id=r.application_id
        WHERE e.retention_until <= $1 AND e.anonymized_at IS NULL
        ORDER BY e.retention_until,e.id
        LIMIT $2 FOR UPDATE OF e SKIP LOCKED`,
      [now, batchSize],
    );
    let auditEvents = 0;
    for (const evaluation of rows.rows) {
      const audit = await client.query(
        `UPDATE scoring.audit_events
            SET org_scope_id=NULL,actor_id=NULL,actor_roles='{}',application_id=NULL,evaluation_id=NULL,
                metadata=(CASE WHEN metadata ? 'criteriaVersion'
                  THEN jsonb_build_object('criteriaVersion',metadata->'criteriaVersion','retentionAction','evaluation_anonymized')
                  ELSE jsonb_build_object('retentionAction','evaluation_anonymized') END)
          WHERE evaluation_id=$1`,
        [evaluation.id],
      );
      auditEvents += audit.rowCount ?? 0;
      if (evaluation.application_id)
        await client.query(
          `UPDATE scoring.applications
              SET current_evaluation_id=CASE WHEN current_evaluation_id=$1 THEN NULL ELSE current_evaluation_id END,
                  updated_at=updated_at
            WHERE id=$2`,
          [evaluation.id, evaluation.application_id],
        );
      await client.query(
        `UPDATE scoring.evaluations
            SET public_id=NULL,revision_id=NULL,org_scope_id=NULL,owner_actor_id=NULL,
                initiated_by_actor_id=NULL,document_blind_index=NULL,document_masked=NULL,
                applicant_display_name=NULL,correlation_id=gen_random_uuid(),anonymized_at=$2
          WHERE id=$1`,
        [evaluation.id, now],
      );
    }

    const revisionIds = [...new Set(rows.rows.map((row) => row.revision_id).filter(Boolean))] as string[];
    let consents = 0;
    for (const revisionId of revisionIds) {
      const revision = await client.query<{ application_id: string; consent_id: string | null }>(
        `SELECT application_id,consent_id FROM scoring.application_revisions r
          WHERE id=$1 AND NOT EXISTS(
            SELECT 1 FROM scoring.evaluations e WHERE e.revision_id=r.id AND e.anonymized_at IS NULL
          )`,
        [revisionId],
      );
      const candidate = revision.rows[0];
      if (!candidate) continue;
      await client.query(
        "UPDATE scoring.applications SET current_revision_id=NULL WHERE id=$1 AND current_revision_id=$2",
        [candidate.application_id, revisionId],
      );
      await client.query("DELETE FROM scoring.application_revisions WHERE id=$1", [revisionId]);
      if (candidate.consent_id) {
        const deleted = await client.query(
          "DELETE FROM scoring.consents WHERE id=$1",
          [candidate.consent_id],
        );
        consents += deleted.rowCount ?? 0;
      }
    }

    const applicationIds = [...new Set(rows.rows.map((row) => row.application_id).filter(Boolean))] as string[];
    for (const applicationId of applicationIds) {
      const applicant = await client.query<{ applicant_id: string | null }>(
        `DELETE FROM scoring.applications a WHERE a.id=$1
          AND NOT EXISTS(SELECT 1 FROM scoring.application_revisions r WHERE r.application_id=a.id)
          AND NOT EXISTS(SELECT 1 FROM scoring.evaluations e JOIN scoring.application_revisions r ON r.id=e.revision_id WHERE r.application_id=a.id AND e.anonymized_at IS NULL)
          RETURNING applicant_id`,
        [applicationId],
      );
      const applicantId = applicant.rows[0]?.applicant_id;
      if (applicantId)
        await client.query(
          `DELETE FROM scoring.applicants a WHERE a.id=$1
            AND NOT EXISTS(SELECT 1 FROM scoring.applications x WHERE x.applicant_id=a.id)`,
          [applicantId],
        );
    }
    return { anonymized: rows.rowCount ?? 0, consents, auditEvents };
  }

  private async anonymizeStaleAudit(
    client: pg.PoolClient,
    now: Date,
    batchSize: number,
  ): Promise<number> {
    const result = await client.query(
      `WITH candidates AS (
         SELECT id FROM scoring.audit_events
          WHERE occurred_at <= $1::timestamptz - interval '5 years'
            AND (org_scope_id IS NOT NULL OR actor_id IS NOT NULL OR application_id IS NOT NULL OR evaluation_id IS NOT NULL)
          ORDER BY occurred_at,id LIMIT $2 FOR UPDATE SKIP LOCKED
       )
       UPDATE scoring.audit_events a
          SET org_scope_id=NULL,actor_id=NULL,actor_roles='{}',application_id=NULL,evaluation_id=NULL,
              metadata=jsonb_build_object('retentionAction','audit_anonymized')
         FROM candidates c WHERE a.id=c.id`,
      [now, batchSize],
    );
    return result.rowCount ?? 0;
  }
}

function emptyResult(dryRun: boolean, lockAcquired: boolean): RetentionResult {
  return {
    lockAcquired,
    dryRun,
    runId: null,
    draftDeleted: 0,
    evaluationsAnonymized: 0,
    consentsDeleted: 0,
    auditEventsAnonymized: 0,
  };
}
