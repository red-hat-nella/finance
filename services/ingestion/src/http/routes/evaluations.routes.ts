import { Router } from "express";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import {
  evaluateApplicationController,
  getEvaluationController,
  retryEvaluationController,
} from "../../modules/evaluations/evaluation.controller.js";
import { EvaluateApplicationService } from "../../modules/evaluations/evaluate-application.service.js";
import { EvaluationRepository } from "../../modules/evaluations/evaluation.repository.js";
import { PostgresAuditWriter } from "../../modules/audit/audit-writer.js";
import { RetryEvaluationService } from "../../modules/evaluations/retry-evaluation.service.js";
import {
  EvaluationDetailRepository,
  GetEvaluationDetailService,
} from "../../modules/history/get-evaluation-detail.service.js";

export function evaluationRoutes(pool: pg.Pool, config: AppConfig): Router {
  const router = Router();
  const service = new GetEvaluationDetailService(
    new EvaluationDetailRepository(pool),
    new PostgresAuditWriter(pool),
    config,
  );
  const evaluationService = new EvaluateApplicationService(
    pool,
    new EvaluationRepository(pool),
    new PostgresAuditWriter(pool),
    config,
  );
  const retryService = new RetryEvaluationService(
    pool,
    new EvaluationRepository(pool),
    new PostgresAuditWriter(pool),
    config,
  );
  router.post(
    "/applications/:applicationId/evaluations",
    evaluateApplicationController(evaluationService),
  );
  router.get("/evaluations/:evaluationId", getEvaluationController(service));
  router.post(
    "/evaluations/:evaluationId/retry",
    retryEvaluationController(retryService),
  );
  return router;
}
