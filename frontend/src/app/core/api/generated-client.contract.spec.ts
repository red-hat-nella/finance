import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { operations } from './generated';
import { RUNTIME_CONFIG } from '../config/runtime-config';
import { ApplicationApiService } from '../../features/applications/application-api.service';

type CreateResponse =
  operations['createApplication']['responses'][201]['content']['application/json'];
type EvaluationResponse =
  operations['evaluateApplication']['responses'][201]['content']['application/json'];

describe('generated US1 client contract', () => {
  let http: HttpTestingController;
  let service: ApplicationApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RUNTIME_CONFIG,
          useValue: { API_BASE_URL: '/api/v1', AUTH_MODE: 'development' },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ApplicationApiService);
  });

  afterEach(() => http.verify());

  it('captures create ETag and sends it with the evaluation command', async () => {
    const input = {
      applicant: {
        documentType: 'CC' as const,
        documentNumber: '102341032',
        fullName: 'María Paula Rojas',
        contact: { phone: '+573001112233' },
      },
    };
    const createdPromise = service.create(input);
    const createRequest = http.expectOne('/api/v1/applications');
    expect(createRequest.request.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    const created: CreateResponse = {
      applicationId: '10000000-0000-4000-8000-000000000001',
      state: 'borrador',
      revisionNumber: 1,
      lockVersion: 1,
      createdAt: '2026-08-04T12:00:00Z',
      updatedAt: '2026-08-04T12:00:00Z',
      draftExpiresAt: '2026-11-02T12:00:00Z',
      applicant: {
        ...input.applicant,
        documentMasked: 'CC ••••••1032',
        displayName: 'María R.',
      },
    };
    createRequest.flush(created, { headers: { ETag: '"1"' } });
    const versioned = await createdPromise;
    expect(versioned.etag).toBe('"1"');

    const evaluationPromise = service.evaluate(versioned);
    const evaluationRequest = http.expectOne(
      `/api/v1/applications/${created.applicationId}/evaluations`,
    );
    expect(evaluationRequest.request.headers.get('If-Match')).toBe('"1"');
    expect(evaluationRequest.request.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    const evaluation = {
      evaluationId: '20000000-0000-4000-8000-000000000001',
      state: 'evaluada',
      score: 835,
    } as unknown as EvaluationResponse;
    evaluationRequest.flush(evaluation);
    await expectAsync(evaluationPromise).toBeResolvedTo(evaluation);
  });
});
