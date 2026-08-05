import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { By } from '@angular/platform-browser';
import type { components } from '../../core/api/generated';
import { AuditFacade } from './audit.facade';
import { AuditPageComponent } from './audit-page.component';

type AuditEvent = components['schemas']['AuditEvent'];
const evaluationId = '20000000-0000-4000-8000-000000000001';
const events: AuditEvent[] = [
  {
    eventId: '30000000-0000-4000-8000-000000000001',
    eventType: 'EVALUATION_STARTED',
    outcome: 'success',
    actorDisplay: 'Analista •042',
    actorRole: 'credit_analyst',
    occurredAt: '2026-08-03T14:06:00Z',
    safeMetadata: {
      attemptNumber: 1,
      criteriaVersion: 'SCORING-MVP-1.0.0',
    },
  },
  {
    eventId: '30000000-0000-4000-8000-000000000002',
    eventType: 'EVALUATION_RETRIED',
    outcome: 'success',
    actorDisplay: 'Supervisor •007',
    actorRole: 'supervisor',
    occurredAt: '2026-08-03T14:08:00Z',
    safeMetadata: { attemptNumber: 2 },
  },
];

class StubAuditFacade {
  readonly events = signal<readonly AuditEvent[]>(events);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly load = jasmine.createSpy('load');
}

describe('AuditPageComponent', () => {
  let facade: StubAuditFacade;

  beforeEach(() => {
    facade = new StubAuditFacade();
    TestBed.configureTestingModule({ imports: [NoopAnimationsModule] });
    TestBed.overrideComponent(AuditPageComponent, {
      set: { providers: [{ provide: AuditFacade, useValue: facade }] },
    });
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          paramMap: { get: (name: string) => (name === 'id' ? evaluationId : null) },
        },
      },
    });
    TestBed.overrideProvider(Location, {
      useValue: { back: jasmine.createSpy('back') },
    });
  });

  it('renders the read-only vertical timeline, retry and expandable safe metadata', () => {
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();

    expect(facade.load).toHaveBeenCalledOnceWith(evaluationId);
    const items = fixture.debugElement.queryAll(By.css('.timeline > li'));
    expect(items.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Evaluación iniciada');
    expect(fixture.nativeElement.textContent).toContain('Evaluación reintentada');
    expect(fixture.nativeElement.textContent).toContain('Analista •042');
    expect(fixture.debugElement.queryAll(By.css('details')).length).toBe(2);
    expect(fixture.nativeElement.textContent).not.toMatch(/Crear|Editar|Evaluar|Reintentar/);
  });

  it('shows loading, recoverable error and empty states without losing context', () => {
    facade.loading.set(true);
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Consultando trazabilidad');

    facade.loading.set(false);
    facade.error.set('No fue posible consultar la trazabilidad.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No fue posible consultar');
    fixture.debugElement.query(By.css('app-error-state button')).nativeElement.click();
    expect(facade.load).toHaveBeenCalledTimes(2);

    facade.error.set('');
    facade.events.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay eventos disponibles');
    expect(fixture.nativeElement.textContent).toContain(evaluationId);
  });
});
