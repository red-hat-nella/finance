import { z } from "zod";
import type { AppConfig } from "../../config/schema.js";
import type { NormalizedScoringInput } from "../../modules/evaluations/scoring-input.builder.js";
import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";

const recommendationSchema = z
  .object({
    code: z.enum([
      "CONTINUE_HUMAN_ANALYSIS",
      "MANUAL_REVIEW_REQUIRED",
      "DO_NOT_CONTINUE_WITHOUT_DOCUMENTED_HUMAN_DECISION",
    ]),
    text: z.string().min(1).max(240),
  })
  .strict();

const factorSchema = z
  .object({
    rank: z.number().int().min(1).max(3),
    dimension: z.enum(["utility", "mobile", "income"]),
    direction: z.enum(["favorable", "unfavorable", "neutral"]),
    dimensionIndex: z.string().regex(/^[0-9]{1,3}\.[0-9]{3}$/),
    weight: z.string().regex(/^0\.[0-9]{3}$/),
    contributionPoints: z.string().regex(/^[0-9]{1,3}\.[0-9]{3}$/),
    observedSummary: z.string().min(1).max(240),
    ruleCode: z.string().min(1).max(64),
    explanation: z.string().min(1).max(320),
  })
  .strict();

const manualReasonSchema = z
  .object({
    code: z.string().min(1).max(64),
    dimension: z.enum(["utility", "mobile", "income", "explanation"]),
    message: z.string().min(1).max(240),
  })
  .strict();

const commonResponse = {
  evaluationId: z.uuid(),
  scoreScale: z
    .object({ minimum: z.literal(300), maximum: z.literal(850) })
    .strict(),
  recommendation: recommendationSchema,
  manualReviewReasons: z.array(manualReasonSchema),
  criteriaVersion: z.literal("SCORING-MVP-1.0.0"),
  inputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  calculatedAt: z.iso.datetime({ offset: true }),
};

const scoringResponseSchema = z.discriminatedUnion("resultType", [
  z
    .object({
      resultType: z.literal("scored"),
      ...commonResponse,
      status: z.enum(["evaluada", "revision_manual"]),
      score: z.number().int().min(300).max(850),
      riskBand: z.enum(["riesgo_bajo", "riesgo_medio", "riesgo_alto"]),
      factors: z.array(factorSchema).length(3),
    })
    .strict(),
  z
    .object({
      resultType: z.literal("manual_review"),
      ...commonResponse,
      status: z.literal("revision_manual"),
      score: z.null(),
      riskBand: z.null(),
      factors: z.array(z.never()).length(0),
    })
    .strict(),
]);

export type ScoringResponse = z.infer<typeof scoringResponseSchema>;

export interface ScoreCommand {
  readonly evaluationId: string;
  readonly criteriaVersion: "SCORING-MVP-1.0.0";
  readonly inputSchemaVersion: "1.0.0";
  readonly inputHash: string;
  readonly normalizedInput: NormalizedScoringInput;
  readonly requestId: string;
}

export interface ScoringResult {
  readonly response: ScoringResponse;
  readonly criteriaChecksum: string;
}

export class ScoringClientError extends Error {
  constructor(
    readonly code:
      "SCORING_TIMEOUT" | "SCORING_UNAVAILABLE" | "SCORING_RESPONSE_INVALID",
    readonly status: 502 | 504,
  ) {
    super(code);
    this.name = "ScoringClientError";
  }
}

export class ScoringClient {
  constructor(
    private readonly config: AppConfig["scoring"],
    private readonly circuitBreaker = new CircuitBreaker(),
  ) {}

  async calculate(command: ScoreCommand): Promise<ScoringResult> {
    try {
      return await this.circuitBreaker.execute(() =>
        this.calculateWithoutRetry(command),
      );
    } catch (error) {
      if (error instanceof CircuitOpenError)
        throw new ScoringClientError("SCORING_UNAVAILABLE", 502);
      throw error;
    }
  }

  private async calculateWithoutRetry(
    command: ScoreCommand,
  ): Promise<ScoringResult> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/internal/v1/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scoring-Service-Token": this.config.token,
          "X-Request-Id": command.requestId,
          "X-Evaluation-Id": command.evaluationId,
        },
        body: JSON.stringify({
          evaluationId: command.evaluationId,
          criteriaVersion: command.criteriaVersion,
          inputSchemaVersion: command.inputSchemaVersion,
          inputHash: command.inputHash,
          ...command.normalizedInput,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new ScoringClientError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "SCORING_TIMEOUT"
          : "SCORING_UNAVAILABLE",
        error instanceof DOMException && error.name === "TimeoutError"
          ? 504
          : 502,
      );
    }
    if (!response.ok) throw new ScoringClientError("SCORING_UNAVAILABLE", 502);

    const evaluationId = response.headers.get("X-Evaluation-Id");
    const criteriaChecksum = response.headers.get("X-Criteria-Checksum") ?? "";
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new ScoringClientError("SCORING_RESPONSE_INVALID", 502);
    }
    const parsed = scoringResponseSchema.safeParse(raw);
    if (
      !parsed.success ||
      evaluationId !== command.evaluationId ||
      parsed.data.evaluationId !== command.evaluationId ||
      parsed.data.inputHash !== command.inputHash ||
      !/^[a-f0-9]{64}$/.test(criteriaChecksum)
    )
      throw new ScoringClientError("SCORING_RESPONSE_INVALID", 502);

    return { response: parsed.data, criteriaChecksum };
  }
}
