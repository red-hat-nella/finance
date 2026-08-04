import { z } from "zod";
import {
  DOCUMENT_TYPES,
  INCOME_SOURCE_TYPES,
  MOBILE_MODES,
  UTILITY_SERVICE_TYPES,
  type ApplicationDraftInput,
  type ApplicationEvaluationInput,
} from "./application.js";
import {
  normalizeDocumentNumber,
  normalizeEmail,
  normalizeFreeText,
  normalizeHumanName,
  normalizePhone,
} from "./normalization.js";
import {
  VALIDATION_MESSAGES,
  VALIDATION_PATHS,
  type FieldValidationError,
  type ValidationCode,
} from "./validation-messages.js";

const COP_PATTERN = /^(?:0\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,8}\.[0-9]{2})$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const NAME_PATTERN = /^[\p{L}\p{M}' -]+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_REASON_PATTERN =
  /\b(?:password|contrase(?:n|ñ)a|secret|token|api[ -]?key|diagn[oó]stico|m[eé]dic[oa]|salud|enfermedad)\b/i;

function issue(code: ValidationCode, path?: readonly (string | number)[]) {
  return {
    code: "custom" as const,
    message: code,
    path: path ? [...path] : VALIDATION_PATHS[code].split("."),
  };
}

export function isValidDocument(type: string, value: string): boolean {
  if (type === "CC") return /^\d{3,10}$/.test(value);
  if (type === "CE" || type === "PPT") return /^[A-Z0-9]{3,15}$/.test(value);
  return type === "PASSPORT" && /^[A-Z0-9]{5,20}$/.test(value);
}

const contactSchema = z
  .object({
    phone: z.string().transform(normalizePhone).optional(),
    email: z.string().transform(normalizeEmail).optional(),
  })
  .strict()
  .superRefine((contact, context) => {
    const validPhone = contact.phone
      ? PHONE_PATTERN.test(contact.phone)
      : false;
    const validEmail = contact.email
      ? z.email().max(254).safeParse(contact.email).success
      : false;
    if (!validPhone && !validEmail) context.addIssue(issue("VAL-003", []));
    if (contact.phone && !validPhone)
      context.addIssue(issue("VAL-003", ["phone"]));
    if (contact.email && !validEmail)
      context.addIssue(issue("VAL-003", ["email"]));
  });

const applicantSchema = z
  .object({
    documentType: z.enum(DOCUMENT_TYPES),
    documentNumber: z.string(),
    fullName: z.string().transform(normalizeHumanName),
    contact: contactSchema,
  })
  .strict()
  .transform((applicant) => ({
    ...applicant,
    documentNumber: normalizeDocumentNumber(
      applicant.documentType,
      applicant.documentNumber,
    ),
  }))
  .superRefine((applicant, context) => {
    if (!isValidDocument(applicant.documentType, applicant.documentNumber))
      context.addIssue(issue("VAL-001", ["documentNumber"]));
    if (
      applicant.fullName.length < 3 ||
      applicant.fullName.length > 120 ||
      !NAME_PATTERN.test(applicant.fullName)
    )
      context.addIssue(issue("VAL-002", ["fullName"]));
  });

const consentSchema = z
  .object({
    decision: z.enum(["accepted", "denied", "revoked"]),
    noticeVersion: z.string().trim().min(1).max(64),
    purposeCode: z.literal("ALTERNATIVE_CREDIT_RISK_EVALUATION"),
  })
  .strict();

const unavailableSchema = z
  .object({
    availability: z.literal("unavailable"),
    reason: z.string().transform(normalizeFreeText),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.reason.length < 10 ||
      value.reason.length > 240 ||
      FORBIDDEN_REASON_PATTERN.test(value.reason)
    )
      context.addIssue(issue("VAL-015", ["reason"]));
  });

const incomeProvidedSchema = z
  .object({
    availability: z.literal("provided"),
    monthlyIncomeCop: z.string(),
    sourceType: z.enum(INCOME_SOURCE_TYPES),
    sourceOtherDescription: z.string().transform(normalizeFreeText).optional(),
    stabilityMonths: z.number().int(),
  })
  .strict()
  .superRefine((income, context) => {
    if (!COP_PATTERN.test(income.monthlyIncomeCop))
      context.addIssue(issue("VAL-005", ["monthlyIncomeCop"]));
    if (income.stabilityMonths < 0 || income.stabilityMonths > 600)
      context.addIssue(issue("VAL-007", ["stabilityMonths"]));
    if (
      income.sourceType === "other" &&
      (!income.sourceOtherDescription ||
        income.sourceOtherDescription.length < 3 ||
        income.sourceOtherDescription.length > 80)
    )
      context.addIssue(issue("VAL-006", ["sourceOtherDescription"]));
  });

const utilityReferenceSchema = z
  .object({
    serviceType: z.enum(UTILITY_SERVICE_TYPES),
    periodStart: z.string(),
    periodEnd: z.string(),
    observedMonths: z.number().int(),
    totalObligations: z.number().int(),
    onTimeCount: z.number().int(),
    lateCount: z.number().int(),
    missedCount: z.number().int(),
    averageMonthlyAmountCop: z.string(),
  })
  .strict()
  .superRefine((reference, context) => {
    if (
      !DATE_PATTERN.test(reference.periodStart) ||
      !DATE_PATTERN.test(reference.periodEnd) ||
      reference.periodStart > reference.periodEnd ||
      reference.observedMonths < 1 ||
      reference.observedMonths > 12
    )
      context.addIssue(issue("VAL-009", ["observedMonths"]));

    const counts = [
      reference.onTimeCount,
      reference.lateCount,
      reference.missedCount,
    ];
    if (
      reference.totalObligations < 1 ||
      reference.totalObligations > 12 ||
      counts.some((count) => count < 0 || count > reference.observedMonths) ||
      counts.reduce((total, count) => total + count, 0) !==
        reference.totalObligations
    )
      context.addIssue(issue("VAL-010", []));
    if (!COP_PATTERN.test(reference.averageMonthlyAmountCop))
      context.addIssue(issue("VAL-011", ["averageMonthlyAmountCop"]));
  });

const utilitiesProvidedSchema = z
  .object({
    availability: z.literal("provided"),
    references: z.array(utilityReferenceSchema),
  })
  .strict()
  .superRefine((utilities, context) => {
    if (utilities.references.length < 1 || utilities.references.length > 3) {
      context.addIssue(issue("VAL-008", ["references"]));
      return;
    }
    const periods = new Set<string>();
    for (const reference of utilities.references) {
      const key = `${reference.serviceType}:${reference.periodStart}:${reference.periodEnd}`;
      if (periods.has(key)) {
        context.addIssue(issue("VAL-008", ["references"]));
        return;
      }
      periods.add(key);
    }
  });

const mobileProvidedSchema = z
  .object({
    availability: z.literal("provided"),
    mode: z.enum(MOBILE_MODES),
    tenureMonths: z.number().int(),
    observedMonths: z.number().int(),
    regularMonths: z.number().int(),
  })
  .strict()
  .superRefine((mobile, context) => {
    if (mobile.tenureMonths < 0 || mobile.tenureMonths > 600)
      context.addIssue(issue("VAL-013", ["tenureMonths"]));
    if (mobile.observedMonths < 1 || mobile.observedMonths > 12)
      context.addIssue(issue("VAL-014", ["observedMonths"]));
    if (
      mobile.regularMonths < 0 ||
      mobile.regularMonths > mobile.observedMonths
    )
      context.addIssue(issue("VAL-014", ["regularMonths"]));
  });

const alternativeDataSchema = z
  .object({
    income: z.union([incomeProvidedSchema, unavailableSchema]).optional(),
    utilities: z.union([utilitiesProvidedSchema, unavailableSchema]).optional(),
    mobile: z.union([mobileProvidedSchema, unavailableSchema]).optional(),
  })
  .strict();

export const applicationDraftSchema = z
  .object({
    applicant: applicantSchema,
    consent: consentSchema.optional(),
    alternativeData: alternativeDataSchema.optional(),
  })
  .strict();

export const applicationEvaluationSchema = applicationDraftSchema.superRefine(
  (application, context) => {
    if (application.consent?.decision !== "accepted")
      context.addIssue(issue("VAL-004"));
    if (!application.alternativeData?.income)
      context.addIssue(issue("VAL-005"));
    if (!application.alternativeData?.utilities)
      context.addIssue(issue("VAL-008"));
    if (!application.alternativeData?.mobile)
      context.addIssue(issue("VAL-012"));
  },
);

export function parseApplicationDraft(input: unknown): ApplicationDraftInput {
  return applicationDraftSchema.parse(input) as ApplicationDraftInput;
}

export function parseApplicationForEvaluation(
  input: unknown,
): ApplicationEvaluationInput {
  return applicationEvaluationSchema.parse(input) as ApplicationEvaluationInput;
}

export function toFieldValidationErrors(
  error: z.ZodError,
): readonly FieldValidationError[] {
  const seen = new Set<string>();
  const errors: FieldValidationError[] = [];
  for (const item of error.issues) {
    const code = isValidationCode(item.message)
      ? item.message
      : inferCode(item.path);
    const path = item.path.length
      ? item.path.map(String).join(".")
      : VALIDATION_PATHS[code];
    const key = `${code}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({ path, code, message: VALIDATION_MESSAGES[code] });
  }
  return errors;
}

function isValidationCode(value: string): value is ValidationCode {
  return value in VALIDATION_MESSAGES;
}

function inferCode(path: readonly PropertyKey[]): ValidationCode {
  const joined = path.map(String).join(".");
  if (joined.includes("document")) return "VAL-001";
  if (joined.includes("fullName")) return "VAL-002";
  if (joined.includes("contact")) return "VAL-003";
  if (joined.includes("consent")) return "VAL-004";
  if (joined.includes("income")) return "VAL-005";
  if (joined.includes("utilities")) return "VAL-008";
  if (joined.includes("mobile")) return "VAL-012";
  if (joined.includes("dateFrom") || joined.includes("dateTo"))
    return "VAL-016";
  if (joined.includes("states")) return "VAL-017";
  return "VAL-015";
}
