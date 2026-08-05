import { Router } from "express";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import {
  createApplicationController,
  getApplicationController,
  updateApplicationController,
} from "../../modules/applications/application.controller.js";
import { createApplicationService } from "../../modules/applications/application.service.js";
import { PostgresAuditWriter } from "../../modules/audit/audit-writer.js";

export function applicationRoutes(pool: pg.Pool, config: AppConfig): Router {
  const router = Router();
  const service = createApplicationService(
    pool,
    config,
    new PostgresAuditWriter(pool),
  );
  router.post("/applications", createApplicationController(service));
  router.get("/applications/:applicationId", getApplicationController(service));
  router.patch(
    "/applications/:applicationId",
    updateApplicationController(service),
  );
  return router;
}
