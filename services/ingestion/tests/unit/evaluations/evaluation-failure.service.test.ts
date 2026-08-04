import type pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { finalizeEvaluationFailure } from "../../../src/modules/evaluations/evaluation-failure.service.js";

describe("finalizeEvaluationFailure", () => {
  it("atomically clears partial output and transitions all aggregate states", async () => {
    const statements: Array<{ text: string; values?: readonly unknown[] }> = [];
    const client = {
      query: vi.fn((text: string, values?: readonly unknown[]) => {
        statements.push(values ? { text, values } : { text });
        return Promise.resolve({
          rows: [],
          rowCount: text.includes("UPDATE scoring.evaluations") ? 1 : 0,
        });
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(() => Promise.resolve(client)),
    } as unknown as pg.Pool;

    await finalizeEvaluationFailure(pool, {
      evaluationId: "10000000-0000-4000-8000-000000000001",
      revisionId: "20000000-0000-4000-8000-000000000001",
      applicationId: "30000000-0000-4000-8000-000000000001",
      errorCode: "SCORING_TIMEOUT",
      correlationId: "40000000-0000-4000-8000-000000000001",
      actorId: "actor-opaque",
      actorRoles: ["credit_analyst"],
      orgId: "org-opaque",
    });

    expect(statements.map(({ text }) => text.trim().split(/\s+/)[0])).toEqual([
      "BEGIN",
      "UPDATE",
      "UPDATE",
      "UPDATE",
      "INSERT",
      "COMMIT",
    ]);
    expect(statements[1]?.text).toContain(
      "score=NULL,risk_band=NULL,recommendation_code=NULL",
    );
    expect(statements[4]?.values?.at(-1)).toEqual({
      errorCode: "SCORING_TIMEOUT",
      toStatus: "error",
    });
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("is idempotent when the attempt is already terminal", async () => {
    const client = {
      query: vi.fn((text: string) =>
        Promise.resolve({
          rows: [],
          rowCount: text.includes("UPDATE scoring.evaluations") ? 0 : 0,
        }),
      ),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(() => Promise.resolve(client)),
    } as unknown as pg.Pool;

    await finalizeEvaluationFailure(pool, {
      evaluationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      applicationId: crypto.randomUUID(),
      errorCode: "SCORING_UNAVAILABLE",
      correlationId: crypto.randomUUID(),
      actorId: "actor-opaque",
      actorRoles: ["credit_analyst"],
      orgId: "org-opaque",
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
