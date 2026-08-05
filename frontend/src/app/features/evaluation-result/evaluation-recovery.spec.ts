import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { EvaluationDetail } from './evaluation-api.service';
import { EvaluationApiService } from './evaluation-api.service';
import { EvaluationErrorComponent } from './evaluation-error.component';
import { EvaluationRecoveryFacade } from './evaluation-recovery.facade';
import { ManualReviewComponent } from './manual-review.component';

const base = {
  evaluationId: '20000000-0000-4000-8000-000000000001',
  applicationId: '10000000-0000-4000-8000-000000000001',
  revisionNumber: 1,
  attemptNumber: 1,
  scoreScale: { minimum: 300 as const, maximum: 850 as const },
  criteriaVersion: 'SCORING-MVP-1.0.0' as const,
  inputHash: `sha256:${'a'.repeat(64)}`,
  startedAt: '2026-08-04T12:00:00Z',
  completedAt: '2026-08-04T12:00:01Z',
  timezone: 'America/Bogota' as const,
  applicantSummary: { documentMasked: 'CC •••••1032', displayName: 'María P.' },
  relatedAttempts: [],
};

describe('US2 evaluation recovery views', () => {
  it('renders manual review without inventing a score and lists reasons', async () => {
    await TestBed.configureTestingModule({ imports: [ManualReviewComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ManualReviewComponent);
    fixture.componentInstance.result = {
      ...base,
      state: 'revision_manual',
      score: null,
      riskBand: null,
      recommendation: { code: 'MANUAL_REVIEW_REQUIRED', text: 'Realizar revisión manual obligatoria' },
      factors: [],
      manualReviewReasons: [{ code: 'MISSING_MOBILE_DATA', dimension: 'mobile', message: 'No se declararon datos suficientes de telefonía móvil.' }],
    } as EvaluationDetail;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin score concluyente');
    expect(fixture.nativeElement.textContent).toContain('No se declararon datos suficientes');
    expect(fixture.nativeElement.querySelector('.score')).toBeNull();
  });

  it('keeps retry labels stable and exposes only safe operational identifiers', async () => {
    await TestBed.configureTestingModule({ imports: [EvaluationErrorComponent, NoopAnimationsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EvaluationErrorComponent);
    fixture.componentInstance.errorCode = 'SCORING_TIMEOUT';
    fixture.componentInstance.correlationId = '50000000-0000-4000-8000-000000000001';
    fixture.componentInstance.retrying = true;
    fixture.detectChanges();
    const slot = fixture.nativeElement.querySelector('.button-slot') as HTMLElement;
    expect(slot.textContent).toContain('Reintentando');
    expect(slot.querySelector('mat-spinner')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('token');
    expect(fixture.nativeElement.textContent).not.toContain('password');
  });

  it('blocks a second retry while the first request is pending', async () => {
    let resolve!: (value: EvaluationDetail) => void;
    const api = {
      retry: jasmine.createSpy('retry').and.returnValue(
        new Promise<EvaluationDetail>((done) => { resolve = done; }),
      ),
    };
    const facade = new EvaluationRecoveryFacade(api as unknown as EvaluationApiService);
    const first = facade.retry(base.evaluationId);
    await expectAsync(facade.retry(base.evaluationId)).toBeRejectedWithError('El reintento ya está en curso.');
    resolve({} as EvaluationDetail);
    await first;
    expect(api.retry).toHaveBeenCalledTimes(1);
  });
});
