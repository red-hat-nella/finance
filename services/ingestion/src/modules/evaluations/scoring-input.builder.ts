import type { AlternativeDataInput } from "../../domain/applications/application.js";
import { canonicalHash } from "../../infrastructure/crypto/canonical-hash.js";

export const INPUT_SCHEMA_VERSION = "1.0.0" as const;
export const DEFAULT_UNAVAILABLE_REASON_CODE = "DATA_NOT_AVAILABLE" as const;

export type UnavailableDimension = Readonly<{
  availability: "unavailable";
  reasonCode:
    | "APPLICANT_COULD_NOT_PROVIDE_DATA"
    | "DATA_NOT_AVAILABLE"
    | "PERIOD_NOT_AVAILABLE";
}>;

export interface NormalizedUtilityReference {
  readonly serviceType: "electricity" | "water" | "gas" | "internet" | "other";
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly observedMonths: number;
  readonly totalObligations: number;
  readonly onTimeCount: number;
  readonly lateCount: number;
  readonly missedCount: number;
  readonly averageMonthlyAmountCop: string;
}

export interface NormalizedScoringInput {
  readonly income:
    | Readonly<{
        availability: "provided";
        monthlyIncomeCop: string;
        stabilityMonths: number;
      }>
    | UnavailableDimension;
  readonly utilities:
    | Readonly<{
        availability: "provided";
        references: readonly NormalizedUtilityReference[];
      }>
    | UnavailableDimension;
  readonly mobile:
    | Readonly<{
        availability: "provided";
        mode: "prepaid" | "postpaid";
        tenureMonths: number;
        observedMonths: number;
        regularMonths: number;
      }>
    | UnavailableDimension;
}

export interface ScoringSnapshot {
  readonly inputSchemaVersion: typeof INPUT_SCHEMA_VERSION;
  readonly normalizedInput: NormalizedScoringInput;
  readonly inputHash: string;
  readonly inputHashBuffer: Buffer;
}

const FORBIDDEN_PII_KEYS = new Set([
  "applicant",
  "contact",
  "document",
  "documentnumber",
  "documentmasked",
  "email",
  "fullname",
  "name",
  "phone",
]);

export function buildScoringSnapshot(
  alternativeData: Required<AlternativeDataInput>,
): ScoringSnapshot {
  assertNoPii(alternativeData);
  const normalizedInput: NormalizedScoringInput = {
    income:
      alternativeData.income.availability === "provided"
        ? {
            availability: "provided",
            monthlyIncomeCop: alternativeData.income.monthlyIncomeCop,
            stabilityMonths: alternativeData.income.stabilityMonths,
          }
        : unavailable(),
    utilities:
      alternativeData.utilities.availability === "provided"
        ? {
            availability: "provided",
            references: [...alternativeData.utilities.references]
              .map((reference) => ({
                serviceType: reference.serviceType,
                periodStart: reference.periodStart,
                periodEnd: reference.periodEnd,
                observedMonths: reference.observedMonths,
                totalObligations: reference.totalObligations,
                onTimeCount: reference.onTimeCount,
                lateCount: reference.lateCount,
                missedCount: reference.missedCount,
                averageMonthlyAmountCop: reference.averageMonthlyAmountCop,
              }))
              .sort(compareReferences),
          }
        : unavailable(),
    mobile:
      alternativeData.mobile.availability === "provided"
        ? {
            availability: "provided",
            mode: alternativeData.mobile.mode,
            tenureMonths: alternativeData.mobile.tenureMonths,
            observedMonths: alternativeData.mobile.observedMonths,
            regularMonths: alternativeData.mobile.regularMonths,
          }
        : unavailable(),
  };
  assertNoPii(normalizedInput);
  const inputHashBuffer = canonicalHash(normalizedInput);
  return Object.freeze({
    inputSchemaVersion: INPUT_SCHEMA_VERSION,
    normalizedInput: deepFreeze(normalizedInput),
    inputHash: `sha256:${inputHashBuffer.toString("hex")}`,
    inputHashBuffer,
  });
}

export function assertNoPii(value: unknown, path = "input"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoPii(item, `${path}.${String(index)}`);
    });
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replaceAll(/[^a-z]/g, "");
    if (
      FORBIDDEN_PII_KEYS.has(normalizedKey) ||
      /(?:applicant|contact|document|displayname|email|fullname|phone)/.test(
        normalizedKey,
      )
    )
      throw new PiiDetectedError(`${path}.${key}`);
    assertNoPii(item, `${path}.${key}`);
  }
}

export class PiiDetectedError extends Error {
  readonly code = "PII_IN_SCORING_INPUT";

  constructor(readonly safePath: string) {
    super("La entrada normalizada contiene un campo no permitido.");
    this.name = "PiiDetectedError";
  }
}

function unavailable(): UnavailableDimension {
  return {
    availability: "unavailable",
    reasonCode: DEFAULT_UNAVAILABLE_REASON_CODE,
  };
}

function compareReferences(
  left: NormalizedUtilityReference,
  right: NormalizedUtilityReference,
): number {
  return `${left.serviceType}:${left.periodStart}:${left.periodEnd}`.localeCompare(
    `${right.serviceType}:${right.periodStart}:${right.periodEnd}`,
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
