import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { components } from './generated/terms-public';
import { RUNTIME_CONFIG } from '../config/runtime-config';

export type CurrentTerms = components['schemas']['CurrentTerms'];
export type TermsVersion = components['schemas']['TermsVersion'];
export type Acceptance = components['schemas']['Acceptance'];

export class TermsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

@Injectable({ providedIn: 'root' })
export class TermsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(RUNTIME_CONFIG).TERMS_API_BASE_URL;

  async getCurrent(): Promise<CurrentTerms> {
    try {
      return await firstValueFrom(this.http.get<CurrentTerms>(`${this.baseUrl}/v1/current`, {
        headers: new HttpHeaders({ 'X-Request-Id': crypto.randomUUID() }),
      }));
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  async accept(version: TermsVersion, idempotencyKey: string): Promise<Acceptance> {
    try {
      return await firstValueFrom(this.http.post<Acceptance>(`${this.baseUrl}/v1/acceptances`, {
        versionId: version.versionId,
        contentSha256: version.contentSha256,
      }, { headers: new HttpHeaders({
        'X-Request-Id': crypto.randomUUID(),
        'Idempotency-Key': idempotencyKey,
      }) }));
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  private toApiError(error: unknown): TermsApiError {
    if (!(error instanceof HttpErrorResponse)) {
      return new TermsApiError(0, 'TERMS_SERVICE_UNAVAILABLE', true);
    }
    const body = error.error && typeof error.error === 'object'
      ? error.error as Record<string, unknown>
      : {};
    const code = typeof body['code'] === 'string' ? body['code'] : 'TERMS_SERVICE_UNAVAILABLE';
    return new TermsApiError(error.status, code, body['retryable'] !== false);
  }
}
