export interface ApiProblem {
  readonly status?: number;
  readonly code?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly errors?: readonly {
    field?: string;
    path?: string;
    code?: string;
    message?: string;
  }[];
}

export interface SafeApiError {
  readonly message: string;
  readonly correlationId?: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

const SAFE_MESSAGES: Readonly<Record<string, string>> = {
  VALIDATION_FAILED: 'Revise los campos indicados e intente nuevamente.',
  EVALUATION_VALIDATION_FAILED:
    'Complete o corrija los datos antes de evaluar.',
  UNAUTHORIZED: 'La sesión no es válida. Inicie sesión nuevamente.',
  FORBIDDEN: 'No tiene permiso para realizar esta operación.',
  PAYLOAD_TOO_LARGE: 'La información enviada supera el tamaño permitido.',
  SCORING_TIMEOUT: 'La evaluación tardó demasiado. Puede intentar nuevamente.',
  EVALUATION_NOT_FOUND:
    'No encontramos una evaluación accesible con ese identificador.',
  INTERNAL_FAILURE:
    'No fue posible completar la operación. Intente nuevamente.',
};

export function mapApiProblem(value: unknown): SafeApiError {
  const problem =
    value && typeof value === 'object' ? (value as ApiProblem) : {};
  const fieldErrors: Record<string, string> = {};
  for (const error of problem.errors ?? []) {
    const field = error.field ?? error.path;
    if (field && error.message) fieldErrors[field] = error.message;
  }
  return {
    message:
      problem.code && SAFE_MESSAGES[problem.code]
        ? SAFE_MESSAGES[problem.code]
        : 'No fue posible completar la operación. Intente nuevamente.',
    correlationId: problem.correlationId ?? problem.requestId,
    fieldErrors: Object.freeze(fieldErrors),
  };
}

export function safeProblemMessage(problem: ApiProblem): string {
  return mapApiProblem(problem).message;
}
