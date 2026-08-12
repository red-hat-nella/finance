import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { components } from '../../core/api/generated/terms-public';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';

export type TermsVersionSummary = components['schemas']['TermsVersionSummary'];
export type TermsVersion = components['schemas']['TermsVersion'];
export type VersionDraftInput = components['schemas']['VersionDraftInput'];

export class VersionAdminApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

@Injectable({ providedIn: 'root' })
export class VersionAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(RUNTIME_CONFIG).TERMS_API_BASE_URL}/v1/admin/versions`;

  async list(): Promise<readonly TermsVersionSummary[]> {
    try {
      const result = await firstValueFrom(this.http.get<{ items: TermsVersionSummary[] }>(this.baseUrl));
      return Object.freeze(result.items);
    } catch (error) { throw this.mapError(error); }
  }

  async get(versionId: string): Promise<TermsVersion> {
    try { return await firstValueFrom(this.http.get<TermsVersion>(`${this.baseUrl}/${encodeURIComponent(versionId)}`)); }
    catch (error) { throw this.mapError(error); }
  }

  async create(input: VersionDraftInput, key: string): Promise<TermsVersion> {
    return this.post('', input, key);
  }

  async schedule(versionId: string, effectiveAt: string, key: string): Promise<TermsVersion> {
    return this.post(`/${encodeURIComponent(versionId)}/schedule`, { effectiveAt }, key);
  }

  async withdraw(versionId: string, key: string): Promise<TermsVersion> {
    return this.post(`/${encodeURIComponent(versionId)}/withdraw`, null, key);
  }

  private async post(path: string, body: unknown, key: string): Promise<TermsVersion> {
    try {
      return await firstValueFrom(this.http.post<TermsVersion>(`${this.baseUrl}${path}`, body, {
        headers: new HttpHeaders({ 'X-Request-Id': crypto.randomUUID(), 'Idempotency-Key': key }),
      }));
    } catch (error) { throw this.mapError(error); }
  }

  private mapError(error: unknown): VersionAdminApiError {
    if (!(error instanceof HttpErrorResponse)) return new VersionAdminApiError(0, 'TERMS_SERVICE_UNAVAILABLE');
    const body = error.error && typeof error.error === 'object' ? error.error as Record<string, unknown> : {};
    return new VersionAdminApiError(error.status, typeof body['code'] === 'string' ? body['code'] : 'TERMS_ADMIN_FAILURE');
  }
}
