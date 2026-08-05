export type DocumentType = 'CC' | 'CE' | 'PPT' | 'PASSPORT';
export type IncomeSource = 'employment' | 'self_employed' | 'pension' | 'other';
export type ServiceType = 'electricity' | 'water' | 'gas' | 'internet' | 'other';
export type MobileMode = 'prepaid' | 'postpaid';

export interface ApplicantInput {
  documentType: DocumentType;
  documentNumber: string;
  fullName: string;
  contact: { phone?: string; email?: string };
}

export interface ConsentInput {
  decision: 'accepted' | 'denied';
  noticeVersion: string;
  purposeCode: 'ALTERNATIVE_CREDIT_RISK_EVALUATION';
}

export interface UnavailableData {
  availability: 'unavailable';
  reason: string;
}

export interface AlternativeDataInput {
  income?:
    | {
        availability: 'provided';
        monthlyIncomeCop: string;
        sourceType: IncomeSource;
        sourceOtherDescription?: string;
        stabilityMonths: number;
      }
    | UnavailableData;
  utilities?:
    | {
        availability: 'provided';
        references: Array<{
          serviceType: ServiceType;
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
    | UnavailableData;
  mobile?:
    | {
        availability: 'provided';
        mode: MobileMode;
        tenureMonths: number;
        observedMonths: number;
        regularMonths: number;
      }
    | UnavailableData;
}

export interface ApplicationDraftInput {
  applicant: ApplicantInput;
  consent?: ConsentInput;
  alternativeData?: AlternativeDataInput;
}

export interface ApplicationInput extends ApplicationDraftInput {
  consent: ConsentInput & { decision: 'accepted' };
  alternativeData: Required<AlternativeDataInput>;
}

export interface ApplicationFormValue {
  documentType: DocumentType;
  documentNumber: string;
  fullName: string;
  phone: string;
  email: string;
  monthlyIncomeCop: number | null;
  incomeUnavailable?: boolean;
  incomeUnavailableReason?: string;
  sourceType: IncomeSource;
  sourceOtherDescription: string;
  stabilityMonths: number | null;
  utilityReferences: readonly UtilityReferenceFormValue[];
  utilitiesUnavailable?: boolean;
  utilitiesUnavailableReason?: string;
  mobileMode: MobileMode;
  tenureMonths: number | null;
  mobileObservedMonths: number;
  regularMonths: number | null;
  mobileUnavailable?: boolean;
  mobileUnavailableReason?: string;
  consent: boolean;
}

export interface UtilityReferenceFormValue {
  serviceType: ServiceType;
  utilityAmount: number | null;
  utilityMonths: number;
  onTimeCount: number | null;
}
