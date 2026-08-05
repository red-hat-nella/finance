import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { EvaluationApiService } from './evaluation-api.service';
import { EvaluationResultPageComponent } from './evaluation-result-page.component';

const evaluationId = '20000000-0000-4000-8000-000000000001';

interface Profile {
  score: number;
  riskBand: 'riesgo_bajo' | 'riesgo_medio' | 'riesgo_alto';
  state: 'evaluada' | 'revision_manual';
  label: string;
  icon: string;
  recommendation: string;
  contributions: [string, string, string];
}

const profiles: readonly Profile[] = [
  {
    score: 835,
    riskBand: 'riesgo_bajo',
    state: 'evaluada',
    label: 'Riesgo bajo',
    icon: '✓',
    recommendation: 'Continuar con el análisis crediticio.',
    contributions: ['220.000', '165.000', '150.150'],
  },
  {
    score: 634,
    riskBand: 'riesgo_medio',
    state: 'revision_manual',
    label: 'Riesgo medio',
    icon: '!',
    recommendation: 'Realizar revisión manual obligatoria.',
    contributions: ['143.000', '99.000', '92.400'],
  },
  {
    score: 385,
    riskBand: 'riesgo_alto',
    state: 'evaluada',
    label: 'Riesgo alto',
    icon: '×',
    recommendation: 'No continuar sin una revisión reforzada.',
    contributions: ['44.000', '24.750', '16.500'],
  },
];

function response(profile: Profile) {
  const dimensions = ['utility', 'mobile', 'income'] as const;
  return {
    evaluationId,
    applicationId: '10000000-0000-4000-8000-000000000001',
    revisionNumber: 1,
    attemptNumber: 1,
    state: profile.state,
    score: profile.score,
    scoreScale: { minimum: 300, maximum: 850 },
    riskBand: profile.riskBand,
    recommendation: { code: 'MANUAL_REVIEW', text: profile.recommendation },
    factors: dimensions.map((dimension, index) => ({
      rank: index + 1,
      dimension,
      direction:
        profile.riskBand === 'riesgo_alto' ? 'unfavorable' : 'favorable',
      dimensionIndex: ['65.000', '56.000', '60.000'][index],
      weight: dimension === 'utility' ? '0.400' : '0.300',
      contributionPoints: profile.contributions[index],
      observedSummary: `Índice ${dimension}`,
      ruleCode: `${dimension.toUpperCase()}_INDEX`,
      explanation: `El factor ${dimension} explica su aporte al resultado.`,
    })),
    manualReviewReasons:
      profile.state === 'revision_manual'
        ? ['La banda de riesgo medio requiere revisión humana.']
        : [],
    criteriaVersion: 'SCORING-MVP-1.0.0',
    inputHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    startedAt: '2026-08-04T12:00:00Z',
    completedAt: '2026-08-04T12:00:01Z',
    relatedAttempts: [],
  };
}

describe('EvaluationResultPageComponent', () => {
  let activeProfile = profiles[0]!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluationResultPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => evaluationId } },
          },
        },
        {
          provide: EvaluationApiService,
          useValue: { get: () => Promise.resolve(response(activeProfile)) },
        },
      ],
    }).compileComponents();
  });

  for (const profile of profiles) {
    it(`renders the ${profile.riskBand} result with explainability`, async () => {
      activeProfile = profile;
      const fixture = TestBed.createComponent(EvaluationResultPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const badge = element.querySelector('app-risk-badge');
      expect(element.querySelector('.score strong')?.textContent?.trim()).toBe(
        profile.score.toString(),
      );
      expect(badge?.textContent).toContain(profile.icon);
      expect(badge?.textContent).toContain(profile.label);
      expect(element.textContent).toContain(profile.recommendation);
      expect(element.textContent).toContain(
        'no constituye una aprobación automática',
      );

      const factors = element.querySelectorAll('.factors li');
      expect(factors.length).toBe(3);
      const contribution = profile.contributions.reduce(
        (sum, value) => sum + Number(value),
        0,
      );
      expect(Math.round(300 + contribution)).toBe(profile.score);
      for (const value of profile.contributions)
        expect(element.textContent).toContain(`${value} puntos`);

      expect(element.textContent).toContain('SCORING-MVP-1.0.0');
      expect(element.querySelector('app-copy-id code')?.textContent).toBe(
        evaluationId,
      );
      expect(
        element.querySelector('app-copy-id button')?.getAttribute('aria-label'),
      ).toBe('Copiar identificador');
    });
  }
});
