export const DOCUMENT_TYPES = ["CC", "CE", "PPT", "PASSPORT"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const INCOME_SOURCE_TYPES = [
  "employment",
  "self_employed",
  "pension",
  "other",
] as const;
export type IncomeSourceType = (typeof INCOME_SOURCE_TYPES)[number];

export const UTILITY_SERVICE_TYPES = [
  "electricity",
  "water",
  "gas",
  "internet",
  "other",
] as const;
export type UtilityServiceType = (typeof UTILITY_SERVICE_TYPES)[number];

export const MOBILE_MODES = ["prepaid", "postpaid"] as const;
export type MobileMode = (typeof MOBILE_MODES)[number];

export interface ApplicantInput {
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly fullName: string;
  readonly contact: Readonly<{
    phone?: string;
    email?: string;
  }>;
}

export interface ConsentInput {
  readonly decision: "accepted" | "denied" | "revoked";
  readonly noticeVersion: string;
  readonly purposeCode: "ALTERNATIVE_CREDIT_RISK_EVALUATION";
}

export interface UnavailableData {
  readonly availability: "unavailable";
  readonly reason: string;
}

export interface IncomeProvided {
  readonly availability: "provided";
  readonly monthlyIncomeCop: string;
  readonly sourceType: IncomeSourceType;
  readonly sourceOtherDescription?: string;
  readonly stabilityMonths: number;
}

export interface UtilityReferenceInput {
  readonly serviceType: UtilityServiceType;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly observedMonths: number;
  readonly totalObligations: number;
  readonly onTimeCount: number;
  readonly lateCount: number;
  readonly missedCount: number;
  readonly averageMonthlyAmountCop: string;
}

export interface UtilitiesProvided {
  readonly availability: "provided";
  readonly references: readonly UtilityReferenceInput[];
}

export interface MobileProvided {
  readonly availability: "provided";
  readonly mode: MobileMode;
  readonly tenureMonths: number;
  readonly observedMonths: number;
  readonly regularMonths: number;
}

export interface AlternativeDataInput {
  readonly income?: IncomeProvided | UnavailableData;
  readonly utilities?: UtilitiesProvided | UnavailableData;
  readonly mobile?: MobileProvided | UnavailableData;
}

export interface ApplicationDraftInput {
  readonly applicant: ApplicantInput;
  readonly consent?: ConsentInput;
  readonly alternativeData?: AlternativeDataInput;
}

export interface ApplicationEvaluationInput extends ApplicationDraftInput {
  readonly consent: ConsentInput & { readonly decision: "accepted" };
  readonly alternativeData: Required<AlternativeDataInput>;
}
