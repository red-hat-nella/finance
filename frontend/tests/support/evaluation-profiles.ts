export interface EvaluationProfile {
  readonly name: 'low' | 'medium' | 'high';
  readonly score: number;
  readonly riskBand: 'riesgo_bajo' | 'riesgo_medio' | 'riesgo_alto';
  readonly state: 'evaluada' | 'revision_manual';
  readonly recommendation: string;
  readonly contributions: readonly [string, string, string];
}

export const evaluationProfiles: readonly EvaluationProfile[] = [
  {
    name: 'low',
    score: 835,
    riskBand: 'riesgo_bajo',
    state: 'evaluada',
    recommendation: 'Continuar con el análisis crediticio humano.',
    contributions: ['220.000', '165.000', '150.150'],
  },
  {
    name: 'medium',
    score: 634,
    riskBand: 'riesgo_medio',
    state: 'revision_manual',
    recommendation: 'Realizar revisión manual obligatoria.',
    contributions: ['143.000', '99.000', '92.400'],
  },
  {
    name: 'high',
    score: 385,
    riskBand: 'riesgo_alto',
    state: 'evaluada',
    recommendation: 'No continuar sin una revisión reforzada.',
    contributions: ['44.000', '24.750', '16.500'],
  },
];

export function evaluationResponse(profile: EvaluationProfile) {
  const dimensions = ['utility', 'mobile', 'income'] as const;
  return {
    evaluationId: '20000000-0000-4000-8000-000000000001',
    applicationId: '10000000-0000-4000-8000-000000000001',
    revisionNumber: 1,
    attemptNumber: 1,
    state: profile.state,
    score: profile.score,
    scoreScale: { minimum: 300, maximum: 850 },
    riskBand: profile.riskBand,
    recommendation: { code: 'HUMAN_REVIEW', text: profile.recommendation },
    factors: dimensions.map((dimension, index) => ({
      rank: index + 1,
      dimension,
      direction: profile.name === 'high' ? 'unfavorable' : 'favorable',
      dimensionIndex: ['100.000', '91.000', '100.000'][index],
      weight: dimension === 'utility' ? '0.400' : '0.300',
      contributionPoints: profile.contributions[index],
      observedSummary: `Índice ${dimension}`,
      ruleCode: `${dimension.toUpperCase()}_INDEX`,
      explanation: `La dimensión ${dimension} explica su aporte al resultado.`,
    })),
    manualReviewReasons:
      profile.state === 'revision_manual'
        ? ['La banda de riesgo medio requiere revisión humana.']
        : [],
    criteriaVersion: 'SCORING-MVP-1.0.0',
    inputHash: `sha256:${'a'.repeat(64)}`,
    startedAt: '2026-08-04T12:00:00Z',
    completedAt: '2026-08-04T12:00:01Z',
    relatedAttempts: [],
  };
}
