import { describe, expect, it } from "vitest";
import {
  PiiDetectedError,
  assertNoPii,
  buildScoringSnapshot,
} from "../../../src/modules/evaluations/scoring-input.builder.js";

const provided = {
  income: {
    availability: "provided" as const,
    monthlyIncomeCop: "4000000.00",
    sourceType: "employment" as const,
    stabilityMonths: 48,
  },
  utilities: {
    availability: "provided" as const,
    references: [
      {
        serviceType: "water" as const,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-01",
        observedMonths: 12,
        totalObligations: 12,
        onTimeCount: 11,
        lateCount: 1,
        missedCount: 0,
        averageMonthlyAmountCop: "100000.00",
      },
      {
        serviceType: "electricity" as const,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-01",
        observedMonths: 12,
        totalObligations: 12,
        onTimeCount: 12,
        lateCount: 0,
        missedCount: 0,
        averageMonthlyAmountCop: "250000.00",
      },
    ],
  },
  mobile: {
    availability: "provided" as const,
    mode: "postpaid" as const,
    tenureMonths: 48,
    observedMonths: 12,
    regularMonths: 12,
  },
};

describe("scoring input builder", () => {
  it("allows only normalized dimensions and produces an order-independent hash", () => {
    const first = buildScoringSnapshot(provided);
    const second = buildScoringSnapshot({
      ...provided,
      utilities: {
        ...provided.utilities,
        references: [...provided.utilities.references].reverse(),
      },
    });

    expect(first.inputHash).toBe(second.inputHash);
    expect(first.inputHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.normalizedInput.utilities).toMatchObject({
      availability: "provided",
      references: [{ serviceType: "electricity" }, { serviceType: "water" }],
    });
    expect(JSON.stringify(first.normalizedInput)).not.toContain("sourceType");
    expect(Object.isFrozen(first.normalizedInput)).toBe(true);
  });

  it("maps human unavailability reasons to a stable non-PII code", () => {
    const snapshot = buildScoringSnapshot({
      ...provided,
      income: {
        availability: "unavailable",
        reason: "El solicitante no cuenta con soportes del periodo.",
      },
    });

    expect(snapshot.normalizedInput.income).toEqual({
      availability: "unavailable",
      reasonCode: "DATA_NOT_AVAILABLE",
    });
    expect(JSON.stringify(snapshot.normalizedInput)).not.toContain(
      "solicitante",
    );
  });

  it("rejects PII recursively before an internal request can be made", () => {
    expect(() => {
      assertNoPii({ utilities: [{ nested: { documentNumber: "1001032" } }] });
    }).toThrow(PiiDetectedError);

    const unsafe = { ...provided, applicantDisplayName: "Nombre no permitido" };
    expect(() => {
      buildScoringSnapshot(unsafe);
    }).toThrow(PiiDetectedError);
  });
});
