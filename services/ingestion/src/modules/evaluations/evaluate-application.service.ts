import { randomUUID } from "node:crypto";
import type pg from "pg";
import { z } from "zod";
import type { AppConfig } from "../../config/schema.js";
import type { AlternativeDataInput } from "../../domain/applications/application.js";
import type { ActorContext } from "../../domain/authorization/policies.js";
import { canonicalHash } from "../../infrastructure/crypto/canonical-hash.js";
import { inTransaction } from "../../infrastructure/db/transaction.js";
import {
  ScoringClient,
  ScoringClientError,
  type ScoringResponse,
} from "../../infrastructure/scoring/scoring-client.js";
import { ApplicationRepository } from "../applications/application.repository.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import {
  evaluationCompletedEvent,
  evaluationStartedEvent,
} from "./evaluation-events.js";
import { finalizeEvaluationFailure } from "./evaluation-failure.service.js";
import type {
  EvaluationRepository,
  EvaluationDraft,
  StartedEvaluation,
} from "./evaluation.repository.js";
import { buildScoringSnapshot, type ScoringSnapshot } from "./scoring-input.builder.js";

const requestSchema = z
  .object({
    revisionNumber: z.number().int().min(1),
    expectedCriteriaVersion: z.literal("SCORING-MVP-1.0.0"),
  })
  .strict();

export interface EvaluationResult {
  readonly status: 201;
  readonly body: Record<string, unknown>;
  readonly location: string;
  readonly replayed: boolean;
}

export class EvaluateApplicationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly retryable = false,
    readonly errors: readonly unknown[] = [],
    readonly evaluationId?: string,
  ) {
    super(detail);
    this.name = "EvaluateApplicationError";
  }
}

interface Prepared {
  draft: EvaluationDraft;
  evaluation: StartedEvaluation;
  snapshot: ScoringSnapshot;
  replay?: EvaluationResult;
}

function parseEtag(value: string): number {
  const match = /^"([1-9][0-9]*)"$/.exec(value.trim());
  if (!match?.[1])
    throw new EvaluateApplicationError(
      412,
      "REVISION_CONFLICT",
      "Recargue la solicitud antes de evaluar.",
      true,
    );
  return Number(match[1]);
}

function completeAlternatives(
  value: AlternativeDataInput,
): value is Required<AlternativeDataInput> {
  return Boolean(value.income && value.utilities && value.mobile);
}

export class EvaluateApplicationService {
  private readonly scoringClient: ScoringClient;
  private readonly applicationRepository: ApplicationRepository;

  constructor(
    private readonly pool: pg.Pool,
    private readonly evaluationRepository: EvaluationRepository,
    private readonly auditWriter: AuditWriter,
    private readonly config: AppConfig,
    scoringClient?: ScoringClient,
  ) {
    this.scoringClient = scoringClient ?? new ScoringClient(config.scoring);
    this.applicationRepository = new ApplicationRepository(pool, config);
  }

  async execute(
    applicationId: string,
    rawInput: unknown,
    ifMatch: string,
    idempotencyKey: string,
    actor: ActorContext,
    correlationId: string,
  ): Promise<EvaluationResult> {
    const parsed = requestSchema.safeParse(rawInput);
    if (!parsed.success)
      throw new EvaluateApplicationError(
        422,
        "EVALUATION_VALIDATION_FAILED",
        "Corrija la versión y revisión solicitadas antes de evaluar.",
      );
    const expectedLockVersion = parseEtag(ifMatch);
    const requestHash = canonicalHash({ applicationId, ...parsed.data });
    const evaluationPublicId = randomUUID();

    const prepared = await inTransaction(this.pool, async (db): Promise<Prepared> => {
      const prior = await this.applicationRepository.acquireIdempotency(
        db,
        actor,
        "evaluateApplication",
        idempotencyKey,
        requestHash,
      );
      if (prior) {
        if (!prior.requestHash.equals(requestHash))
          throw new EvaluateApplicationError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "La clave de idempotencia ya fue usada con datos diferentes.",
          );
        if (prior.state === "completed" && prior.responseBody) {
          const body = prior.responseBody as Record<string, unknown>;
          const rawId = body["evaluationId"];
          const id = typeof rawId === "string" ? rawId : "";
          return {
            replay: {
              status: 201,
              body,
              location: `/api/v1/evaluations/${id}`,
              replayed: true,
            },
          } as Prepared;
        }
        throw new EvaluateApplicationError(
          409,
          "IDEMPOTENCY_IN_PROGRESS",
          "La evaluación con esta clave todavía está en proceso.",
          true,
        );
      }

      const draft = await this.evaluationRepository.lockApplicationDraft(
        db,
        applicationId,
        actor,
      );
      if (!draft)
        throw new EvaluateApplicationError(
          404,
          "APPLICATION_NOT_AVAILABLE",
          "No fue posible abrir la solicitud solicitada.",
        );
      if (
        draft.applicationStatus !== "borrador" ||
        draft.revisionNumber !== parsed.data.revisionNumber ||
        draft.lockVersion !== expectedLockVersion
      )
        throw new EvaluateApplicationError(
          412,
          "REVISION_CONFLICT",
          "El borrador cambió. Recárguelo antes de evaluar.",
          true,
        );
      if (draft.consentStatus !== "accepted")
        throw new EvaluateApplicationError(
          422,
          "CONSENT_REQUIRED",
          "Se requiere consentimiento registrado para evaluar.",
          false,
          [
            {
              path: "consent.decision",
              code: "VAL-004",
              message: "Se requiere consentimiento registrado para evaluar.",
            },
          ],
        );
      if (!completeAlternatives(draft.alternativeData))
        throw new EvaluateApplicationError(
          422,
          "EVALUATION_VALIDATION_FAILED",
          "Complete o marque como no disponible cada dimensión antes de evaluar.",
        );
      const snapshot = buildScoringSnapshot(draft.alternativeData);
      const evaluation = await this.evaluationRepository.start(
        db,
        draft,
        actor,
        evaluationPublicId,
        correlationId,
        snapshot,
      );
      await this.auditWriter.write(
        evaluationStartedEvent({
          actor,
          applicationId: draft.applicationId,
          evaluationId: evaluation.id,
          correlationId,
          revisionNumber: draft.revisionNumber,
          attemptNumber: evaluation.attemptNumber,
          criteriaVersion: this.config.scoring.criteriaVersion,
        }),
        db,
      );
      return { draft, evaluation, snapshot };
    });
    if (prepared.replay) return prepared.replay;

    let score: ScoringResponse;
    let checksum: string;
    try {
      const result = await this.scoringClient.calculate({
        evaluationId: prepared.evaluation.publicId,
        criteriaVersion: this.config.scoring.criteriaVersion,
        inputSchemaVersion: prepared.snapshot.inputSchemaVersion,
        inputHash: prepared.snapshot.inputHash,
        normalizedInput: prepared.snapshot.normalizedInput,
        requestId: correlationId,
      });
      score = result.response;
      checksum = result.criteriaChecksum;
    } catch (error) {
      const known =
        error instanceof ScoringClientError
          ? error
          : new ScoringClientError("SCORING_UNAVAILABLE", 502);
      await finalizeEvaluationFailure(this.pool, {
        evaluationId: prepared.evaluation.id,
        revisionId: prepared.draft.revisionId,
        applicationId: prepared.draft.applicationId,
        errorCode: known.code,
        correlationId,
        actorId: actor.actorId,
        actorRoles: actor.roles,
        orgId: actor.orgId,
      });
      throw new EvaluateApplicationError(
        known.status,
        known.code,
        "No fue posible calcular el score. Intente nuevamente.",
        true,
        [],
        prepared.evaluation.publicId,
      );
    }
    if (checksum !== prepared.draft.criteriaChecksum) {
      await finalizeEvaluationFailure(this.pool, {
        evaluationId: prepared.evaluation.id,
        revisionId: prepared.draft.revisionId,
        applicationId: prepared.draft.applicationId,
        errorCode: "SCORING_RESPONSE_INVALID",
        correlationId,
        actorId: actor.actorId,
        actorRoles: actor.roles,
        orgId: actor.orgId,
      });
      throw new EvaluateApplicationError(
        502,
        "SCORING_RESPONSE_INVALID",
        "No fue posible validar el resultado. Intente nuevamente.",
        true,
        [],
        prepared.evaluation.publicId,
      );
    }

    const completedAt = new Date(score.calculatedAt);
    const body = this.responseBody(prepared, score, completedAt);
    await inTransaction(this.pool, async (db) => {
      await this.evaluationRepository.complete(
        db,
        prepared.draft,
        prepared.evaluation,
        score,
        completedAt,
      );
      await this.auditWriter.write(
        evaluationCompletedEvent(
          {
            actor,
            applicationId: prepared.draft.applicationId,
            evaluationId: prepared.evaluation.id,
            correlationId,
            revisionNumber: prepared.draft.revisionNumber,
            attemptNumber: prepared.evaluation.attemptNumber,
            criteriaVersion: score.criteriaVersion,
          },
          {
            state: score.status,
            riskBand: score.riskBand,
          },
        ),
        db,
      );
      await this.applicationRepository.completeIdempotency(
        db,
        actor,
        "evaluateApplication",
        idempotencyKey,
        201,
        { Location: `/api/v1/evaluations/${prepared.evaluation.publicId}` },
        body,
        prepared.evaluation.id,
      );
    });
    return {
      status: 201,
      body,
      location: `/api/v1/evaluations/${prepared.evaluation.publicId}`,
      replayed: false,
    };
  }

  private responseBody(
    prepared: Prepared,
    score: ScoringResponse,
    completedAt: Date,
  ): Record<string, unknown> {
    return {
      evaluationId: prepared.evaluation.publicId,
      applicationId: prepared.draft.applicationPublicId,
      revisionNumber: prepared.draft.revisionNumber,
      attemptNumber: prepared.evaluation.attemptNumber,
      state: score.status,
      score: score.score,
      scoreScale: { minimum: 300, maximum: 850 },
      riskBand: score.riskBand,
      recommendation: score.recommendation,
      factors: score.factors,
      manualReviewReasons: score.manualReviewReasons,
      criteriaVersion: score.criteriaVersion,
      inputHash: prepared.snapshot.inputHash,
      startedAt: prepared.evaluation.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      timezone: "America/Bogota",
      applicantSummary: {
        documentMasked: prepared.draft.documentMasked,
        displayName: prepared.draft.displayName,
      },
      relatedAttempts: [],
    };
  }
}
