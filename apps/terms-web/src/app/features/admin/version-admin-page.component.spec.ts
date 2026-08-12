import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TermsVersionSummary } from './version-admin-api.service';
import { VersionAdminFacade, VersionAdminState } from './version-admin.facade';
import { VersionAdminPageComponent } from './version-admin-page.component';
import { VersionEditorComponent } from './version-editor.component';

const draft: TermsVersionSummary = {
  versionId: '00000000-0000-4000-8000-000000000301',
  versionCode: 'TERMS-2026-02', title: 'Actualización 2026', contentSha256: 'b'.repeat(64),
  state: 'DRAFT', effectiveAt: null,
};

class FakeFacade {
  readonly state = signal<VersionAdminState>({ kind: 'loading' });
  readonly items = computed(() => { const state = this.state(); return state.kind === 'list' ? state.items : []; });
  readonly version = computed(() => { const state = this.state(); return state.kind === 'detail' ? state.version : null; });
  readonly message = computed(() => { const state = this.state(); return state.kind === 'conflict' || state.kind === 'error' ? state.message : ''; });
  list = jasmine.createSpy('list');
  load = jasmine.createSpy('load');
  createDraft = jasmine.createSpy('createDraft');
  schedule = jasmine.createSpy('schedule');
  withdraw = jasmine.createSpy('withdraw');
}

describe('VersionAdminPageComponent', () => {
  let fixture: ComponentFixture<VersionAdminPageComponent>;
  let facade: FakeFacade;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersionAdminPageComponent],
      providers: [provideRouter([]), { provide: VersionAdminFacade, useClass: FakeFacade }],
    }).compileComponents();
    fixture = TestBed.createComponent(VersionAdminPageComponent);
    facade = TestBed.inject(VersionAdminFacade) as unknown as FakeFacade;
    fixture.detectChanges();
  });

  it('covers loading, empty, conflict and recoverable error states', () => {
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    for (const scenario of [
      { state: { kind: 'empty' } as const, text: 'No hay versiones' },
      { state: { kind: 'conflict', message: 'La vigencia entra en conflicto' } as const, text: 'conflicto' },
      { state: { kind: 'error', message: 'No fue posible cargar' } as const, text: 'No fue posible' },
    ]) {
      facade.state.set(scenario.state);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(scenario.text);
    }
  });

  it('renders equivalent desktop table and mobile cards', () => {
    facade.state.set({ kind: 'list', items: [draft] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('table tbody tr').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.version-card').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain(draft.versionCode);
  });
});

describe('VersionEditorComponent', () => {
  let fixture: ComponentFixture<VersionEditorComponent>;
  let facade: FakeFacade;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersionEditorComponent],
      providers: [provideRouter([]), { provide: VersionAdminFacade, useClass: FakeFacade }],
    }).compileComponents();
    fixture = TestBed.createComponent(VersionEditorComponent);
    facade = TestBed.inject(VersionAdminFacade) as unknown as FakeFacade;
    fixture.detectChanges();
  });

  it('rejects missing and malformed draft fields', async () => {
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(facade.createDraft).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Revisa los campos');
  });

  it('previews Markdown as inert semantic content', () => {
    fixture.componentInstance.form.setValue({
      versionCode: 'TERMS-2026-02', title: 'Título sintético',
      content: '# Sección\n\n<script>alert(1)</script>\n\n- Regla uno',
    });
    fixture.componentInstance.showPreview.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.preview h2')?.textContent).toContain('Sección');
    expect(fixture.nativeElement.querySelector('.preview script')).toBeNull();
    expect(fixture.nativeElement.querySelector('.preview')?.textContent).toContain('<script>alert(1)</script>');
  });
});
