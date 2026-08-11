import { Router } from "express";
import type pg from "pg";
import { setDependencyState } from "../../observability/metrics.js";
export function healthRoutes(pool: pg.Pool): Router {
  const router = Router();
  router.get("/health/live", (_req, res) =>
    res.json({ status: "ok", service: "ingestion", version: "1.0.0" }),
  );
  router.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      setDependencyState("database", true);
      res.json({ status: "ready", dependencies: { database: "ready" } });
    } catch {
      setDependencyState("database", false);
      res.status(503).json({
        status: "not_ready",
        dependencies: { database: "unavailable" },
      });
    }
  });
  return router;
}
