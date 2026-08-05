import type pg from "pg";
import type { AlternativeDataInput } from "../../domain/applications/application.js";
import type { ActorContext } from "../../domain/authorization/policies.js";
import type { ScoringResponse } from "../../infrastructure/scoring/scoring-client.js";
import type { ScoringSnapshot } from "./scoring-input.builder.js";
import type { NormalizedScoringInput } from "./scoring-input.builder.js";

type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

interface EvaluationDraftRow extends pg.QueryResultRow {
  application_id: string;
  application_public_id: string;
  application_status: string;
  revision_id: string;
  revision_number: number;
  lock_version: number;
  consent_status: "accepted" | "denied" | "revoked" | null;
  document_blind_index: Buffer;
  document_masked: string;
  display_name: string;
  income_status: "provided" | "unavailable" | null;
  income_unavailable_reason: string | null;
  monthly_income_cop: string | null;
  source_type: "employment" | "self_employed" | "pension" | "other" | null;
  stability_months: number | null;
  utilities_status: "provided" | "unavailable" | null;
  utilities_unavailable_reason: string | null;
  mobile_status: "provided" | "unavailable" | null;
  mobile_unavailable_reason: string | null;
  mobile_mode: "prepaid" | "postpaid" | null;
  tenure_months: number | null;
  mobile_observed_months: number | null;
  regular_months: number | null;
  criteria_checksum: string;
}

interface UtilityRow extends pg.QueryResultRow {
  service_type: "electricity" | "water" | "gas" | "internet" | "other";
  period_start: Date | string;
  period_end: Date | string;
  observed_months: number;
  total_obligations: number;
  on_time_count: number;
  late_count: number;
  missed_count: number;
  average_monthly_amount_cop: string;
}

interface RelatedAttemptRow extends pg.QueryResultRow {
  public_id: string;
  attempt_number: number;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  error_code: string | null;
}

export interface EvaluationDraft {
  readonly applicationId: string;
  readonly applicationPublicId: string;
  readonly applicationStatus: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly lockVersion: number;
  readonly consentStatus: EvaluationDraftRow["consent_status"];
  readonly documentBlindIndex: Buffer;
  readonly documentMasked: string;
  readonly displayName: string;
  readonly criteriaChecksum: string;
  readonly alternativeData: AlternativeDataInput;
}

export interface StartedEvaluation {
  readonly id: string;
  readonly publicId: string;
  readonly attemptNumber: number;
  readonly startedAt: Date;
}

export interface RetryPreparation {
  readonly draft: EvaluationDraft;
  readonly failedEvaluationId: string;
  readonly failedEvaluationPublicId: string;
  readonly snapshot: ScoringSnapshot;
}

export class EvaluationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async lockApplicationDraft(
    db: Queryable,
    publicId: string,
    actor: ActorContext,
  ): Promise<EvaluationDraft | null> {
    const result = await db.query<EvaluationDraftRow>(
      `SELECT a.id application_id,a.public_id application_public_id,
              a.current_status application_status,r.id revision_id,
              r.revision_number,r.lock_version,c.status consent_status,
              s.document_blind_index,s.document_masked,s.display_name,
              d.income_status,d.income_unavailable_reason,i.monthly_income_cop,i.source_type,i.stability_months,
              d.utilities_status,d.utilities_unavailable_reason,
              d.mobile_status,d.mobile_unavailable_reason,m.mode mobile_mode,m.tenure_months,
              m.observed_months mobile_observed_months,m.regular_months,
              encode(v.checksum,'hex') criteria_checksum
         FROM scoring.applications a
         JOIN scoring.application_revisions r ON r.id=a.current_revision_id
         JOIN scoring.revision_identity_snapshots s ON s.revision_id=r.id
         LEFT JOIN scoring.consents c ON c.id=r.consent_id
         LEFT JOIN scoring.alternative_data_sets d ON d.revision_id=r.id
         LEFT JOIN scoring.income_details i ON i.revision_id=r.id
         LEFT JOIN scoring.mobile_details m ON m.revision_id=r.id
         JOIN scoring.criteria_versions v ON v.version=$4
        WHERE a.public_id=$1 AND a.org_scope_id=$2 AND a.owner_actor_id=$3
          AND a.deleted_at IS NULL
        FOR UPDATE OF a,r`,
      [publicId, actor.orgId, actor.actorId, "SCORING-MVP-1.0.0"],
    );
    const row = result.rows[0];
    if (!row) return null;
    const utilities = await db.query<UtilityRow>(
      `SELECT service_type,period_start,period_end,observed_months,total_obligations,
              on_time_count,late_count,missed_count,average_monthly_amount_cop
         FROM scoring.utility_references WHERE revision_id=$1 ORDER BY ordinal`,
      [row.revision_id],
    );
    return {
      applicationId: row.application_id,
      applicationPublicId: row.application_public_id,
      applicationStatus: row.application_status,
      revisionId: row.revision_id,
      revisionNumber: row.revision_number,
      lockVersion: row.lock_version,
      consentStatus: row.consent_status,
      documentBlindIndex: row.document_blind_index,
      documentMasked: row.document_masked,
      displayName: row.display_name,
      criteriaChecksum: row.criteria_checksum,
      alternativeData: this.alternativeData(row, utilities.rows),
    };
  }

  async start(
    db: Queryable,
    draft: EvaluationDraft,
    actor: ActorContext,
    publicId: string,
    correlationId: string,
    snapshot: ScoringSnapshot,
  ): Promise<StartedEvaluation> {
    const attempt = await db.query<{ attempt_number: number }>(
      `SELECT COALESCE(max(attempt_number),0)+1 attempt_number
         FROM scoring.evaluations WHERE revision_id=$1`,
      [draft.revisionId],
    );
    const attemptNumber = attempt.rows[0]?.attempt_number ?? 1;
    const inserted = await db.query<{
      id: string;
      started_at: Date;
    }>(
      `INSERT INTO scoring.evaluations(
         public_id,revision_id,attempt_number,org_scope_id,owner_actor_id,
         initiated_by_actor_id,document_blind_index,document_masked,
         applicant_display_name,status,criteria_version,input_hash,correlation_id
       ) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'evaluando',$9,$10,$11)
       RETURNING id,started_at`,
      [
        publicId,
        draft.revisionId,
        attemptNumber,
        actor.orgId,
        actor.actorId,
        draft.documentBlindIndex,
        draft.documentMasked,
        draft.displayName,
        "SCORING-MVP-1.0.0",
        snapshot.inputHashBuffer,
        correlationId,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("Evaluation insert did not return an ID.");
    await db.query(
      `INSERT INTO scoring.evaluation_input_snapshots(
         evaluation_id,schema_version,normalized_input,input_hash
       ) VALUES($1,$2,$3::jsonb,$4)`,
      [
        row.id,
        snapshot.inputSchemaVersion,
        JSON.stringify(snapshot.normalizedInput),
        snapshot.inputHashBuffer,
      ],
    );
    await db.query(
      `UPDATE scoring.application_revisions
          SET status='evaluando',locked_at=now(),input_hash=$2,updated_at=now()
        WHERE id=$1 AND status='borrador'`,
      [draft.revisionId, snapshot.inputHashBuffer],
    );
    await db.query(
      `UPDATE scoring.applications
          SET current_status='evaluando',draft_expires_at=NULL,
              current_evaluation_id=$2,updated_at=now()
        WHERE id=$1 AND current_revision_id=$3 AND current_status='borrador'`,
      [draft.applicationId, row.id, draft.revisionId],
    );
    return {
      id: row.id,
      publicId,
      attemptNumber,
      startedAt: row.started_at,
    };
  }

  async lockFailedEvaluation(
    db: Queryable,
    publicId: string,
    actor: ActorContext,
  ): Promise<RetryPreparation | null> {
    const result = await db.query<{
      failed_evaluation_id: string;
      failed_evaluation_public_id: string;
      application_id: string;
      application_public_id: string;
      application_status: string;
      revision_id: string;
      revision_number: number;
      lock_version: number;
      document_blind_index: Buffer;
      document_masked: string;
      display_name: string;
      criteria_checksum: string;
      schema_version: "1.0.0";
      normalized_input: NormalizedScoringInput;
      input_hash: Buffer;
    }>(
      `SELECT e.id failed_evaluation_id,e.public_id failed_evaluation_public_id,
              a.id application_id,a.public_id application_public_id,
              a.current_status application_status,r.id revision_id,
              r.revision_number,r.lock_version,e.document_blind_index,
              e.document_masked,e.applicant_display_name display_name,
              encode(v.checksum,'hex') criteria_checksum,
              s.schema_version,s.normalized_input,s.input_hash
         FROM scoring.evaluations e
         JOIN scoring.application_revisions r ON r.id=e.revision_id
         JOIN scoring.applications a ON a.id=r.application_id
         JOIN scoring.evaluation_input_snapshots s ON s.evaluation_id=e.id
         JOIN scoring.criteria_versions v ON v.version=e.criteria_version
        WHERE e.public_id=$1 AND e.org_scope_id=$2 AND e.owner_actor_id=$3
          AND e.status='error' AND a.current_status='error'
          AND a.current_revision_id=r.id AND a.current_evaluation_id=e.id
          AND a.deleted_at IS NULL
        FOR UPDATE OF a,r,e`,
      [publicId, actor.orgId, actor.actorId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      failedEvaluationId: row.failed_evaluation_id,
      failedEvaluationPublicId: row.failed_evaluation_public_id,
      draft: {
        applicationId: row.application_id,
        applicationPublicId: row.application_public_id,
        applicationStatus: row.application_status,
        revisionId: row.revision_id,
        revisionNumber: row.revision_number,
        lockVersion: row.lock_version,
        consentStatus: "accepted",
        documentBlindIndex: row.document_blind_index,
        documentMasked: row.document_masked,
        displayName: row.display_name,
        criteriaChecksum: row.criteria_checksum,
        alternativeData: {},
      },
      snapshot: {
        inputSchemaVersion: row.schema_version,
        normalizedInput: row.normalized_input,
        inputHash: `sha256:${row.input_hash.toString("hex")}`,
        inputHashBuffer: row.input_hash,
      },
    };
  }

  async startRetry(
    db: Queryable,
    prepared: RetryPreparation,
    actor: ActorContext,
    publicId: string,
    correlationId: string,
  ): Promise<StartedEvaluation> {
    const attempt = await db.query<{ attempt_number: number }>(
      `SELECT COALESCE(max(attempt_number),0)+1 attempt_number
         FROM scoring.evaluations WHERE revision_id=$1`,
      [prepared.draft.revisionId],
    );
    const attemptNumber = attempt.rows[0]?.attempt_number ?? 1;
    const inserted = await db.query<{ id: string; started_at: Date }>(
      `INSERT INTO scoring.evaluations(
         public_id,revision_id,attempt_number,retry_of_evaluation_id,
         org_scope_id,owner_actor_id,initiated_by_actor_id,document_blind_index,
         document_masked,applicant_display_name,status,criteria_version,input_hash,correlation_id
       ) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,'evaluando',$10,$11,$12)
       RETURNING id,started_at`,
      [
        publicId,
        prepared.draft.revisionId,
        attemptNumber,
        prepared.failedEvaluationId,
        actor.orgId,
        actor.actorId,
        prepared.draft.documentBlindIndex,
        prepared.draft.documentMasked,
        prepared.draft.displayName,
        "SCORING-MVP-1.0.0",
        prepared.snapshot.inputHashBuffer,
        correlationId,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("Retry insert did not return an ID.");
    await db.query(
      `INSERT INTO scoring.evaluation_input_snapshots(
         evaluation_id,schema_version,normalized_input,input_hash
       ) VALUES($1,$2,$3::jsonb,$4)`,
      [
        row.id,
        prepared.snapshot.inputSchemaVersion,
        JSON.stringify(prepared.snapshot.normalizedInput),
        prepared.snapshot.inputHashBuffer,
      ],
    );
    await db.query(
      `UPDATE scoring.application_revisions SET status='evaluando',updated_at=now()
        WHERE id=$1 AND status='error'`,
      [prepared.draft.revisionId],
    );
    await db.query(
      `UPDATE scoring.applications SET current_status='evaluando',
              current_evaluation_id=$2,updated_at=now()
        WHERE id=$1 AND current_revision_id=$3 AND current_status='error'`,
      [prepared.draft.applicationId, row.id, prepared.draft.revisionId],
    );
    return { id: row.id, publicId, attemptNumber, startedAt: row.started_at };
  }

  async complete(
    db: Queryable,
    draft: EvaluationDraft,
    evaluation: StartedEvaluation,
    score: ScoringResponse,
    completedAt: Date,
  ): Promise<void> {
    const terminal = await db.query(
      `UPDATE scoring.evaluations SET
         status=$2,score=$3,risk_band=$4,recommendation_code=$5,
         recommendation_text=$6,manual_review_reasons=$7::jsonb,
         completed_at=$8::timestamptz,
         retention_until=$8::timestamptz+interval '5 years'
       WHERE id=$1 AND status='evaluando' RETURNING id`,
      [
        evaluation.id,
        score.status,
        score.score,
        score.riskBand,
        score.recommendation.code,
        score.recommendation.text,
        JSON.stringify(score.manualReviewReasons),
        completedAt,
      ],
    );
    if ((terminal.rowCount ?? 0) !== 1)
      throw new Error("Evaluation was not in an active state.");
    for (const factor of score.factors)
      await db.query(
        `INSERT INTO scoring.evaluation_factors(
           evaluation_id,ordinal,dimension,rule_code,direction,contribution_points,
           dimension_index,weight,observed_summary,explanation
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          evaluation.id,
          factor.rank,
          factor.dimension,
          factor.ruleCode,
          factor.direction,
          factor.contributionPoints,
          factor.dimensionIndex,
          factor.weight,
          factor.observedSummary,
          factor.explanation,
        ],
      );
    await db.query(
      `UPDATE scoring.application_revisions SET status=$2,updated_at=now()
        WHERE id=$1 AND status='evaluando'`,
      [draft.revisionId, score.status],
    );
    await db.query(
      `UPDATE scoring.applications SET current_status=$2,updated_at=now()
        WHERE id=$1 AND current_revision_id=$3 AND current_evaluation_id=$4`,
      [draft.applicationId, score.status, draft.revisionId, evaluation.id],
    );
  }

  async relatedAttempts(
    revisionId: string,
    currentEvaluationId: string,
  ): Promise<readonly RelatedAttemptRow[]> {
    const result = await this.pool.query<RelatedAttemptRow>(
      `SELECT public_id,attempt_number,status,started_at,completed_at,error_code
         FROM scoring.evaluations
        WHERE revision_id=$1 AND id<>$2 ORDER BY attempt_number DESC,id DESC`,
      [revisionId, currentEvaluationId],
    );
    return result.rows;
  }

  private alternativeData(
    row: EvaluationDraftRow,
    utilities: readonly UtilityRow[],
  ): AlternativeDataInput {
    const value: {
      income?: NonNullable<AlternativeDataInput["income"]>;
      utilities?: NonNullable<AlternativeDataInput["utilities"]>;
      mobile?: NonNullable<AlternativeDataInput["mobile"]>;
    } = {};
    if (row.income_status === "unavailable" && row.income_unavailable_reason)
      value.income = { availability: "unavailable", reason: row.income_unavailable_reason };
    if (
      row.income_status === "provided" &&
      row.monthly_income_cop !== null &&
      row.source_type !== null &&
      row.stability_months !== null
    )
      value.income = {
        availability: "provided",
        monthlyIncomeCop: row.monthly_income_cop,
        sourceType: row.source_type,
        stabilityMonths: row.stability_months,
      };
    if (row.utilities_status === "unavailable" && row.utilities_unavailable_reason)
      value.utilities = { availability: "unavailable", reason: row.utilities_unavailable_reason };
    if (row.utilities_status === "provided")
      value.utilities = {
        availability: "provided",
        references: utilities.map((item) => ({
          serviceType: item.service_type,
          periodStart: this.dateOnly(item.period_start),
          periodEnd: this.dateOnly(item.period_end),
          observedMonths: item.observed_months,
          totalObligations: item.total_obligations,
          onTimeCount: item.on_time_count,
          lateCount: item.late_count,
          missedCount: item.missed_count,
          averageMonthlyAmountCop: item.average_monthly_amount_cop,
        })),
      };
    if (row.mobile_status === "unavailable" && row.mobile_unavailable_reason)
      value.mobile = { availability: "unavailable", reason: row.mobile_unavailable_reason };
    if (
      row.mobile_status === "provided" &&
      row.mobile_mode &&
      row.tenure_months !== null &&
      row.mobile_observed_months !== null &&
      row.regular_months !== null
    )
      value.mobile = {
        availability: "provided",
        mode: row.mobile_mode,
        tenureMonths: row.tenure_months,
        observedMonths: row.mobile_observed_months,
        regularMonths: row.regular_months,
      };
    return value;
  }

  private dateOnly(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);
  }
}
