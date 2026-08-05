import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
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
  evaluationRetriedEvent,
} from "./evaluation-events.js";
import { finalizeEvaluationFailure } from "./evaluation-failure.service.js";
import {
  type EvaluationRepository,
  type RetryPreparation,
  type StartedEvaluation,
} from "./evaluation.repository.js";
import {
  EvaluateApplicationError,
  type EvaluationResult,
} from "./evaluate-application.service.js";

interface Prepared {
  readonly source: RetryPreparation;
  readonly evaluation: StartedEvaluation;
  readonly replay?: EvaluationResult;
}

export class RetryEvaluationService {
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
    failedEvaluationPublicId: string,
    idempotencyKey: string,
    actor: ActorContext,
    correlationId: string,
  ): Promise<EvaluationResult> {
    const requestHash = canonicalHash({ failedEvaluationPublicId });
    const retryPublicId = randomUUID();
    const prepared = await inTransaction(this.pool, async (db): Promise<Prepared> => {
      const prior = await this.applicationRepository.acquireIdempotency(
        db,
        actor,
        "retryEvaluation",
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
          const rawEvaluationId = body["evaluationId"];
          const evaluationId =
            typeof rawEvaluationId === "string" ? rawEvaluationId : "";
          return {
            source: {} as RetryPreparation,
            evaluation: {} as StartedEvaluation,
            replay: {
              status: 201,
              body,
              location: `/api/v1/evaluations/${evaluationId}`,
              replayed: true,
            },
          };
        }
        throw new EvaluateApplicationError(
          409,
          "IDEMPOTENCY_IN_PROGRESS",
          "El reintento con esta clave todavía está en proceso.",
          true,
        );
      }
      const source = await this.evaluationRepository.lockFailedEvaluation(
        db,
        failedEvaluationPublicId,
        actor,
      );
      if (!source)
        throw new EvaluateApplicationError(
          404,
          "EVALUATION_NOT_AVAILABLE",
          "No fue posible reintentar la evaluación solicitada.",
        );
      const evaluation = await this.evaluationRepository.startRetry(
        db,
        source,
        actor,
        retryPublicId,
        correlationId,
      );
      await this.auditWriter.write(
        evaluationRetriedEvent(
          {
            actor,
            applicationId: source.draft.applicationId,
            evaluationId: evaluation.id,
            correlationId,
            revisionNumber: source.draft.revisionNumber,
            attemptNumber: evaluation.attemptNumber,
            criteriaVersion: this.config.scoring.criteriaVersion,
          },
          source.failedEvaluationPublicId,
        ),
        db,
      );
      return { source, evaluation };
    });
    if (prepared.replay) return prepared.replay;

    let score: ScoringResponse;
    let checksum: string;
    try {
      const result = await this.scoringClient.calculate({
        evaluationId: prepared.evaluation.publicId,
        criteriaVersion: this.config.scoring.criteriaVersion,
        inputSchemaVersion: prepared.source.snapshot.inputSchemaVersion,
        inputHash: prepared.source.snapshot.inputHash,
        normalizedInput: prepared.source.snapshot.normalizedInput,
        requestId: correlationId,
      });
      score = result.response;
      checksum = result.criteriaChecksum;
    } catch (error) {
      const known =
        error instanceof ScoringClientError
          ? error
          : new ScoringClientError("SCORING_UNAVAILABLE", 502);
      await this.fail(prepared, known.code, actor, correlationId);
      throw new EvaluateApplicationError(
        known.status,
        known.code,
        "No fue posible calcular el score. Intente nuevamente.",
        true,
        [],
        prepared.evaluation.publicId,
      );
    }
    if (checksum !== prepared.source.draft.criteriaChecksum) {
      await this.fail(prepared, "SCORING_RESPONSE_INVALID", actor, correlationId);
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
    const relatedAttempts = await this.evaluationRepository.relatedAttempts(
      prepared.source.draft.revisionId,
      prepared.evaluation.id,
    );
    const body: Record<string, unknown> = {
      evaluationId: prepared.evaluation.publicId,
      applicationId: prepared.source.draft.applicationPublicId,
      revisionNumber: prepared.source.draft.revisionNumber,
      attemptNumber: prepared.evaluation.attemptNumber,
      retryOfEvaluationId: prepared.source.failedEvaluationPublicId,
      state: score.status,
      score: score.score,
      scoreScale: { minimum: 300, maximum: 850 },
      riskBand: score.riskBand,
      recommendation: score.recommendation,
      factors: score.factors,
      manualReviewReasons: score.manualReviewReasons,
      criteriaVersion: score.criteriaVersion,
      inputHash: prepared.source.snapshot.inputHash,
      startedAt: prepared.evaluation.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      timezone: "America/Bogota",
      applicantSummary: {
        documentMasked: prepared.source.draft.documentMasked,
        displayName: prepared.source.draft.displayName,
      },
      relatedAttempts: relatedAttempts.map((attempt) => ({
        evaluationId: attempt.public_id,
        attemptNumber: attempt.attempt_number,
        state: attempt.status,
        startedAt: attempt.started_at.toISOString(),
        completedAt: attempt.completed_at?.toISOString() ?? null,
        errorCode: attempt.error_code,
      })),
    };
    await inTransaction(this.pool, async (db) => {
      await this.evaluationRepository.complete(
        db,
        prepared.source.draft,
        prepared.evaluation,
        score,
        completedAt,
      );
      await this.auditWriter.write(
        evaluationCompletedEvent(
          {
            actor,
            applicationId: prepared.source.draft.applicationId,
            evaluationId: prepared.evaluation.id,
            correlationId,
            revisionNumber: prepared.source.draft.revisionNumber,
            attemptNumber: prepared.evaluation.attemptNumber,
            criteriaVersion: score.criteriaVersion,
          },
          { state: score.status, riskBand: score.riskBand },
        ),
        db,
      );
      await this.applicationRepository.completeIdempotency(
        db,
        actor,
        "retryEvaluation",
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

  private async fail(
    prepared: Prepared,
    errorCode: string,
    actor: ActorContext,
    correlationId: string,
  ): Promise<void> {
    await finalizeEvaluationFailure(this.pool, {
      evaluationId: prepared.evaluation.id,
      revisionId: prepared.source.draft.revisionId,
      applicationId: prepared.source.draft.applicationId,
      errorCode,
      correlationId,
      actorId: actor.actorId,
      actorRoles: actor.roles,
      orgId: actor.orgId,
    });
  }
}
