import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type pg from "pg";
import type { AppConfig } from "../../src/config/schema.js";
import type { ActorContext } from "../../src/domain/authorization/policies.js";
import type {
  ScoreCommand,
  ScoringClient,
  ScoringResponse,
} from "../../src/infrastructure/scoring/scoring-client.js";
import { ApplicationRepository } from "../../src/modules/applications/application.repository.js";
import { ApplicationService } from "../../src/modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../src/modules/audit/audit-writer.js";
import { EvaluateApplicationService } from "../../src/modules/evaluations/evaluate-application.service.js";
import { EvaluationRepository } from "../../src/modules/evaluations/evaluation.repository.js";

const checksum = "b1e1f281dbe194430c53cd18ce85400ee217999a92e83a27ace2d1101c4e8eff";

export async function createAuditedEvaluation(
  pool: pg.Pool,
  config: AppConfig,
  actor: ActorContext,
): Promise<{ applicationId: string; evaluationId: string }> {
  const input = JSON.parse(
    readFileSync("../../tests/fixtures/low-risk-application.json", "utf8"),
  ) as Record<string, unknown>;
  (input["applicant"] as Record<string, unknown>)["documentNumber"] =
    `4${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 10).toString()}`;
  const applications = new ApplicationService(
    pool,
    new ApplicationRepository(pool, config),
    new PostgresAuditWriter(pool),
  );
  const application = await applications.create(
    input,
    actor,
    randomUUID(),
    randomUUID(),
  );
  const scoringClient = {
    calculate: (command: ScoreCommand) =>
      Promise.resolve({
        response: response(command),
        criteriaChecksum: checksum,
      }),
  } as unknown as ScoringClient;
  const evaluator = new EvaluateApplicationService(
    pool,
    new EvaluationRepository(pool),
    new PostgresAuditWriter(pool),
    config,
    scoringClient,
  );
  const evaluated = await evaluator.execute(
    application.body.applicationId,
    { revisionNumber: 1, expectedCriteriaVersion: "SCORING-MVP-1.0.0" },
    application.etag,
    randomUUID(),
    actor,
    randomUUID(),
  );
  return {
    applicationId: application.body.applicationId,
    evaluationId: String(evaluated.body["evaluationId"]),
  };
}

function response(command: ScoreCommand): ScoringResponse {
  return {
    resultType: "scored",
    evaluationId: command.evaluationId,
    status: "evaluada",
    score: 835,
    scoreScale: { minimum: 300, maximum: 850 },
    riskBand: "riesgo_bajo",
    recommendation: {
      code: "CONTINUE_HUMAN_ANALYSIS",
      text: "Continuar con el análisis crediticio humano.",
    },
    factors: (["utility", "mobile", "income"] as const).map(
      (dimension, index) => ({
        rank: index + 1,
        dimension,
        direction: "favorable",
        dimensionIndex: "90.000",
        weight: dimension === "utility" ? "0.400" : "0.300",
        contributionPoints: dimension === "utility" ? "198.000" : "148.500",
        observedSummary: `Resumen agregado de ${dimension}.`,
        ruleCode: `${dimension.toUpperCase()}_AUDIT_TEST`,
        explanation: `La dimensión ${dimension} explica su aporte.`,
      }),
    ),
    manualReviewReasons: [],
    criteriaVersion: "SCORING-MVP-1.0.0",
    inputHash: command.inputHash,
    calculatedAt: new Date().toISOString(),
  };
}
