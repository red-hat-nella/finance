import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { paths } from './generated';
import { authInterceptor } from './auth.interceptor';
import { IdempotencyService } from './idempotency.service';
import { mapApiProblem } from './problem-mapper';
import { requestContextInterceptor } from './request-context.interceptor';
import { AuthPort, Session } from '../auth/auth.port';
import { RUNTIME_CONFIG, RuntimeConfig } from '../config/runtime-config';

class TokenAuth extends AuthPort {
  session(): Session {
    return { actorId: 'a', displayName: 'A', roles: ['credit_analyst'] };
  }
  accessToken(): string {
    return 'public-api-token';
  }
  isAuthenticated(): boolean {
    return true;
  }
  signIn(): void {}
  async signOut(): Promise<void> {
    return Promise.resolve();
  }
}

describe('public API boundary', () => {
  const publicPaths: Array<keyof paths> = [
    '/health/live',
    '/health/ready',
    '/api/v1/applications',
    '/api/v1/applications/{applicationId}',
    '/api/v1/applications/{applicationId}/evaluations',
    '/api/v1/evaluations/search',
    '/api/v1/evaluations/{evaluationId}',
    '/api/v1/evaluations/{evaluationId}/audit',
  ];

  it('contains no internal scoring endpoint in generated public types', () => {
    expect(
      publicPaths.some((path) => String(path).includes('/internal/')),
    ).toBeFalse();
  });

  it('adds JWT and a UUID request ID only to the configured public API', () => {
    const config: RuntimeConfig = {
      API_BASE_URL: '/api/v1',
      AUTH_MODE: 'development',
      OIDC_ISSUER: '',
      OIDC_CLIENT_ID: '',
      OIDC_SCOPE: 'openid profile',
      APP_TIMEZONE: 'America/Bogota',
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([requestContextInterceptor, authInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        { provide: AuthPort, useClass: TokenAuth },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    http
      .get('/api/v1/applications/00000000-0000-4000-8000-000000000000')
      .subscribe();
    const apiRequest = controller.expectOne(
      '/api/v1/applications/00000000-0000-4000-8000-000000000000',
    );
    expect(apiRequest.request.headers.get('Authorization')).toBe(
      'Bearer public-api-token',
    );
    expect(apiRequest.request.headers.get('X-Request-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    apiRequest.flush({});

    http.get('/runtime-config.json').subscribe();
    const assetRequest = controller.expectOne('/runtime-config.json');
    expect(assetRequest.request.headers.has('Authorization')).toBeFalse();
    expect(assetRequest.request.headers.has('X-Request-Id')).toBeFalse();
    assetRequest.flush({});
    controller.verify();
  });

  it('keeps idempotency stable per action until completion', () => {
    const service = new IdempotencyService();
    const first = service.forAction('create-application');
    expect(service.forAction('create-application')).toBe(first);
    service.complete('create-application');
    expect(service.forAction('create-application')).not.toBe(first);
  });

  it('maps RFC problem codes without displaying untrusted detail', () => {
    const mapped = mapApiProblem({
      code: 'INTERNAL_FAILURE',
      correlationId: 'c594ca64-2d99-4db7-9d9b-41507075ee45',
      errors: [
        { field: 'applicant.documentNumber', message: 'Revise el formato.' },
      ],
      detail: 'Bearer secret document 1001032',
    });
    expect(mapped.message).not.toContain('secret');
    expect(mapped.correlationId).toBe('c594ca64-2d99-4db7-9d9b-41507075ee45');
    expect(mapped.fieldErrors['applicant.documentNumber']).toBe(
      'Revise el formato.',
    );
  });
});
