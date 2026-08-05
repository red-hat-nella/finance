import {
  ApplicationDraftInput,
  ApplicationFormValue,
  ApplicationInput,
} from './application-form.model';

export function toApplicationDraft(
  value: ApplicationFormValue,
  now = new Date(),
): ApplicationDraftInput {
  const contact = {
    ...(value.phone.trim() ? { phone: value.phone.trim() } : {}),
    ...(value.email.trim() ? { email: value.email.trim() } : {}),
  };
  const alternativeData: NonNullable<
    ApplicationDraftInput['alternativeData']
  > = {};
  if (value.incomeUnavailable)
    alternativeData.income = {
      availability: 'unavailable',
      reason: (value.incomeUnavailableReason ?? '').trim(),
    };
  else if (value.monthlyIncomeCop !== null && value.stabilityMonths !== null)
    alternativeData.income = {
      availability: 'provided',
      monthlyIncomeCop: value.monthlyIncomeCop.toFixed(2),
      sourceType: value.sourceType,
      ...(value.sourceType === 'other' && value.sourceOtherDescription.trim()
        ? { sourceOtherDescription: value.sourceOtherDescription.trim() }
        : {}),
      stabilityMonths: value.stabilityMonths,
    };
  const completeUtilities = value.utilityReferences.filter(
    (reference) =>
      reference.utilityAmount !== null && reference.onTimeCount !== null,
  );
  if (value.utilitiesUnavailable)
    alternativeData.utilities = {
      availability: 'unavailable',
      reason: (value.utilitiesUnavailableReason ?? '').trim(),
    };
  else if (completeUtilities.length) {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    alternativeData.utilities = {
      availability: 'provided',
      references: completeUtilities.map((reference) => ({
          serviceType: reference.serviceType,
          periodStart: start.toISOString().slice(0, 10),
          periodEnd: now.toISOString().slice(0, 10),
          observedMonths: reference.utilityMonths,
          totalObligations: reference.utilityMonths,
          onTimeCount: reference.onTimeCount!,
          lateCount: reference.utilityMonths - reference.onTimeCount!,
          missedCount: 0,
          averageMonthlyAmountCop: reference.utilityAmount!.toFixed(2),
        })),
    };
  }
  if (value.mobileUnavailable)
    alternativeData.mobile = {
      availability: 'unavailable',
      reason: (value.mobileUnavailableReason ?? '').trim(),
    };
  else if (value.tenureMonths !== null && value.regularMonths !== null)
    alternativeData.mobile = {
      availability: 'provided',
      mode: value.mobileMode,
      tenureMonths: value.tenureMonths,
      observedMonths: value.mobileObservedMonths,
      regularMonths: value.regularMonths,
    };
  return {
    applicant: {
      documentType: value.documentType,
      documentNumber: value.documentNumber,
      fullName: value.fullName,
      contact,
    },
    ...(value.consent
      ? {
          consent: {
            decision: 'accepted' as const,
            noticeVersion: 'CONSENT-MVP-1.0.0',
            purposeCode: 'ALTERNATIVE_CREDIT_RISK_EVALUATION' as const,
          },
        }
      : {}),
    ...(Object.keys(alternativeData).length ? { alternativeData } : {}),
  };
}

export function toEvaluationInput(
  value: ApplicationFormValue,
  now = new Date(),
): ApplicationInput {
  return toApplicationDraft(value, now) as ApplicationInput;
}

export function toApplicationFormValue(
  input: ApplicationDraftInput,
): ApplicationFormValue {
  const income = input.alternativeData?.income;
  const utilities = input.alternativeData?.utilities;
  const mobile = input.alternativeData?.mobile;
  const references =
    utilities?.availability === 'provided'
      ? utilities.references.map((reference) => ({
          serviceType: reference.serviceType,
          utilityAmount: Number(reference.averageMonthlyAmountCop),
          utilityMonths: reference.observedMonths,
          onTimeCount: reference.onTimeCount,
        }))
      : [
          {
            serviceType: 'electricity' as const,
            utilityAmount: null,
            utilityMonths: 12,
            onTimeCount: null,
          },
        ];
  return {
    documentType: input.applicant.documentType,
    documentNumber: input.applicant.documentNumber,
    fullName: input.applicant.fullName,
    phone: input.applicant.contact.phone ?? '',
    email: input.applicant.contact.email ?? '',
    monthlyIncomeCop:
      income?.availability === 'provided'
        ? Number(income.monthlyIncomeCop)
        : null,
    incomeUnavailable: income?.availability === 'unavailable',
    incomeUnavailableReason:
      income?.availability === 'unavailable' ? income.reason : '',
    sourceType:
      income?.availability === 'provided' ? income.sourceType : 'employment',
    sourceOtherDescription:
      income?.availability === 'provided'
        ? (income.sourceOtherDescription ?? '')
        : '',
    stabilityMonths:
      income?.availability === 'provided' ? income.stabilityMonths : null,
    utilityReferences: references,
    utilitiesUnavailable: utilities?.availability === 'unavailable',
    utilitiesUnavailableReason:
      utilities?.availability === 'unavailable' ? utilities.reason : '',
    mobileMode:
      mobile?.availability === 'provided' ? mobile.mode : 'postpaid',
    tenureMonths:
      mobile?.availability === 'provided' ? mobile.tenureMonths : null,
    mobileObservedMonths:
      mobile?.availability === 'provided' ? mobile.observedMonths : 12,
    regularMonths:
      mobile?.availability === 'provided' ? mobile.regularMonths : null,
    mobileUnavailable: mobile?.availability === 'unavailable',
    mobileUnavailableReason:
      mobile?.availability === 'unavailable' ? mobile.reason : '',
    consent: input.consent?.decision === 'accepted',
  };
}
