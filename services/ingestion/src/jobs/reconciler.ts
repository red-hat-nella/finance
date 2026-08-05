import { loadJobDatabaseConfig } from "../config/load-job-database.js";
import { createDatabasePool } from "../infrastructure/db/pool.js";
import { reconcileStaleEvaluations } from "../modules/evaluations/reconcile-stale-evaluations.js";

const pool = createDatabasePool(loadJobDatabaseConfig());

try {
  const result = await reconcileStaleEvaluations(pool);
  console.log(
    JSON.stringify({
      level: "info",
      event: "reconciler.completed",
      lockAcquired: result.lockAcquired,
      reconciled: result.reconciled,
    }),
  );
} finally {
  await pool.end();
}
