import { loadJobDatabaseConfig } from "../config/load-job-database.js";
import { createDatabasePool } from "../infrastructure/db/pool.js";
import { RetentionService } from "../modules/retention/retention.service.js";

const pool = createDatabasePool(loadJobDatabaseConfig());
try {
  const result = await new RetentionService(pool).run({
    dryRun: process.argv.includes("--dry-run"),
    batchSize: Number(process.env["RETENTION_BATCH_SIZE"] ?? 500),
    initiatedBy: "retention-cronjob",
  });
  console.log(JSON.stringify({ level: "info", event: "retention.completed", ...result }));
} finally {
  await pool.end();
}
