import { Injectable, computed, signal } from '@angular/core';
import { AcceptanceAuditApiError, AcceptanceAuditApiService, AcceptanceEvidence, AcceptanceSearch } from './acceptance-audit-api.service';

export type AcceptanceAuditState =
  | { readonly kind: 'loading' } | { readonly kind: 'empty' }
  | { readonly kind: 'results'; readonly items: readonly AcceptanceEvidence[]; readonly nextCursor?: string | null }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'denied'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string };

export function validateAuditFilters(filters: AcceptanceSearch): string | null {
  if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) return 'Revisa el rango de fechas: desde no puede ser posterior a hasta.';
  if (filters.limit < 1 || filters.limit > 100) return 'El límite debe estar entre 1 y 100.';
  return null;
}

@Injectable({ providedIn: 'root' })
export class AcceptanceAuditFacade {
  readonly state = signal<AcceptanceAuditState>({ kind: 'loading' });
  readonly items = computed(() => { const state = this.state(); return state.kind === 'results' ? state.items : []; });
  readonly message = computed(() => { const state = this.state(); return state.kind === 'invalid' || state.kind === 'denied' || state.kind === 'unavailable' ? state.message : ''; });
  constructor(private readonly api: AcceptanceAuditApiService) {}
  async search(filters: AcceptanceSearch): Promise<void> {
    const validation = validateAuditFilters(filters);
    if (validation) { this.state.set({ kind: 'invalid', message: validation }); return; }
    this.state.set({ kind: 'loading' });
    try {
      const result = await this.api.search(filters);
      this.state.set(result.items.length ? { kind: 'results', ...result } : { kind: 'empty' });
    } catch (error) {
      if (error instanceof AcceptanceAuditApiError && error.status === 403) this.state.set({ kind: 'denied', message: 'No tienes permiso para consultar aceptaciones de este ámbito.' });
      else this.state.set({ kind: 'unavailable', message: 'No fue posible consultar las aceptaciones. Intenta nuevamente.' });
    }
  }
}
