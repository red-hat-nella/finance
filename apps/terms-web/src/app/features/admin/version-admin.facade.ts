import { Injectable, computed, signal } from '@angular/core';

import { TermsVersion, TermsVersionSummary, VersionAdminApiError, VersionAdminApiService, VersionDraftInput } from './version-admin-api.service';

export type VersionAdminState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'list'; readonly items: readonly TermsVersionSummary[] }
  | { readonly kind: 'detail'; readonly version: TermsVersion }
  | { readonly kind: 'saving' }
  | { readonly kind: 'conflict'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

@Injectable({ providedIn: 'root' })
export class VersionAdminFacade {
  readonly state = signal<VersionAdminState>({ kind: 'loading' });
  readonly items = computed(() => {
    const state = this.state();
    return state.kind === 'list' ? state.items : [];
  });
  readonly version = computed(() => {
    const state = this.state();
    return state.kind === 'detail' ? state.version : null;
  });
  readonly message = computed(() => {
    const state = this.state();
    return state.kind === 'conflict' || state.kind === 'error' ? state.message : '';
  });
  private readonly keys = new Map<string, string>();

  constructor(private readonly api: VersionAdminApiService) {}

  async list(): Promise<void> {
    this.state.set({ kind: 'loading' });
    try {
      const items = await this.api.list();
      this.state.set(items.length ? { kind: 'list', items } : { kind: 'empty' });
    } catch (error) { this.fail(error, 'No fue posible cargar las versiones.'); }
  }

  async load(versionId: string): Promise<void> {
    this.state.set({ kind: 'loading' });
    try { this.state.set({ kind: 'detail', version: await this.api.get(versionId) }); }
    catch (error) { this.fail(error, 'No fue posible cargar la versión.'); }
  }

  async createDraft(input: VersionDraftInput): Promise<TermsVersion | null> {
    this.state.set({ kind: 'saving' });
    try {
      const version = await this.api.create(input, this.key(`create:${input.versionCode}`));
      this.keys.delete(`create:${input.versionCode}`);
      this.state.set({ kind: 'detail', version });
      return version;
    } catch (error) { this.fail(error, 'No fue posible guardar el borrador.'); return null; }
  }

  async schedule(versionId: string, effectiveAt: string): Promise<void> {
    this.state.set({ kind: 'saving' });
    try {
      const action = `schedule:${versionId}:${effectiveAt}`;
      const version = await this.api.schedule(versionId, effectiveAt, this.key(action));
      this.keys.delete(action);
      this.state.set({ kind: 'detail', version });
    } catch (error) { this.fail(error, 'No fue posible programar la publicación.'); }
  }

  async withdraw(versionId: string): Promise<void> {
    this.state.set({ kind: 'saving' });
    try {
      const action = `withdraw:${versionId}`;
      const version = await this.api.withdraw(versionId, this.key(action));
      this.keys.delete(action);
      this.state.set({ kind: 'detail', version });
    } catch (error) { this.fail(error, 'No fue posible retirar la versión.'); }
  }

  private key(action: string): string {
    const existing = this.keys.get(action);
    if (existing) return existing;
    const key = crypto.randomUUID();
    this.keys.set(action, key);
    return key;
  }

  private fail(error: unknown, fallback: string): void {
    if (error instanceof VersionAdminApiError && error.status === 409) {
      this.state.set({ kind: 'conflict', message: 'La vigencia entra en conflicto con otra versión. Revisa las fechas.' });
      return;
    }
    this.state.set({ kind: 'error', message: fallback });
  }
}
