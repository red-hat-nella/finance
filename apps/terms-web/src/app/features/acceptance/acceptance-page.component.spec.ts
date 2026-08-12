import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthPort, Session } from '../../core/auth/auth.port';
import { AcceptanceFacade, AcceptanceViewState } from './acceptance.facade';
import { AcceptancePageComponent } from './acceptance-page.component';

const version = {
  versionId: '00000000-0000-4000-8000-000000000101',
  versionCode: 'TERMS-2026-01',
  title: 'Términos y condiciones',
  contentSha256: 'a'.repeat(64),
  state: 'EFFECTIVE' as const,
  effectiveAt: '2026-08-12T00:00:00.000Z',
  publishedAt: '2026-08-01T00:00:00.000Z',
  contentFormat: 'markdown' as const,
  content: '# Alcance\n\nTexto completo.\n\n- Primera condición\n- Segunda condición',
};

class FakeFacade {
  readonly state = signal<AcceptanceViewState>({ kind: 'loading' });
  readonly version = computed(() => {
    const state = this.state();
    return state.kind === 'document' || state.kind === 'accepting' ? state.version : null;
  });
  readonly retryable = computed(() => {
    const state = this.state();
    return state.kind === 'unavailable' && state.retryable;
  });
  load = jasmine.createSpy('load');
  accept = jasmine.createSpy('accept');
}

class FakeAuth extends AuthPort {
  signOut = jasmine.createSpy('signOut').and.resolveTo();
  session(): Session | null { return { actorId: 'synthetic', displayName: 'Sintética', roles: ['credit_analyst'] }; }
  accessToken(): string | null { return 'synthetic-token'; }
  isAuthenticated(): boolean { return true; }
  signIn(): void {}
}

describe('AcceptancePageComponent', () => {
  let fixture: ComponentFixture<AcceptancePageComponent>;
  let facade: FakeFacade;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptancePageComponent],
      providers: [
        provideRouter([]),
        { provide: AcceptanceFacade, useClass: FakeFacade },
        { provide: AuthPort, useClass: FakeAuth },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AcceptancePageComponent);
    facade = TestBed.inject(AcceptanceFacade) as unknown as FakeFacade;
    fixture.detectChanges();
  });

  it('loads on entry and presents a stable skeleton', () => {
    expect(facade.load).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('terms-action-bar button[type="submit"]').disabled).toBeTrue();
  });

  it('renders a long semantic document without requiring scroll completion', () => {
    facade.state.set({ kind: 'document', version });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('article h1')?.textContent).toContain(version.title);
    expect(fixture.nativeElement.querySelector('article h2')?.textContent).toContain('Alcance');
    expect(fixture.nativeElement.querySelectorAll('article li').length).toBe(2);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeFalse();
  });

  it('renders raw HTML as inert text instead of executable markup', () => {
    facade.state.set({ kind: 'document', version: { ...version, content: '# Seguro\n\n<script>alert(1)</script>' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('article script')).toBeNull();
    expect(fixture.nativeElement.querySelector('.legal-copy')?.textContent).toContain('<script>alert(1)</script>');
  });

  it('disables duplicate acceptance while accepting', () => {
    facade.state.set({ kind: 'accepting', version });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Guardando');
  });

  for (const scenario of [
    { state: { kind: 'success', acceptedAt: '2026-08-12T12:00:00Z' } as const, text: 'Términos aceptados' },
    { state: { kind: 'changed' } as const, text: 'Los términos cambiaron' },
    { state: { kind: 'expired' } as const, text: 'sesión expiró' },
    { state: { kind: 'unavailable', retryable: true } as const, text: 'No podemos verificar' },
  ]) {
    it(`announces the ${scenario.state.kind} state`, () => {
      facade.state.set(scenario.state);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"], [role="status"]')?.textContent).toContain(scenario.text);
      expect(fixture.nativeElement.querySelector('[data-action="exit"]')).not.toBeNull();
    });
  }
});
