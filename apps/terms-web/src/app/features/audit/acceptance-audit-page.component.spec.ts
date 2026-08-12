import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcceptanceAuditFacade, AcceptanceAuditState } from './acceptance-audit.facade';
import { AcceptanceAuditPageComponent } from './acceptance-audit-page.component';

const evidence = {
  acceptanceId: '00000000-0000-4000-8000-000000000401',
  versionId: '00000000-0000-4000-8000-000000000301', versionCode: 'TERMS-2026-01',
  acceptedAt: '2026-08-12T12:00:00Z', contentSha256: 'a'.repeat(64), actorDisplay: 'act***001',
};

class FakeFacade {
  readonly state = signal<AcceptanceAuditState>({ kind: 'loading' });
  readonly items = computed(() => { const state = this.state(); return state.kind === 'results' ? state.items : []; });
  readonly message = computed(() => { const state = this.state(); return state.kind === 'denied' || state.kind === 'unavailable' || state.kind === 'invalid' ? state.message : ''; });
  search = jasmine.createSpy('search').and.callFake(async (filters: { from?: string; to?: string }) => {
    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
      this.state.set({ kind: 'invalid', message: 'Revisa el rango de fechas.' });
    }
  });
}

describe('AcceptanceAuditPageComponent', () => {
  let fixture: ComponentFixture<AcceptanceAuditPageComponent>;
  let facade: FakeFacade;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AcceptanceAuditPageComponent], providers: [{ provide: AcceptanceAuditFacade, useClass: FakeFacade }] }).compileComponents();
    fixture = TestBed.createComponent(AcceptanceAuditPageComponent);
    facade = TestBed.inject(AcceptanceAuditFacade) as unknown as FakeFacade;
    fixture.detectChanges();
  });

  it('passes date filters through validation and displays the result', async () => {
    fixture.componentInstance.filters.patchValue({ from: '2026-08-13', to: '2026-08-12' });
    await fixture.componentInstance.search();
    fixture.detectChanges();
    expect(facade.search).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('rango de fechas');
  });

  it('covers loading, empty, denied and unavailable recovery states', () => {
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    for (const scenario of [
      { state: { kind: 'empty' } as const, text: 'No encontramos aceptaciones' },
      { state: { kind: 'denied', message: 'No tienes permiso' } as const, text: 'No tienes permiso' },
      { state: { kind: 'unavailable', message: 'No fue posible consultar' } as const, text: 'Intentar nuevamente' },
    ]) { facade.state.set(scenario.state); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain(scenario.text); }
  });

  it('renders equivalent read-only table and mobile cards with masked actor', () => {
    facade.state.set({ kind: 'results', items: [evidence], nextCursor: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('table tbody tr').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.acceptance-card').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('act***001');
    expect(fixture.nativeElement.querySelector('button[data-action="modify"]')).toBeNull();
  });
});
