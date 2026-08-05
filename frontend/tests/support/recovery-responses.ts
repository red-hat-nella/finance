import { evaluationProfiles, evaluationResponse } from './evaluation-profiles';

export const evaluationId = '20000000-0000-4000-8000-000000000010';
export const retryEvaluationId = '20000000-0000-4000-8000-000000000011';
export const applicationId = '10000000-0000-4000-8000-000000000010';

export function errorEvaluation() {
  return {
    ...evaluationResponse(evaluationProfiles[0]!),
    evaluationId,
    applicationId,
    state: 'error',
    errorCode: 'SCORING_TIMEOUT',
    score: null,
    riskBand: null,
    recommendation: null,
    factors: [],
    completedAt: '2026-08-04T12:00:00.751Z',
  };
}

export function manualWithoutScore() {
  return {
    ...errorEvaluation(),
    state: 'revision_manual',
    errorCode: null,
    recommendation: {
      code: 'MANUAL_REVIEW_REQUIRED',
      text: 'Realizar revisión manual obligatoria.',
    },
    manualReviewReasons: [
      {
        code: 'MISSING_MOBILE_DATA',
        dimension: 'mobile',
        message:
          'No se declararon datos suficientes de telefonía móvil; documente la verificación humana antes de continuar.',
      },
    ],
  };
}

export function successfulRetry() {
  return {
    ...evaluationResponse(evaluationProfiles[0]!),
    evaluationId: retryEvaluationId,
    applicationId,
    attemptNumber: 2,
    retryOfEvaluationId: evaluationId,
    relatedAttempts: [
      {
        evaluationId,
        attemptNumber: 1,
        state: 'error',
        startedAt: '2026-08-04T12:00:00Z',
        completedAt: '2026-08-04T12:00:00.751Z',
        errorCode: 'SCORING_TIMEOUT',
      },
    ],
  };
}
