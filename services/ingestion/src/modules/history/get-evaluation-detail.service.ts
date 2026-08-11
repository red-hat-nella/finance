import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import type { components } from "../../generated/public/index.js";
import type { AlternativeDataInput as DomainAlternativeDataInput } from "../../domain/applications/application.js";
import { decryptField } from "../../infrastructure/crypto/field-crypto.js";
import { encryptionKeyForVersion } from "../../config/pii-keyring.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import type { HistoryActor } from "./search-history.service.js";

type EvaluationDetail = components["schemas"]["EvaluationDetail"];
type ApplicationResource = components["schemas"]["ApplicationResource"];
type AlternativeDataInput = components["schemas"]["AlternativeDataInput"];

interface EvaluationRow extends pg.QueryResultRow {
  id: string;
  public_id: string;
  revision_id: string;
  application_id: string;
  application_public_id: string;
  revision_number: number;
  attempt_number: number;
  status: EvaluationDetail["state"];
  error_code: string | null;
  score: number | null;
  risk_band: EvaluationDetail["riskBand"];
  recommendation_code: string | null;
  recommendation_text: string | null;
  manual_review_reasons: EvaluationDetail["manualReviewReasons"];
  criteria_version: EvaluationDetail["criteriaVersion"];
  input_hash: Buffer;
  started_at: Date;
  completed_at: Date | null;
  document_masked: string;
  applicant_display_name: string;
}

interface SnapshotRow extends pg.QueryResultRow {
  application_public_id: string;
  application_status: ApplicationResource["state"];
  application_created_at: Date;
  application_updated_at: Date;
  draft_expires_at: Date | null;
  revision_number: number;
  lock_version: number;
  pii_key_version?: number | null;
  document_type: components["schemas"]["DocumentType"];
  document_ciphertext: Buffer;
  document_nonce: Buffer;
  document_tag: Buffer;
  document_masked: string;
  full_name_ciphertext: Buffer;
  full_name_nonce: Buffer;
  full_name_tag: Buffer;
  display_name: string;
  phone_ciphertext: Buffer | null;
  phone_nonce: Buffer | null;
  phone_tag: Buffer | null;
  email_ciphertext: Buffer | null;
  email_nonce: Buffer | null;
  email_tag: Buffer | null;
  consent_status: "accepted" | "denied" | "revoked" | null;
  notice_version: string | null;
  purpose_code: "ALTERNATIVE_CREDIT_RISK_EVALUATION" | null;
  consent_recorded_at: Date | null;
  income_status: "provided" | "unavailable";
  income_unavailable_reason: string | null;
  utilities_status: "provided" | "unavailable";
  utilities_unavailable_reason: string | null;
  mobile_status: "provided" | "unavailable";
  mobile_unavailable_reason: string | null;
  monthly_income_cop: string | null;
  source_type: "employment" | "self_employed" | "pension" | "other" | null;
  source_other_description: string | null;
  stability_months: number | null;
  mobile_mode: "prepaid" | "postpaid" | null;
  tenure_months: number | null;
  mobile_observed_months: number | null;
  regular_months: number | null;
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

interface FactorRow extends pg.QueryResultRow {
  rank: number;
  dimension: "utility" | "mobile" | "income";
  direction: "favorable" | "unfavorable" | "neutral";
  rule_code: string;
  contribution_points: string;
  dimension_index: string;
  weight: string;
  observed_summary: string;
  explanation: string;
}

interface AttemptRow extends pg.QueryResultRow {
  public_id: string;
  attempt_number: number;
  status: EvaluationDetail["state"];
  started_at: Date;
  completed_at: Date | null;
  error_code: string | null;
}

export class EvaluationNotFoundError extends Error {
  constructor() {
    super("No se encontró una evaluación accesible.");
    this.name = "EvaluationNotFoundError";
  }
}

export class EvaluationDetailRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAuthorized(
    evaluationId: string,
    actor: HistoryActor,
  ): Promise<EvaluationRow | null> {
    const restrictToOwner = actor.roles.includes("credit_analyst");
    const result = await this.pool.query<EvaluationRow>(
      `SELECT e.id,e.public_id,e.revision_id,r.application_id,a.public_id application_public_id,r.revision_number,e.attempt_number,e.status,e.error_code,e.score,e.risk_band,e.recommendation_code,e.recommendation_text,e.manual_review_reasons,e.criteria_version,e.input_hash,e.started_at,e.completed_at,e.document_masked,e.applicant_display_name
       FROM scoring.evaluations e
       JOIN scoring.application_revisions r ON r.id=e.revision_id
       JOIN scoring.applications a ON a.id=r.application_id
       WHERE e.public_id=$1::uuid AND e.org_scope_id=$2
         AND ($4::boolean=false OR e.owner_actor_id=$3)`,
      [evaluationId, actor.orgId, actor.actorId, restrictToOwner],
    );
    return result.rows[0] ?? null;
  }

  async getSnapshot(revisionId: string): Promise<SnapshotRow | null> {
    const result = await this.pool.query<SnapshotRow>(
      `SELECT a.public_id application_public_id,a.current_status application_status,a.created_at application_created_at,a.updated_at application_updated_at,a.draft_expires_at,
              r.revision_number,r.lock_version,s.pii_key_version,s.document_type,s.document_ciphertext,s.document_nonce,s.document_tag,s.document_masked,s.full_name_ciphertext,s.full_name_nonce,s.full_name_tag,s.display_name,s.phone_ciphertext,s.phone_nonce,s.phone_tag,s.email_ciphertext,s.email_nonce,s.email_tag,
              c.status consent_status,c.notice_version,c.purpose_code,c.recorded_at consent_recorded_at,
              d.income_status,d.income_unavailable_reason,d.utilities_status,d.utilities_unavailable_reason,d.mobile_status,d.mobile_unavailable_reason,
              i.monthly_income_cop,i.source_type,i.source_other_description,i.stability_months,
              m.mode mobile_mode,m.tenure_months,m.observed_months mobile_observed_months,m.regular_months
       FROM scoring.application_revisions r
       JOIN scoring.applications a ON a.id=r.application_id
       JOIN scoring.revision_identity_snapshots s ON s.revision_id=r.id
       JOIN scoring.alternative_data_sets d ON d.revision_id=r.id
       LEFT JOIN scoring.consents c ON c.id=r.consent_id
       LEFT JOIN scoring.income_details i ON i.revision_id=r.id
       LEFT JOIN scoring.mobile_details m ON m.revision_id=r.id
       WHERE r.id=$1`,
      [revisionId],
    );
    return result.rows[0] ?? null;
  }

  async getUtilities(revisionId: string): Promise<readonly UtilityRow[]> {
    const result = await this.pool.query<UtilityRow>(
      `SELECT service_type,period_start,period_end,observed_months,total_obligations,on_time_count,late_count,missed_count,average_monthly_amount_cop
       FROM scoring.utility_references WHERE revision_id=$1 ORDER BY ordinal`,
      [revisionId],
    );
    return result.rows;
  }

  async getFactors(evaluationId: string): Promise<readonly FactorRow[]> {
    const result = await this.pool.query<FactorRow>(
      `SELECT ordinal rank,dimension,direction,rule_code,contribution_points::text,
              dimension_index::text,weight::text,observed_summary,explanation
       FROM scoring.evaluation_factors WHERE evaluation_id=$1 ORDER BY ordinal`,
      [evaluationId],
    );
    return result.rows;
  }

  async getRelatedAttempts(
    revisionId: string,
    currentEvaluationId: string,
  ): Promise<readonly AttemptRow[]> {
    const result = await this.pool.query<AttemptRow>(
      `SELECT public_id,attempt_number,status,started_at,completed_at,error_code
       FROM scoring.evaluations
       WHERE revision_id=$1 AND id<>$2
       ORDER BY attempt_number DESC,id DESC`,
      [revisionId, currentEvaluationId],
    );
    return result.rows;
  }
}

export class GetEvaluationDetailService {
  constructor(
    private readonly repository: EvaluationDetailRepository,
    private readonly auditWriter: AuditWriter,
    private readonly config: AppConfig,
  ) {}

  async execute(
    evaluationId: string,
    actor: HistoryActor,
    correlationId: string,
  ): Promise<EvaluationDetail> {
    const evaluation = await this.repository.findAuthorized(
      evaluationId,
      actor,
    );
    if (!evaluation) throw new EvaluationNotFoundError();

    const [snapshot, utilities, factors, attempts] = await Promise.all([
      this.repository.getSnapshot(evaluation.revision_id),
      this.repository.getUtilities(evaluation.revision_id),
      this.repository.getFactors(evaluation.id),
      this.repository.getRelatedAttempts(evaluation.revision_id, evaluation.id),
    ]);
    const inputSnapshot = snapshot
      ? this.buildInputSnapshot(snapshot, utilities)
      : null;
    await this.auditWriter.write({
      type: "EVALUATION_VIEWED",
      orgId: actor.orgId,
      actorId: actor.actorId,
      roles: actor.roles,
      applicationId: evaluation.application_id,
      evaluationId: evaluation.id,
      correlationId,
      outcome: "success",
      metadata: {
        revisionNumber: evaluation.revision_number,
        attemptNumber: evaluation.attempt_number,
        state: evaluation.status,
        criteriaVersion: evaluation.criteria_version,
      },
    });

    return {
      evaluationId: evaluation.public_id,
      applicationId: evaluation.application_public_id,
      revisionNumber: evaluation.revision_number,
      attemptNumber: evaluation.attempt_number,
      state: evaluation.status,
      errorCode: evaluation.error_code,
      score: evaluation.score,
      scoreScale: { minimum: 300, maximum: 850 },
      riskBand: evaluation.risk_band,
      recommendation:
        evaluation.recommendation_code && evaluation.recommendation_text
          ? {
              code: evaluation.recommendation_code as NonNullable<
                EvaluationDetail["recommendation"]
              >["code"],
              text: evaluation.recommendation_text,
            }
          : null,
      factors: factors.map((factor) => buildFactor(factor)),
      manualReviewReasons: evaluation.manual_review_reasons,
      criteriaVersion: evaluation.criteria_version,
      inputHash: `sha256:${evaluation.input_hash.toString("hex")}`,
      startedAt: toDateTime(evaluation.started_at),
      completedAt: evaluation.completed_at
        ? toDateTime(evaluation.completed_at)
        : null,
      timezone: "America/Bogota",
      applicantSummary: {
        documentMasked: evaluation.document_masked,
        displayName: evaluation.applicant_display_name,
      },
      inputSnapshot,
      relatedAttempts: attempts.map((attempt) => ({
        evaluationId: attempt.public_id,
        attemptNumber: attempt.attempt_number,
        state: attempt.status,
        startedAt: toDateTime(attempt.started_at),
        completedAt: attempt.completed_at
          ? toDateTime(attempt.completed_at)
          : null,
        errorCode: attempt.error_code,
      })),
    };
  }

  private buildInputSnapshot(
    row: SnapshotRow,
    utilityRows: readonly UtilityRow[],
  ): ApplicationResource {
    const key = encryptionKeyForVersion(
      this.config.pii,
      row.pii_key_version ?? this.config.pii.keyVersion,
    );
    const contact: { phone?: string; email?: string } = {};
    if (row.phone_ciphertext && row.phone_nonce && row.phone_tag)
      contact.phone = decryptField(
        {
          ciphertext: row.phone_ciphertext,
          nonce: row.phone_nonce,
          tag: row.phone_tag,
        },
        key,
      );
    if (row.email_ciphertext && row.email_nonce && row.email_tag)
      contact.email = decryptField(
        {
          ciphertext: row.email_ciphertext,
          nonce: row.email_nonce,
          tag: row.email_tag,
        },
        key,
      );

    return {
      applicationId: row.application_public_id,
      state: row.application_status,
      revisionNumber: row.revision_number,
      lockVersion: row.lock_version,
      createdAt: toDateTime(row.application_created_at),
      updatedAt: toDateTime(row.application_updated_at),
      draftExpiresAt: row.draft_expires_at
        ? toDateTime(row.draft_expires_at)
        : null,
      applicant: {
        documentType: row.document_type,
        documentNumber: decryptField(
          {
            ciphertext: row.document_ciphertext,
            nonce: row.document_nonce,
            tag: row.document_tag,
          },
          key,
        ),
        documentMasked: row.document_masked,
        fullName: decryptField(
          {
            ciphertext: row.full_name_ciphertext,
            nonce: row.full_name_nonce,
            tag: row.full_name_tag,
          },
          key,
        ),
        displayName: row.display_name,
        contact,
      },
      consent:
        row.consent_status &&
        row.notice_version &&
        row.purpose_code &&
        row.consent_recorded_at
          ? {
              decision: row.consent_status,
              noticeVersion: row.notice_version,
              purposeCode: row.purpose_code,
              recordedAt: toDateTime(row.consent_recorded_at),
            }
          : null,
      // The generated discriminator type uses schema names; the wire contract
      // correctly uses the literal values `provided` and `unavailable`.
      alternativeData: buildAlternativeData(
        row,
        utilityRows,
      ) as unknown as AlternativeDataInput,
    };
  }
}

function buildAlternativeData(
  row: SnapshotRow,
  utilities: readonly UtilityRow[],
): Required<DomainAlternativeDataInput> {
  return {
    income:
      row.income_status === "provided" &&
      row.monthly_income_cop &&
      row.source_type &&
      row.stability_months !== null
        ? {
            availability: "provided",
            monthlyIncomeCop: row.monthly_income_cop,
            sourceType: row.source_type,
            ...(row.source_other_description
              ? { sourceOtherDescription: row.source_other_description }
              : {}),
            stabilityMonths: row.stability_months,
          }
        : {
            availability: "unavailable",
            reason: row.income_unavailable_reason ?? "Dato no disponible",
          },
    utilities:
      row.utilities_status === "provided"
        ? {
            availability: "provided",
            references: utilities.map((utility) => ({
              serviceType: utility.service_type,
              periodStart: toDateOnly(utility.period_start),
              periodEnd: toDateOnly(utility.period_end),
              observedMonths: utility.observed_months,
              totalObligations: utility.total_obligations,
              onTimeCount: utility.on_time_count,
              lateCount: utility.late_count,
              missedCount: utility.missed_count,
              averageMonthlyAmountCop: utility.average_monthly_amount_cop,
            })),
          }
        : {
            availability: "unavailable",
            reason: row.utilities_unavailable_reason ?? "Dato no disponible",
          },
    mobile:
      row.mobile_status === "provided" &&
      row.mobile_mode &&
      row.tenure_months !== null &&
      row.mobile_observed_months !== null &&
      row.regular_months !== null
        ? {
            availability: "provided",
            mode: row.mobile_mode,
            tenureMonths: row.tenure_months,
            observedMonths: row.mobile_observed_months,
            regularMonths: row.regular_months,
          }
        : {
            availability: "unavailable",
            reason: row.mobile_unavailable_reason ?? "Dato no disponible",
          },
  };
}

function buildFactor(row: FactorRow): components["schemas"]["Factor"] {
  return {
    rank: row.rank,
    dimension: row.dimension,
    direction: row.direction,
    dimensionIndex: Number(row.dimension_index).toFixed(3),
    weight: Number(row.weight).toFixed(3),
    contributionPoints: Number(row.contribution_points).toFixed(3),
    observedSummary: row.observed_summary,
    ruleCode: row.rule_code,
    explanation: row.explanation,
  };
}

function toDateTime(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toDateOnly(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}
