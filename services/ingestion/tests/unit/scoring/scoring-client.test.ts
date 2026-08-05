import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoringClient } from "../../../src/infrastructure/scoring/scoring-client.js";

const evaluationId = "10000000-0000-4000-8000-000000000001";
const inputHash = `sha256:${"a".repeat(64)}`;
const checksum = "b".repeat(64);
const command = {
  evaluationId,
  criteriaVersion: "SCORING-MVP-1.0.0" as const,
  inputSchemaVersion: "1.0.0" as const,
  inputHash,
  requestId: "50000000-0000-4000-8000-000000000001",
  normalizedInput: {
    income: {
      availability: "provided" as const,
      monthlyIncomeCop: "4000000.00",
      stabilityMonths: 48,
    },
    utilities: {
      availability: "provided" as const,
      references: [
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
  },
};

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    resultType: "scored",
    evaluationId,
    status: "evaluada",
    score: 835,
    scoreScale: { minimum: 300, maximum: 850 },
    riskBand: "riesgo_bajo",
    recommendation: {
      code: "CONTINUE_HUMAN_ANALYSIS",
      text: "Continuar con el análisis crediticio humano.",
    },
    factors: ["utility", "mobile", "income"].map((dimension, index) => ({
      rank: index + 1,
      dimension,
      direction: "favorable",
      dimensionIndex: "100.000",
      weight: dimension === "utility" ? "0.400" : "0.300",
      contributionPoints: "100.000",
      observedSummary: "Dato agregado disponible.",
      ruleCode: `${dimension.toUpperCase()}_INDEX`,
      explanation: "El dato declarado aporta favorablemente al resultado.",
    })),
    manualReviewReasons: [],
    criteriaVersion: "SCORING-MVP-1.0.0",
    inputHash,
    calculatedAt: "2026-08-04T15:00:00Z",
    ...overrides,
  };
}

function client(): ScoringClient {
  return new ScoringClient({
    baseUrl: "http://scoring:8080",
    timeoutMs: 750,
    criteriaVersion: "SCORING-MVP-1.0.0",
    token: "a".repeat(32),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ScoringClient", () => {
  it("sends service auth and returns a strictly validated response", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(() =>
      Promise.resolve(
        new Response(JSON.stringify(validResponse()), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Evaluation-Id": evaluationId,
            "X-Criteria-Checksum": checksum,
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().calculate(command);

    expect(result.response.score).toBe(835);
    expect(result.criteriaChecksum).toBe(checksum);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      "X-Scoring-Service-Token": "a".repeat(32),
      "X-Evaluation-Id": evaluationId,
      "X-Request-Id": command.requestId,
    });
  });

  it.each([
    ["score outside range", validResponse({ score: 900 })],
    [
      "echoed evaluation ID mismatch",
      validResponse({ evaluationId: crypto.randomUUID() }),
    ],
    [
      "unknown response property",
      validResponse({ applicantName: "No permitido" }),
    ],
    [
      "criteria version mismatch",
      validResponse({ criteriaVersion: "SCORING-MVP-9.9.9" }),
    ],
    ["input hash mismatch", validResponse({ inputHash: `sha256:${"c".repeat(64)}` })],
    ["invalid factor count", validResponse({ factors: [] })],
  ])("rejects %s without returning partial data", async (_name, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: {
              "X-Evaluation-Id": evaluationId,
              "X-Criteria-Checksum": checksum,
            },
          }),
        ),
      ),
    );

    await expect(client().calculate(command)).rejects.toMatchObject({
      code: "SCORING_RESPONSE_INVALID",
      status: 502,
    });
  });

  it("maps an upstream timeout to an observable 504 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(new DOMException("timed out", "TimeoutError")),
      ),
    );

    await expect(client().calculate(command)).rejects.toMatchObject({
      code: "SCORING_TIMEOUT",
      status: 504,
    });
  });

  it.each([
    ["connection failure", () => Promise.reject(new TypeError("connection refused"))],
    ["upstream 5xx", () => Promise.resolve(new Response(null, { status: 503 }))],
  ])("maps %s to an observable 502 error", async (_name, response) => {
    vi.stubGlobal("fetch", vi.fn(response));
    await expect(client().calculate(command)).rejects.toMatchObject({
      code: "SCORING_UNAVAILABLE",
      status: 502,
    });
  });
});
