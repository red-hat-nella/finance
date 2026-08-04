import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from '../../core/config/runtime-config';
import { HistoryApiService } from './history-api.service';
import type { EvaluationHistoryPage } from './history.models';

describe('HistoryApiService contract', () => {
  const config: RuntimeConfig = {
    API_BASE_URL: '/api/v1',
    AUTH_MODE: 'development',
    OIDC_ISSUER: '',
    OIDC_CLIENT_ID: 'alternative-credit-scoring-web',
    OIDC_SCOPE: 'openid profile',
    APP_TIMEZONE: 'America/Bogota',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
      ],
    });
  });

  it('posts filters in the body and consumes the minimized page shape', () => {
    const api = TestBed.inject(HistoryApiService);
    const http = TestBed.inject(HttpTestingController);
    const page: EvaluationHistoryPage = {
      items: [
        {
          evaluationId: '20000000-0000-4000-8000-000000000001',
          completedAt: '2026-08-03T14:06:00.312Z',
          timezone: 'America/Bogota',
          documentMasked: 'CC ••••••1032',
          displayName: 'Maria P.',
          score: 835,
          riskBand: 'riesgo_bajo',
          state: 'evaluada',
        },
      ],
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    };
    let received: EvaluationHistoryPage | undefined;

    api
      .search({
        page: 1,
        applicantIdentifier: { documentType: 'CC', documentNumber: '1001032' },
      })
      .subscribe((result) => (received = result));

    const request = http.expectOne('/api/v1/evaluations/search');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      page: 1,
      applicantIdentifier: { documentType: 'CC', documentNumber: '1001032' },
    });
    expect(request.request.urlWithParams).not.toContain('1001032');
    request.flush(page);
    expect(received).toEqual(page);
    http.verify();
  });

  it('consumes evaluation detail through the public boundary', () => {
    const api = TestBed.inject(HistoryApiService);
    const http = TestBed.inject(HttpTestingController);
    const evaluationId = '20000000-0000-4000-8000-000000000001';

    api.getEvaluation(evaluationId).subscribe();

    const request = http.expectOne(`/api/v1/evaluations/${evaluationId}`);
    expect(request.request.method).toBe('GET');
    request.flush({
      evaluationId,
      applicationId: '10000000-0000-4000-8000-000000000001',
      revisionNumber: 1,
      attemptNumber: 1,
      state: 'evaluada',
      score: 835,
      scoreScale: { minimum: 300, maximum: 850 },
      riskBand: 'riesgo_bajo',
      recommendation: {
        code: 'CONTINUE_HUMAN_ANALYSIS',
        text: 'Continuar con el análisis crediticio humano.',
      },
      factors: [],
      manualReviewReasons: [],
      criteriaVersion: 'SCORING-MVP-1.0.0',
      inputHash: `sha256:${'a'.repeat(64)}`,
      startedAt: '2026-08-03T14:06:00Z',
      completedAt: '2026-08-03T14:06:00.100Z',
      timezone: 'America/Bogota',
      applicantSummary: {
        documentMasked: 'CC ••••••1032',
        displayName: 'Maria P.',
      },
      relatedAttempts: [],
    });
    http.verify();
  });
});
