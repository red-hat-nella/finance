import { Router } from "express";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import { getEvaluationController } from "../../modules/evaluations/evaluation.controller.js";
import { PostgresAuditWriter } from "../../modules/audit/audit-writer.js";
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
  router.get("/evaluations/:evaluationId", getEvaluationController(service));
  return router;
}
