export const auditedEvaluationId = '20000000-0000-4000-8000-000000000021';
export const manualAuditId = '20000000-0000-4000-8000-000000000022';
export const retriedAuditId = '20000000-0000-4000-8000-000000000023';

type Outcome = 'success' | 'blocked' | 'denied' | 'error';

function event(
  suffix: number,
  eventType: string,
  occurredAt: string,
  safeMetadata: Record<string, string | number | boolean | null>,
  outcome: Outcome = 'success',
) {
  return {
    eventId: `30000000-0000-4000-8000-${suffix.toString().padStart(12, '0')}`,
    eventType,
    outcome,
    actorDisplay: suffix === 9 ? 'Supervisor •007' : 'Analista •042',
    actorRole: suffix === 9 ? 'supervisor' : 'credit_analyst',
    occurredAt,
    safeMetadata,
  };
}

export function auditResponse(
  evaluationId = auditedEvaluationId,
  scenario: 'evaluated' | 'manual' | 'retry' = 'evaluated',
) {
  const start = event(1, 'EVALUATION_STARTED', '2026-08-03T14:06:00Z', {
    attemptNumber: 1,
    criteriaVersion: 'SCORING-MVP-1.0.0',
    state: 'evaluando',
  });
  const scenarioEvents =
    scenario === 'retry'
      ? [
          event(2, 'EVALUATION_FAILED', '2026-08-03T14:06:01Z', {
            attemptNumber: 1,
            errorCode: 'SCORING_TIMEOUT',
            state: 'error',
          }, 'error'),
          event(3, 'EVALUATION_RETRIED', '2026-08-03T14:08:00Z', {
            attemptNumber: 2,
            retryOfEvaluationId: auditedEvaluationId,
            state: 'evaluando',
          }),
          event(4, 'EVALUATION_COMPLETED', '2026-08-03T14:08:01Z', {
            attemptNumber: 2,
            state: 'evaluada',
            riskBand: 'riesgo_bajo',
          }),
        ]
      : [
          event(2, 'EVALUATION_COMPLETED', '2026-08-03T14:06:01Z', {
            attemptNumber: 1,
            state: scenario === 'manual' ? 'revision_manual' : 'evaluada',
            riskBand: scenario === 'manual' ? 'riesgo_medio' : 'riesgo_bajo',
          }),
        ];
  return {
    evaluationId,
    events: [
      start,
      ...scenarioEvents,
      event(9, 'AUDIT_VIEWED', '2026-08-03T14:10:00Z', {
        state: 'read_only',
      }),
    ],
  };
}
