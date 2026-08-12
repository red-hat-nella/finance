import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { components } from '../../core/api/generated/terms-public';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';

export type AcceptanceSearch = components['schemas']['AcceptanceSearch'];
export type AcceptanceEvidence = components['schemas']['Acceptance'];
export interface AcceptanceSearchResult { readonly items: readonly AcceptanceEvidence[]; readonly nextCursor?: string | null; }
export class AcceptanceAuditApiError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }

@Injectable({ providedIn: 'root' })
export class AcceptanceAuditApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(RUNTIME_CONFIG).TERMS_API_BASE_URL}/v1/audit/acceptances/search`;
  async search(filters: AcceptanceSearch): Promise<AcceptanceSearchResult> {
    try {
      const result = await firstValueFrom(this.http.post<{ items: AcceptanceEvidence[]; nextCursor?: string | null }>(this.url, filters));
      return Object.freeze({ items: Object.freeze(result.items), nextCursor: result.nextCursor });
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw new AcceptanceAuditApiError(0, 'TERMS_SERVICE_UNAVAILABLE');
      const body = error.error && typeof error.error === 'object' ? error.error as Record<string, unknown> : {};
      throw new AcceptanceAuditApiError(error.status, typeof body['code'] === 'string' ? body['code'] : 'TERMS_AUDIT_FAILURE');
    }
  }
}
