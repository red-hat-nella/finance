import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
describe("migration ownership", () => {
  it("keeps ordered migrations outside runtime services", async () => {
    const files = (await readdir("../../db/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(files).toEqual([
      "0001_schema_and_catalog_checks.sql",
      "0002_applicants_applications_consents.sql",
      "0003_alternative_data.sql",
      "0004_criteria_evaluations_factors.sql",
      "0005_audit_idempotency_retention.sql",
      "0006_seed_scoring_mvp_1_0_0.sql",
      "0007_integrity_triggers.sql",
      "0008_partial_application_drafts.sql",
      "0009_explainable_factor_fields.sql",
      "0010_sync_criteria_checksum.sql",
    ]);
    const runtime = await readFile("src/server.ts", "utf8");
    expect(runtime).not.toMatch(/CREATE\s+(TABLE|SCHEMA)|ALTER\s+TABLE/i);
  });
  it("declares constraints, indexes and scoped roles", async () => {
    const sql = await Promise.all(
      (await readdir("../../db/migrations"))
        .filter((file) => file.endsWith(".sql"))
        .map((file) => readFile(`../../db/migrations/${file}`, "utf8")),
    );
    const all = sql.join("\n");
    expect(all).toContain("uq_applicant_document_active");
    expect(all).toContain("ix_evaluation_owner_history");
    expect(all).toContain("scoring_app");
    expect(all).toContain("scoring_migrator");
  });
});
