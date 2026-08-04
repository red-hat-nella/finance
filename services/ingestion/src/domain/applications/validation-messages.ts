export const VALIDATION_MESSAGES = Object.freeze({
  "VAL-001": "Ingresa un documento válido para el tipo seleccionado",
  "VAL-002": "Ingresa el nombre completo",
  "VAL-003": "Ingresa un teléfono o correo válido",
  "VAL-004": "Se requiere consentimiento registrado para evaluar",
  "VAL-005":
    "Ingresa un ingreso en COP mayor que cero o indica que no está disponible",
  "VAL-006": "Selecciona o describe la fuente de ingreso",
  "VAL-007": "Ingresa meses entre 0 y 600",
  "VAL-008": "Agrega una referencia válida o indica por qué no está disponible",
  "VAL-009": "El período debe estar entre 1 y 12 meses",
  "VAL-010": "Los pagos deben coincidir con el período observado",
  "VAL-011": "Ingresa un monto mensual válido en COP",
  "VAL-012": "Selecciona la modalidad móvil",
  "VAL-013": "Ingresa meses entre 0 y 600",
  "VAL-014": "La regularidad debe coincidir con el período móvil",
  "VAL-015": "Explica por qué el dato no está disponible",
  "VAL-016": "La fecha inicial no puede ser posterior a la final",
  "VAL-017": "Selecciona un estado válido",
} as const);

export type ValidationCode = keyof typeof VALIDATION_MESSAGES;

export const VALIDATION_PATHS: Readonly<Record<ValidationCode, string>> =
  Object.freeze({
    "VAL-001": "applicant.documentNumber",
    "VAL-002": "applicant.fullName",
    "VAL-003": "applicant.contact",
    "VAL-004": "consent.decision",
    "VAL-005": "alternativeData.income.monthlyIncomeCop",
    "VAL-006": "alternativeData.income.sourceType",
    "VAL-007": "alternativeData.income.stabilityMonths",
    "VAL-008": "alternativeData.utilities.references",
    "VAL-009": "alternativeData.utilities.references.observedMonths",
    "VAL-010": "alternativeData.utilities.references",
    "VAL-011": "alternativeData.utilities.references.averageMonthlyAmountCop",
    "VAL-012": "alternativeData.mobile.mode",
    "VAL-013": "alternativeData.mobile.tenureMonths",
    "VAL-014": "alternativeData.mobile.regularMonths",
    "VAL-015": "availability.reason",
    "VAL-016": "filters.dateRange",
    "VAL-017": "filters.states",
  });

export interface FieldValidationError {
  readonly path: string;
  readonly code: ValidationCode;
  readonly message: string;
}
