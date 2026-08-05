import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HistoryRepository } from "../../src/modules/history/history.repository.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl ? describe : describe.skip;
const orgId = randomUUID();
const ownerId = randomUUID();
let pool: pg.Pool;

describeDatabase("performance: history with 100,000 rows", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
    await pool.query(
      `INSERT INTO scoring.evaluations(
         public_id,attempt_number,org_scope_id,owner_actor_id,initiated_by_actor_id,
         document_blind_index,document_masked,applicant_display_name,status,score,risk_band,
         recommendation_code,recommendation_text,criteria_version,input_hash,correlation_id,
         started_at,completed_at,retention_until)
       SELECT gen_random_uuid(),1,$1,$2,$2,digest(gs::text,'sha256'),'CC ••••••0000','Performance U.',
              'evaluada',700,'riesgo_bajo','CONTINUE_HUMAN_ANALYSIS','Continuar análisis humano.',
              'SCORING-MVP-1.0.0',digest(('input-'||gs)::text,'sha256'),gen_random_uuid(),
              now()-(gs||' seconds')::interval,now()-(gs||' seconds')::interval,now()+interval '5 years'
         FROM generate_series(1,100000) gs`,
      [orgId, ownerId],
    );
    await pool.query("ANALYZE scoring.evaluations");
  });
  afterAll(async () => { await pool.end(); });

  it("returns the first indexed page in under 1 second", async () => {
    const repository = new HistoryRepository(pool);
    const started = performance.now();
    const result = await repository.search({ orgId, ownerActorId: ownerId }, { page: 1, states: ["evaluada"] });
    const duration = performance.now() - started;
    expect(result.totalItems).toBe(100_000);
    expect(result.items).toHaveLength(25);
    expect(duration).toBeLessThan(1_000);
    console.info(`history_rows=100000 duration_ms=${duration.toFixed(1)}`);
  });
});
