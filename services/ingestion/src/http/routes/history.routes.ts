import { Router } from "express";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import { PostgresAuditWriter } from "../../modules/audit/audit-writer.js";
import { searchEvaluationsController } from "../../modules/history/history.controller.js";
import { HistoryRepository } from "../../modules/history/history.repository.js";
import { SearchHistoryService } from "../../modules/history/search-history.service.js";

export function historyRoutes(pool: pg.Pool, config: AppConfig): Router {
  const router = Router();
  const service = new SearchHistoryService(
    new HistoryRepository(pool),
    new PostgresAuditWriter(pool),
    config,
  );
  router.post("/evaluations/search", searchEvaluationsController(service));
  return router;
}
