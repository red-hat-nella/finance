import type pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "../../../src/modules/history/history.repository.js";

describe("HistoryRepository", () => {
  it("uses scoped parameterized predicates and a stable descending order", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            public_id: "10000000-0000-4000-8000-000000000001",
            completed_at: new Date("2026-08-03T14:00:00Z"),
            document_masked: "CC ••••••1032",
            applicant_display_name: "Maria R.",
            score: 835,
            risk_band: "riesgo_bajo",
            status: "evaluada",
          },
        ],
      });
    const repository = new HistoryRepository({ query } as unknown as pg.Pool);
    const blindIndex = Buffer.alloc(32, 4);

    const result = await repository.search(
      { orgId: "org-opaque", ownerActorId: "actor-opaque" },
      {
        page: 2,
        evaluationId: "10000000-0000-4000-8000-000000000001",
        documentBlindIndex: blindIndex,
        dateFrom: "2026-08-01",
        dateTo: "2026-08-03",
        states: ["evaluada"],
      },
    );

    const countSql = String(query.mock.calls[0]?.[0]);
    const pageSql = String(query.mock.calls[1]?.[0]);
    expect(countSql).toContain("org_scope_id=$1");
    expect(countSql).toContain("owner_actor_id=$3");
    expect(countSql).toContain("document_blind_index=$5");
    expect(pageSql).toContain("ORDER BY completed_at DESC,id DESC");
    expect(pageSql).toContain("LIMIT $8 OFFSET $9");
    expect(query.mock.calls[1]?.[1]).toEqual([
      "org-opaque",
      ["evaluada"],
      "actor-opaque",
      "10000000-0000-4000-8000-000000000001",
      blindIndex,
      "2026-08-01",
      "2026-08-03",
      25,
      25,
    ]);
    expect(result.totalItems).toBe(1);
    expect(result.items[0]).toMatchObject({
      displayName: "Maria R.",
      timezone: "America/Bogota",
    });
  });
});
