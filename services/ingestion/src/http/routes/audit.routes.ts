import { Router } from "express";
import type pg from "pg";
import { AuditRepository } from "../../modules/audit/audit.repository.js";
import { getEvaluationAuditController } from "../../modules/audit/audit.controller.js";
import { PostgresAuditWriter } from "../../modules/audit/audit-writer.js";
import { GetEvaluationAuditService } from "../../modules/audit/get-evaluation-audit.service.js";

export function auditRoutes(pool: pg.Pool): Router {
  const router = Router();
  const service = new GetEvaluationAuditService(
    new AuditRepository(pool),
    new PostgresAuditWriter(pool),
  );
  router.get(
    "/evaluations/:evaluationId/audit",
    getEvaluationAuditController(service),
  );
  return router;
}
