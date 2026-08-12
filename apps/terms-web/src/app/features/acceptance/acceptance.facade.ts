import { Injectable, computed, signal } from '@angular/core';

import { TermsApiError, TermsApiService, TermsVersion } from '../../core/api/terms-api.service';
import { AuthPort } from '../../core/auth/auth.port';

export type AcceptanceViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'document'; readonly version: TermsVersion }
  | { readonly kind: 'accepting'; readonly version: TermsVersion }
  | { readonly kind: 'success'; readonly acceptedAt: string }
  | { readonly kind: 'changed' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'unavailable'; readonly retryable: boolean };

@Injectable({ providedIn: 'root' })
export class AcceptanceFacade {
  readonly state = signal<AcceptanceViewState>({ kind: 'loading' });
  readonly version = computed(() => {
    const state = this.state();
    return state.kind === 'document' || state.kind === 'accepting' ? state.version : null;
  });
  readonly retryable = computed(() => {
    const state = this.state();
    return state.kind === 'unavailable' && state.retryable;
  });
  private idempotency?: { readonly versionId: string; readonly key: string };

  constructor(
    private readonly api: TermsApiService,
    private readonly auth: AuthPort,
  ) {}

  async load(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.state.set({ kind: 'expired' });
      return;
    }
    this.state.set({ kind: 'loading' });
    try {
      const current = await this.api.getCurrent();
      if (current.acceptanceStatus === 'ACCEPTED' && current.acceptedAt) {
        this.state.set({ kind: 'success', acceptedAt: current.acceptedAt });
        return;
      }
      this.state.set({ kind: 'document', version: current.version });
    } catch (error) {
      this.handleError(error);
    }
  }

  async accept(): Promise<void> {
    const current = this.state();
    if (current.kind !== 'document') return;
    const version = current.version;
    const idempotencyKey = this.keyFor(version.versionId);
    this.state.set({ kind: 'accepting', version });
    try {
      const acceptance = await this.api.accept(version, idempotencyKey);
      this.idempotency = undefined;
      this.state.set({ kind: 'success', acceptedAt: acceptance.acceptedAt });
    } catch (error) {
      if (error instanceof TermsApiError && error.code === 'TERMS_VERSION_CHANGED') {
        this.idempotency = undefined;
        this.state.set({ kind: 'changed' });
        return;
      }
      this.handleError(error);
    }
  }

  private keyFor(versionId: string): string {
    if (!this.idempotency || this.idempotency.versionId !== versionId) {
      this.idempotency = { versionId, key: crypto.randomUUID() };
    }
    return this.idempotency.key;
  }

  private handleError(error: unknown): void {
    if (error instanceof TermsApiError && error.status === 401) {
      this.state.set({ kind: 'expired' });
      return;
    }
    this.state.set({
      kind: 'unavailable',
      retryable: !(error instanceof TermsApiError) || error.retryable,
    });
  }
}
