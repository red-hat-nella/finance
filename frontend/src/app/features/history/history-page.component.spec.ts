import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { HistoryFiltersComponent } from './history-filters.component';
import { HistoryPageComponent } from './history-page.component';
import { HistoryStatesComponent } from './history-states.component';
import { HistoryFacade } from './history.facade';
import type {
  EvaluationHistoryItem,
  HistorySearchInput,
} from './history.models';

const item: EvaluationHistoryItem = {
  evaluationId: '20000000-0000-4000-8000-000000000001',
  completedAt: '2026-08-03T14:06:00Z',
  timezone: 'America/Bogota',
  documentMasked: 'CC ••••••1032',
  displayName: 'Maria P.',
  score: 835,
  riskBand: 'riesgo_bajo',
  state: 'evaluada',
};

class StubHistoryFacade {
  readonly items = signal<readonly EvaluationHistoryItem[]>([item]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filters = signal<HistorySearchInput>({ page: 1 });
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly totalItems = signal(1);
  readonly load = jasmine.createSpy('load');
  readonly retry = jasmine.createSpy('retry');
  readonly clear = jasmine.createSpy('clear');
  readonly goToPage = jasmine.createSpy('goToPage');
}

describe('History UI', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, RouterTestingModule],
    });
  });

  it('preserves invalid values, reports VAL-016/017 equivalents and blocks apply', () => {
    const fixture = TestBed.createComponent(HistoryFiltersComponent);
    const component = fixture.componentInstance;
    const emitted = jasmine.createSpy('filtersApplied');
    component.filtersApplied.subscribe(emitted);
    component.form.patchValue({
      dateFrom: '2026-08-03',
      dateTo: '2026-08-01',
      states: ['invalid' as 'evaluada'],
    });

    component.apply();
    fixture.detectChanges();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.form.getRawValue()).toEqual(
      jasmine.objectContaining({
        dateFrom: '2026-08-03',
        dateTo: '2026-08-01',
        states: ['invalid'],
      }),
    );
    expect(fixture.nativeElement.textContent).toContain(
      'La fecha inicial no puede ser posterior a la final',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Selecciona un estado válido',
    );
  });

  it('emits normalized filters and a distinct clear action', () => {
    const fixture = TestBed.createComponent(HistoryFiltersComponent);
    const component = fixture.componentInstance;
    const applied = jasmine.createSpy('filtersApplied');
    const cleared = jasmine.createSpy('filtersCleared');
    component.filtersApplied.subscribe(applied);
    component.filtersCleared.subscribe(cleared);
    component.form.patchValue({
      documentType: 'CE',
      documentNumber: ' ab123 ',
      states: ['evaluada'],
    });

    component.apply();
    component.clear();

    expect(applied).toHaveBeenCalledWith({
      page: 1,
      applicantIdentifier: { documentType: 'CE', documentNumber: 'AB123' },
      states: ['evaluada'],
    });
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('restores preserved filters when the history view is recreated', () => {
    const fixture = TestBed.createComponent(HistoryFiltersComponent);
    fixture.componentRef.setInput('initialFilters', {
      page: 2,
      evaluationId: '20000000-0000-4000-8000-000000000001',
      applicantIdentifier: { documentType: 'CE', documentNumber: 'AB123' },
      dateFrom: '2026-08-01',
      dateTo: '2026-08-04',
      states: ['revision_manual'],
    } satisfies HistorySearchInput);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      evaluationId: '20000000-0000-4000-8000-000000000001',
      documentType: 'CE',
      documentNumber: 'AB123',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-04',
      states: ['revision_manual'],
    });
  });

  it('renders table, semantic list and stable paginator from facade state', () => {
    const facade = new StubHistoryFacade();
    TestBed.overrideProvider(HistoryFacade, { useValue: facade });
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();

    expect(facade.load).toHaveBeenCalledWith();
    expect(
      fixture.debugElement.query(By.css('app-history-table')),
    ).toBeTruthy();
    expect(fixture.debugElement.query(By.css('app-history-list'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('app-history-paginator')),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Maria P.');
  });

  it('distinguishes initial empty, filtered empty, loading and recoverable error', () => {
    const fixture = TestBed.createComponent(HistoryStatesComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Consultando evaluaciones',
    );

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('filtered', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Aún no hay evaluaciones',
    );

    fixture.componentRef.setInput('filtered', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No encontramos evaluaciones con estos filtros',
    );

    fixture.componentRef.setInput(
      'error',
      'No fue posible cargar el histórico',
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No fue posible cargar el histórico',
    );
    expect(fixture.nativeElement.textContent).toContain('Intentar nuevamente');
    const retry = jasmine.createSpy('retry');
    fixture.componentInstance.retry.subscribe(retry);
    fixture.debugElement.query(By.css('button')).nativeElement.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
