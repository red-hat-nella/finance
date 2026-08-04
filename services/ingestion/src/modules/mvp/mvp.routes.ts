/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import type { ApplicationEvaluationInput } from "../../domain/applications/application.js";
import {
  applicationEvaluationSchema,
  toFieldValidationErrors,
} from "../../domain/applications/validation.js";
import { documentBlindIndex } from "../../infrastructure/crypto/blind-index.js";
import { encryptField } from "../../infrastructure/crypto/field-crypto.js";
import { inTransaction } from "../../infrastructure/db/transaction.js";
import {
  ScoringClient,
  ScoringClientError,
  type ScoringResponse,
} from "../../infrastructure/scoring/scoring-client.js";
import { buildScoringSnapshot } from "../evaluations/scoring-input.builder.js";
import { finalizeEvaluationFailure } from "../evaluations/evaluation-failure.service.js";

type Input = ApplicationEvaluationInput;

function displayName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? `${words[0]!} ${words.at(-1)![0]}.`
    : (words[0] ?? name);
}
function masked(type: string, number: string): string {
  return `${type} ••••••${number.slice(-4)}`;
}
function dateOnly(value: unknown): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}
function field(value: string, key: Buffer) {
  const v = encryptField(value, key);
  return [v.ciphertext, v.nonce, v.tag];
}
function validationProblem(
  req: any,
  error: Parameters<typeof toFieldValidationErrors>[0],
) {
  return {
    type: "https://errors.example.test/validation",
    title: "Datos inválidos",
    status: 422,
    detail: "Corrija los campos indicados antes de evaluar.",
    code: "VALIDATION_FAILED",
    correlationId: req.requestId,
    retryable: false,
    errors: toFieldValidationErrors(error),
  };
}

export function mvpRoutes(pool: pg.Pool, config: AppConfig): Router {
  const router = Router();
  const scoringClient = new ScoringClient(config.scoring);
  router.post("/applications", async (req, res, next) => {
    try {
      const parsed = applicationEvaluationSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(422)
          .type("application/problem+json")
          .json(validationProblem(req, parsed.error));
        return;
      }
      const input: Input = parsed.data as Input,
        actor = req.actor!,
        now = new Date(),
        expires = new Date(now.getTime() + 90 * 86400000);
      const publicId = randomUUID();
      const result = await inTransaction(pool, async (db) => {
        const blind = documentBlindIndex(
          actor.orgId,
          input.applicant.documentType,
          input.applicant.documentNumber,
          config.pii.hmacKey,
        );
        const doc = field(
            input.applicant.documentNumber,
            config.pii.encryptionKey,
          ),
          name = field(input.applicant.fullName, config.pii.encryptionKey),
          phone = input.applicant.contact.phone
            ? field(input.applicant.contact.phone, config.pii.encryptionKey)
            : [null, null, null],
          email = input.applicant.contact.email
            ? field(input.applicant.contact.email, config.pii.encryptionKey)
            : [null, null, null];
        const applicant = (
          await db.query(
            `INSERT INTO scoring.applicants(org_scope_id,document_type,document_blind_index,document_ciphertext,document_nonce,document_tag,document_masked,full_name_ciphertext,full_name_nonce,full_name_tag,display_name,phone_ciphertext,phone_nonce,phone_tag,email_ciphertext,email_nonce,email_tag,pii_key_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(org_scope_id,document_type,document_blind_index) WHERE deleted_at IS NULL DO UPDATE SET updated_at=now() RETURNING id`,
            [
              actor.orgId,
              input.applicant.documentType,
              blind,
              ...doc,
              masked(
                input.applicant.documentType,
                input.applicant.documentNumber,
              ),
              ...name,
              displayName(input.applicant.fullName),
              ...phone,
              ...email,
              config.pii.keyVersion,
            ],
          )
        ).rows[0];
        const app = (
          await db.query(
            `INSERT INTO scoring.applications(public_id,org_scope_id,owner_actor_id,applicant_id,current_status,draft_expires_at) VALUES($1,$2,$3,$4,'borrador',$5) RETURNING id,created_at,updated_at`,
            [publicId, actor.orgId, actor.actorId, applicant.id, expires],
          )
        ).rows[0];
        const consent = (
          await db.query(
            `INSERT INTO scoring.consents(application_id,status,notice_version,purpose_code,recorded_by_actor_id) VALUES($1,'accepted',$2,$3,$4) RETURNING id,recorded_at`,
            [
              app.id,
              input.consent.noticeVersion,
              input.consent.purposeCode,
              actor.actorId,
            ],
          )
        ).rows[0];
        const revision = (
          await db.query(
            `INSERT INTO scoring.application_revisions(application_id,revision_number,consent_id,status,created_by_actor_id,draft_expires_at) VALUES($1,1,$2,'borrador',$3,$4) RETURNING id`,
            [app.id, consent.id, actor.actorId, expires],
          )
        ).rows[0];
        await db.query(
          `INSERT INTO scoring.revision_identity_snapshots(revision_id,document_type,document_blind_index,document_ciphertext,document_nonce,document_tag,document_masked,full_name_ciphertext,full_name_nonce,full_name_tag,display_name,phone_ciphertext,phone_nonce,phone_tag,email_ciphertext,email_nonce,email_tag,pii_key_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            revision.id,
            input.applicant.documentType,
            blind,
            ...doc,
            masked(
              input.applicant.documentType,
              input.applicant.documentNumber,
            ),
            ...name,
            displayName(input.applicant.fullName),
            ...phone,
            ...email,
            config.pii.keyVersion,
          ],
        );
        const { income, utilities, mobile } = input.alternativeData;
        await db.query(
          `INSERT INTO scoring.alternative_data_sets(revision_id,income_status,income_unavailable_reason,utilities_status,utilities_unavailable_reason,mobile_status,mobile_unavailable_reason) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            revision.id,
            income.availability,
            income.availability === "unavailable" ? income.reason : null,
            utilities.availability,
            utilities.availability === "unavailable" ? utilities.reason : null,
            mobile.availability,
            mobile.availability === "unavailable" ? mobile.reason : null,
          ],
        );
        if (income.availability === "provided")
          await db.query(
            `INSERT INTO scoring.income_details(revision_id,monthly_income_cop,source_type,source_other_description,stability_months) VALUES($1,$2,$3,$4,$5)`,
            [
              revision.id,
              income.monthlyIncomeCop,
              income.sourceType,
              income.sourceOtherDescription ?? null,
              income.stabilityMonths,
            ],
          );
        if (utilities.availability === "provided")
          for (const [index, ref] of utilities.references.entries())
            await db.query(
              `INSERT INTO scoring.utility_references(revision_id,ordinal,service_type,period_start,period_end,observed_months,total_obligations,on_time_count,late_count,missed_count,average_monthly_amount_cop) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [
                revision.id,
                index + 1,
                ref.serviceType,
                ref.periodStart,
                ref.periodEnd,
                ref.observedMonths,
                ref.totalObligations,
                ref.onTimeCount,
                ref.lateCount,
                ref.missedCount,
                ref.averageMonthlyAmountCop,
              ],
            );
        if (mobile.availability === "provided")
          await db.query(
            `INSERT INTO scoring.mobile_details(revision_id,mode,tenure_months,observed_months,regular_months) VALUES($1,$2,$3,$4,$5)`,
            [
              revision.id,
              mobile.mode,
              mobile.tenureMonths,
              mobile.observedMonths,
              mobile.regularMonths,
            ],
          );
        await db.query(
          `UPDATE scoring.applications SET current_revision_id=$2,revision_count=1 WHERE id=$1`,
          [app.id, revision.id],
        );
        await db.query(
          `INSERT INTO scoring.audit_events(org_scope_id,actor_id,actor_roles,event_type,application_id,correlation_id,outcome,metadata) VALUES($1,$2,$3,'APPLICATION_CREATED',$4,$5,'success',$6)`,
          [
            actor.orgId,
            actor.actorId,
            actor.roles,
            app.id,
            req.requestId,
            { revisionNumber: 1 },
          ],
        );
        return { app, consent };
      });
      res
        .status(201)
        .location(`/api/v1/applications/${publicId}`)
        .set("ETag", '"1"')
        .json({
          applicationId: publicId,
          state: "borrador",
          revisionNumber: 1,
          lockVersion: 1,
          createdAt: result.app.created_at,
          updatedAt: result.app.updated_at,
          draftExpiresAt: expires.toISOString(),
          applicant: {
            ...input.applicant,
            documentMasked: masked(
              input.applicant.documentType,
              input.applicant.documentNumber,
            ),
            displayName: displayName(input.applicant.fullName),
          },
          consent: {
            decision: "accepted",
            noticeVersion: input.consent.noticeVersion,
            purposeCode: input.consent.purposeCode,
            recordedAt: result.consent.recorded_at,
          },
          alternativeData: input.alternativeData,
        });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/applications/:applicationId/evaluations",
    async (req, res, next) => {
      try {
        const actor = req.actor!,
          correlationId = req.requestId,
          evaluationId = randomUUID();
        const prepared = await inTransaction(pool, async (db) => {
          const row = (
            await db.query(
              `SELECT a.id,a.public_id,a.current_revision_id,r.revision_number,d.income_status,d.income_unavailable_reason,d.utilities_status,d.utilities_unavailable_reason,d.mobile_status,d.mobile_unavailable_reason,i.monthly_income_cop,i.source_type,i.stability_months,m.mode mobile_mode,m.tenure_months,m.observed_months mobile_observed,m.regular_months,s.document_blind_index,s.document_masked,s.display_name FROM scoring.applications a JOIN scoring.application_revisions r ON r.id=a.current_revision_id JOIN scoring.alternative_data_sets d ON d.revision_id=r.id LEFT JOIN scoring.income_details i ON i.revision_id=r.id LEFT JOIN scoring.mobile_details m ON m.revision_id=r.id JOIN scoring.revision_identity_snapshots s ON s.revision_id=r.id WHERE a.public_id=$1 AND a.org_scope_id=$2 AND a.owner_actor_id=$3 AND a.current_status='borrador' FOR UPDATE OF a,r,d,s`,
              [req.params.applicationId, actor.orgId, actor.actorId],
            )
          ).rows[0];
          if (!row)
            throw Object.assign(new Error("not found"), { status: 404 });
          const refs = (
            await db.query(
              `SELECT service_type,period_start,period_end,observed_months,total_obligations,on_time_count,late_count,missed_count,average_monthly_amount_cop FROM scoring.utility_references WHERE revision_id=$1 ORDER BY ordinal`,
              [row.current_revision_id],
            )
          ).rows;
          const scoringSnapshot = buildScoringSnapshot({
            income:
              row.income_status === "provided"
                ? {
                    availability: "provided",
                    monthlyIncomeCop: String(row.monthly_income_cop),
                    sourceType: row.source_type,
                    stabilityMonths: row.stability_months,
                  }
                : {
                    availability: "unavailable",
                    reason: row.income_unavailable_reason,
                  },
            utilities:
              row.utilities_status === "provided"
                ? {
                    availability: "provided",
                    references: refs.map((v: any) => ({
                      serviceType: v.service_type,
                      periodStart: dateOnly(v.period_start),
                      periodEnd: dateOnly(v.period_end),
                      observedMonths: v.observed_months,
                      totalObligations: v.total_obligations,
                      onTimeCount: v.on_time_count,
                      lateCount: v.late_count,
                      missedCount: v.missed_count,
                      averageMonthlyAmountCop: String(
                        v.average_monthly_amount_cop,
                      ),
                    })),
                  }
                : {
                    availability: "unavailable",
                    reason: row.utilities_unavailable_reason,
                  },
            mobile:
              row.mobile_status === "provided"
                ? {
                    availability: "provided",
                    mode: row.mobile_mode,
                    tenureMonths: row.tenure_months,
                    observedMonths: row.mobile_observed,
                    regularMonths: row.regular_months,
                  }
                : {
                    availability: "unavailable",
                    reason: row.mobile_unavailable_reason,
                  },
          });
          const normalized = scoringSnapshot.normalizedInput;
          const hash = scoringSnapshot.inputHashBuffer;
          const evaluation = (
            await db.query(
              `INSERT INTO scoring.evaluations(public_id,revision_id,attempt_number,org_scope_id,owner_actor_id,initiated_by_actor_id,document_blind_index,document_masked,applicant_display_name,status,criteria_version,input_hash,correlation_id) VALUES($1,$2,1,$3,$4,$4,$5,$6,$7,'evaluando',$8,$9,$10) RETURNING id,started_at`,
              [
                evaluationId,
                row.current_revision_id,
                actor.orgId,
                actor.actorId,
                row.document_blind_index,
                row.document_masked,
                row.display_name,
                config.scoring.criteriaVersion,
                hash,
                correlationId,
              ],
            )
          ).rows[0];
          await db.query(
            `INSERT INTO scoring.evaluation_input_snapshots(evaluation_id,schema_version,normalized_input,input_hash) VALUES($1,'1.0.0',$2,$3)`,
            [evaluation.id, normalized, hash],
          );
          await db.query(
            `UPDATE scoring.application_revisions SET status='evaluando',locked_at=now(),input_hash=$2 WHERE id=$1`,
            [row.current_revision_id, hash],
          );
          await db.query(
            `UPDATE scoring.applications SET current_status='evaluando',draft_expires_at=NULL,current_evaluation_id=$2 WHERE id=$1`,
            [row.id, evaluation.id],
          );
          return {
            ...row,
            evaluation,
            normalized,
            hash: scoringSnapshot.inputHash,
          };
        });
        let score: ScoringResponse;
        try {
          ({ response: score } = await scoringClient.calculate({
            evaluationId,
            criteriaVersion: config.scoring.criteriaVersion,
            inputSchemaVersion: "1.0.0",
            inputHash: prepared.hash,
            normalizedInput: prepared.normalized,
            requestId: correlationId,
          }));
        } catch (error) {
          const errorCode =
            error instanceof ScoringClientError
              ? error.code
              : "SCORING_UNAVAILABLE";
          await finalizeEvaluationFailure(pool, {
            evaluationId: prepared.evaluation.id,
            revisionId: prepared.current_revision_id,
            applicationId: prepared.id,
            errorCode,
            correlationId,
            actorId: actor.actorId,
            actorRoles: actor.roles,
            orgId: actor.orgId,
          });
          const status =
            error instanceof ScoringClientError ? error.status : 502;
          res
            .status(status)
            .type("application/problem+json")
            .json({
              type: "https://errors.example.test/scoring-unavailable",
              title: "Evaluación no disponible",
              status,
              detail:
                "El motor de evaluación no respondió. Puede reintentar sin volver a ingresar los datos.",
              code:
                error instanceof ScoringClientError
                  ? errorCode
                  : "SCORING_UNAVAILABLE",
              correlationId: req.requestId,
              retryable: true,
              errors: [],
            });
          return;
        }
        const completed = new Date();
        await inTransaction(pool, async (db) => {
          await db.query(
            `UPDATE scoring.evaluations SET status=$2,score=$3,risk_band=$4,recommendation_code=$5,recommendation_text=$6,manual_review_reasons=$7,completed_at=$8::timestamptz,retention_until=$8::timestamptz+interval '5 years' WHERE id=$1`,
            [
              prepared.evaluation.id,
              score.status,
              score.score,
              score.riskBand,
              score.recommendation.code,
              score.recommendation.text,
              JSON.stringify(score.manualReviewReasons),
              completed,
            ],
          );
          for (const factor of score.factors)
            await db.query(
              `INSERT INTO scoring.evaluation_factors(evaluation_id,ordinal,dimension,rule_code,direction,contribution_points,explanation) VALUES($1,$2,$3,$4,$5,$6,$7)`,
              [
                prepared.evaluation.id,
                factor.rank,
                factor.dimension,
                factor.ruleCode,
                factor.direction,
                factor.contributionPoints,
                factor.explanation,
              ],
            );
          await db.query(
            `UPDATE scoring.application_revisions SET status=$2 WHERE id=$1`,
            [prepared.current_revision_id, score.status],
          );
          await db.query(
            `UPDATE scoring.applications SET current_status=$2 WHERE id=$1`,
            [prepared.id, score.status],
          );
        });
        res
          .status(201)
          .location(`/api/v1/evaluations/${evaluationId}`)
          .json({
            evaluationId,
            applicationId: prepared.public_id,
            revisionNumber: prepared.revision_number,
            attemptNumber: 1,
            state: score.status,
            score: score.score,
            scoreScale: { minimum: 300, maximum: 850 },
            riskBand: score.riskBand,
            recommendation: score.recommendation,
            factors: score.factors,
            manualReviewReasons: score.manualReviewReasons,
            criteriaVersion: score.criteriaVersion,
            inputHash: prepared.hash,
            startedAt: prepared.evaluation.started_at,
            completedAt: completed.toISOString(),
            timezone: "America/Bogota",
            applicantSummary: {
              documentMasked: prepared.document_masked,
              displayName: prepared.display_name,
            },
            relatedAttempts: [],
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/evaluations/:evaluationId", async (req, res, next) => {
    try {
      const actor = req.actor!;
      const row = (
        await pool.query(
          `SELECT e.*,a.public_id application_public_id,r.revision_number FROM scoring.evaluations e LEFT JOIN scoring.application_revisions r ON r.id=e.revision_id LEFT JOIN scoring.applications a ON a.id=r.application_id WHERE e.public_id=$1 AND e.org_scope_id=$2 AND (e.owner_actor_id=$3 OR $4)`,
          [
            req.params.evaluationId,
            actor.orgId,
            actor.actorId,
            actor.roles.includes("supervisor") ||
              actor.roles.includes("auditor"),
          ],
        )
      ).rows[0];
      if (!row) {
        res.status(404).type("application/problem+json").json({
          type: "https://errors.example.test/not-found",
          title: "Evaluación no encontrada",
          status: 404,
          detail:
            "No se encontró una evaluación accesible con ese identificador.",
          code: "EVALUATION_NOT_FOUND",
          requestId: req.requestId,
        });
        return;
      }
      const factors = (
        await pool.query(
          `SELECT ordinal rank,dimension,direction,rule_code "ruleCode",to_char(contribution_points,'FM999990.000') "contributionPoints",explanation FROM scoring.evaluation_factors WHERE evaluation_id=$1 ORDER BY ordinal`,
          [row.id],
        )
      ).rows.map((v: any) => ({
        ...v,
        dimensionIndex: "0.000",
        weight: v.dimension === "utility" ? "0.400" : "0.300",
        observedSummary: v.explanation,
      }));
      res.json({
        evaluationId: row.public_id,
        applicationId: row.application_public_id,
        revisionNumber: row.revision_number,
        attemptNumber: row.attempt_number,
        state: row.status,
        score: row.score,
        scoreScale: { minimum: 300, maximum: 850 },
        riskBand: row.risk_band,
        recommendation: row.recommendation_code
          ? { code: row.recommendation_code, text: row.recommendation_text }
          : null,
        factors,
        manualReviewReasons: row.manual_review_reasons,
        criteriaVersion: row.criteria_version,
        inputHash: `sha256:${Buffer.from(row.input_hash).toString("hex")}`,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        timezone: "America/Bogota",
        applicantSummary: {
          documentMasked: row.document_masked,
          displayName: row.applicant_display_name,
        },
        relatedAttempts: [],
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/evaluations/search", async (req, res, next) => {
    try {
      const actor = req.actor!,
        states =
          Array.isArray(req.body?.states) && req.body.states.length
            ? req.body.states
            : ["evaluada", "revision_manual", "error"];
      const values: any[] = [actor.orgId, states];
      let scope = "";
      if (actor.roles.includes("credit_analyst")) {
        values.push(actor.actorId);
        scope = ` AND owner_actor_id=$${values.length}`;
      }
      if (req.body?.evaluationId) {
        values.push(req.body.evaluationId);
        scope += ` AND public_id=$${values.length}`;
      }
      const rows = (
        await pool.query(
          `SELECT public_id,completed_at,document_masked,applicant_display_name,score,risk_band,status FROM scoring.evaluations WHERE org_scope_id=$1 AND status=ANY($2)${scope} ORDER BY completed_at DESC,id DESC LIMIT 25`,
          values,
        )
      ).rows;
      res.json({
        items: rows.map((row: any) => ({
          evaluationId: row.public_id,
          completedAt: row.completed_at,
          timezone: "America/Bogota",
          documentMasked: row.document_masked,
          applicantDisplayName: row.applicant_display_name,
          displayName: row.applicant_display_name,
          score: row.score,
          riskBand: row.risk_band,
          state: row.status,
        })),
        pageSize: 25,
        nextCursor: null,
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
