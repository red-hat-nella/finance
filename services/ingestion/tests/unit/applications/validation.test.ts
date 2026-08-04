import { describe, expect, it } from "vitest";
import {
  applicationEvaluationSchema,
  toFieldValidationErrors,
} from "../../../src/domain/applications/validation.js";
import type { ValidationCode } from "../../../src/domain/applications/validation-messages.js";

interface TestApplication {
  applicant: {
    documentType: "CC" | "CE" | "PPT" | "PASSPORT";
    documentNumber: string;
    fullName: string;
    contact: { phone?: string; email?: string };
  };
  consent: {
    decision: "accepted" | "denied" | "revoked";
    noticeVersion: string;
    purposeCode: "ALTERNATIVE_CREDIT_RISK_EVALUATION";
  };
  alternativeData: {
    income:
      | {
          availability: "provided";
          monthlyIncomeCop: string;
          sourceType: "employment" | "self_employed" | "pension" | "other";
          sourceOtherDescription?: string;
          stabilityMonths: number;
        }
      | { availability: "unavailable"; reason: string };
    utilities:
      | {
          availability: "provided";
          references: Array<{
            serviceType: "electricity" | "water" | "gas" | "internet" | "other";
            periodStart: string;
            periodEnd: string;
            observedMonths: number;
            totalObligations: number;
            onTimeCount: number;
            lateCount: number;
            missedCount: number;
            averageMonthlyAmountCop: string;
          }>;
        }
      | { availability: "unavailable"; reason: string };
    mobile:
      | {
          availability: "provided";
          mode: "prepaid" | "postpaid";
          tenureMonths: number;
          observedMonths: number;
          regularMonths: number;
        }
      | { availability: "unavailable"; reason: string };
  };
}

function validApplication(): TestApplication {
  return {
    applicant: {
      documentType: "CC",
      documentNumber: "1001032",
      fullName: "Maria Paula Rojas",
      contact: {
        phone: "+57 (300) 100-1032",
        email: "Maria.Rojas@EXAMPLE.TEST",
      },
    },
    consent: {
      decision: "accepted",
      noticeVersion: "CONSENT-MVP-1.0.0",
      purposeCode: "ALTERNATIVE_CREDIT_RISK_EVALUATION",
    },
    alternativeData: {
      income: {
        availability: "provided",
        monthlyIncomeCop: "4000000.00",
        sourceType: "employment",
        stabilityMonths: 48,
      },
      utilities: {
        availability: "provided",
        references: [
          {
            serviceType: "electricity",
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
        availability: "provided",
        mode: "postpaid",
        tenureMonths: 48,
        observedMonths: 12,
        regularMonths: 12,
      },
    },
  };
}

function expectCode(application: TestApplication, code: ValidationCode): void {
  const result = applicationEvaluationSchema.safeParse(application);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(
    toFieldValidationErrors(result.error).map((error) => error.code),
  ).toContain(code);
}

function firstUtilityReference(application: TestApplication) {
  const utilities = application.alternativeData.utilities;
  if (utilities.availability !== "provided" || !utilities.references[0])
    throw new Error(
      "The canonical test application requires one utility reference",
    );
  return utilities.references[0];
}

describe("application authoritative validation", () => {
  it("normalizes Colombian identity, contact, and display fields", () => {
    const application = validApplication();
    application.applicant.documentNumber = "  ab123  ";
    application.applicant.documentType = "CE";
    application.applicant.fullName = "  Maria   Paula Rojas  ";

    const parsed = applicationEvaluationSchema.parse(application);

    expect(parsed.applicant).toMatchObject({
      documentNumber: "AB123",
      fullName: "Maria Paula Rojas",
      contact: {
        phone: "+573001001032",
        email: "Maria.Rojas@example.test",
      },
    });
  });

  it("accepts explicit unavailability with an operational reason", () => {
    const application = validApplication();
    application.alternativeData.mobile = {
      availability: "unavailable",
      reason: "El solicitante no conserva soportes del periodo móvil.",
    };
    expect(applicationEvaluationSchema.safeParse(application).success).toBe(
      true,
    );
  });

  it.each([
    [
      "VAL-001",
      (value: TestApplication) => {
        value.applicant.documentNumber = "1 23";
      },
    ],
    [
      "VAL-002",
      (value: TestApplication) => {
        value.applicant.fullName = "123";
      },
    ],
    [
      "VAL-003",
      (value: TestApplication) => {
        value.applicant.contact = { phone: "12" };
      },
    ],
    [
      "VAL-004",
      (value: TestApplication) => {
        value.consent.decision = "denied";
      },
    ],
    [
      "VAL-005",
      (value: TestApplication) => {
        if (value.alternativeData.income.availability === "provided")
          value.alternativeData.income.monthlyIncomeCop = "0.00";
      },
    ],
    [
      "VAL-006",
      (value: TestApplication) => {
        value.alternativeData.income = {
          availability: "provided",
          monthlyIncomeCop: "2000000.00",
          sourceType: "other",
          stabilityMonths: 12,
        };
      },
    ],
    [
      "VAL-007",
      (value: TestApplication) => {
        if (value.alternativeData.income.availability === "provided")
          value.alternativeData.income.stabilityMonths = 601;
      },
    ],
    [
      "VAL-008",
      (value: TestApplication) => {
        if (value.alternativeData.utilities.availability === "provided")
          value.alternativeData.utilities.references.push({
            ...firstUtilityReference(value),
          });
      },
    ],
    [
      "VAL-009",
      (value: TestApplication) => {
        firstUtilityReference(value).observedMonths = 0;
      },
    ],
    [
      "VAL-010",
      (value: TestApplication) => {
        firstUtilityReference(value).lateCount = 2;
      },
    ],
    [
      "VAL-011",
      (value: TestApplication) => {
        firstUtilityReference(value).averageMonthlyAmountCop = "0.00";
      },
    ],
    [
      "VAL-012",
      (value: TestApplication) => {
        value.alternativeData.mobile = {
          availability: "provided",
          mode: "satellite" as "prepaid",
          tenureMonths: 12,
          observedMonths: 12,
          regularMonths: 12,
        };
      },
    ],
    [
      "VAL-013",
      (value: TestApplication) => {
        if (value.alternativeData.mobile.availability === "provided")
          value.alternativeData.mobile.tenureMonths = 601;
      },
    ],
    [
      "VAL-014",
      (value: TestApplication) => {
        if (value.alternativeData.mobile.availability === "provided")
          value.alternativeData.mobile.regularMonths = 13;
      },
    ],
    [
      "VAL-015",
      (value: TestApplication) => {
        value.alternativeData.income = {
          availability: "unavailable",
          reason: "token secreto abcdefghijk",
        };
      },
    ],
  ] as const)("returns %s with a stable safe message", (code, mutate) => {
    const application = validApplication();
    mutate(application);
    expectCode(application, code);
  });
});
