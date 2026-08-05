import { DatePipe, Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';
import type { components } from '../../core/api/generated';
import { CopyIdComponent } from '../../shared/ui/copy-id.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state.component';
import { AuditFacade } from './audit.facade';

type AuditEvent = components['schemas']['AuditEvent'];

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    CopyIdComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  providers: [AuditFacade],
  template: `
    <div class="audit-page">
      <div class="page-header">
        <div>
          <button mat-button type="button" class="back" (click)="goBack()">
            Volver al detalle
          </button>
          <h1 tabindex="-1">Trazabilidad de evaluación</h1>
          <p>
            Identificador
            <app-copy-id [value]="evaluationId" />
          </p>
        </div>
      </div>

      <section class="surface audit-surface" aria-labelledby="timeline-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Registro inmutable</p>
            <h2 id="timeline-title">Eventos de la evaluación</h2>
          </div>
          @if (!facade.loading() && !facade.error()) {
            <span class="event-count">{{ facade.events().length }} eventos</span>
          }
        </div>

        @if (facade.loading()) {
          <app-loading-state label="Consultando trazabilidad" />
        } @else if (facade.error()) {
          <app-error-state
            [message]="facade.error()"
            (retry)="facade.load(evaluationId)"
          />
        } @else if (!facade.events().length) {
          <app-empty-state
            title="No hay eventos disponibles"
            message="La evaluación no tiene eventos visibles para consulta."
          />
        } @else {
          <ol class="timeline" aria-label="Eventos en orden cronológico">
            @for (event of facade.events(); track event.eventId) {
              <li>
                <span
                  class="timeline-marker"
                  [class.error]="event.outcome === 'error'"
                  [class.denied]="event.outcome === 'denied' || event.outcome === 'blocked'"
                  aria-hidden="true"
                ></span>
                <article>
                  <div class="event-heading">
                    <div>
                      <h3>{{ eventLabel(event.eventType) }}</h3>
                      <p>{{ event.actorDisplay }} · {{ roleLabel(event.actorRole) }}</p>
                    </div>
                    <span class="outcome" [attr.data-outcome]="event.outcome">
                      {{ outcomeLabel(event.outcome) }}
                    </span>
                  </div>
                  <time [attr.datetime]="event.occurredAt">
                    {{ event.occurredAt | date: 'dd/MM/yyyy, HH:mm:ss' : 'America/Bogota' }}
                  </time>
                  @if (metadataEntries(event).length) {
                    <details>
                      <summary>Ver metadatos operativos</summary>
                      <dl>
                        @for (entry of metadataEntries(event); track entry.key) {
                          <div>
                            <dt>{{ metadataLabel(entry.key) }}</dt>
                            <dd>{{ entry.value }}</dd>
                          </div>
                        }
                      </dl>
                    </details>
                  }
                </article>
              </li>
            }
          </ol>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .audit-page { max-width: 960px; margin: 0 auto; }
      .back { min-height: 44px; margin: 0 0 var(--space-2) calc(var(--space-3) * -1); }
      .audit-surface { overflow: hidden; }
      .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); padding: var(--space-8); border-bottom: 1px solid var(--color-border); }
      .section-heading h2, .section-heading p { margin-bottom: 0; }
      .event-count { white-space: nowrap; color: var(--color-text-muted); font-size: 0.875rem; }
      .timeline { list-style: none; margin: 0; padding: var(--space-2) var(--space-8) var(--space-8); }
      .timeline li { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: var(--space-4); padding-top: var(--space-6); }
      .timeline li:not(:last-child)::before { content: ''; position: absolute; left: 9px; top: 42px; bottom: -24px; width: 2px; background: var(--color-border); }
      .timeline-marker { width: 20px; height: 20px; margin-top: 2px; border: 5px solid var(--color-primary-soft); border-radius: 50%; background: var(--color-primary); z-index: 1; }
      .timeline-marker.error { border-color: var(--color-danger-bg); background: var(--color-danger); }
      .timeline-marker.denied { border-color: var(--color-warning-bg); background: var(--color-warning); }
      article { min-width: 0; padding: 0 0 var(--space-6); border-bottom: 1px solid var(--color-border); }
      .event-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }
      h3 { margin: 0; font-size: 1rem; line-height: 1.5; }
      .event-heading p, time { color: var(--color-text-muted); font-size: 0.875rem; }
      .event-heading p { margin: var(--space-1) 0 0; }
      time { display: block; margin-top: var(--space-2); }
      details { margin-top: var(--space-3); }
      summary { width: fit-content; min-height: 44px; display: flex; align-items: center; color: var(--color-primary); cursor: pointer; font-size: 0.875rem; font-weight: 600; }
      .outcome { flex: 0 0 auto; padding: 2px 8px; border-radius: 4px; color: var(--color-success-text); background: var(--color-success-bg); font-size: 0.75rem; font-weight: 700; }
      .outcome[data-outcome='error'] { color: var(--color-danger); background: var(--color-danger-bg); }
      .outcome[data-outcome='denied'], .outcome[data-outcome='blocked'] { color: var(--color-warning-text); background: var(--color-warning-bg); }
      dl { display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-6); margin: var(--space-4) 0 0; }
      dl div { min-width: 140px; max-width: 100%; }
      dt { color: var(--color-text-muted); font-size: 0.75rem; }
      dd { margin: 2px 0 0; font-size: 0.875rem; overflow-wrap: anywhere; }
      @media (max-width: 599px) {
        .section-heading, .timeline { padding-inline: var(--space-4); }
        .section-heading, .event-heading { align-items: flex-start; flex-direction: column; }
        .timeline li { gap: var(--space-3); }
        dl { display: grid; grid-template-columns: minmax(0, 1fr); }
      }
    `,
  ],
})
export class AuditPageComponent {
  readonly facade = inject(AuditFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.facade.load(this.evaluationId);
  }

  goBack(): void { this.location.back(); }

  metadataEntries(event: AuditEvent): { key: string; value: string | number | boolean | null }[] {
    return Object.entries(event.safeMetadata).map(([key, value]) => ({ key, value }));
  }

  eventLabel(type: string): string {
    return EVENT_LABELS[type] ?? type.replaceAll('_', ' ').toLocaleLowerCase('es-CO');
  }

  roleLabel(role: AuditEvent['actorRole']): string {
    return role === 'credit_analyst' ? 'Analista' : role === 'supervisor' ? 'Supervisor' : role === 'auditor' ? 'Auditor' : 'Sistema';
  }

  outcomeLabel(outcome: AuditEvent['outcome']): string {
    return outcome === 'success' ? 'Exitoso' : outcome === 'denied' ? 'Denegado' : outcome === 'blocked' ? 'Bloqueado' : 'Error';
  }

  metadataLabel(key: string): string {
    return METADATA_LABELS[key] ?? key;
  }
}

const EVENT_LABELS: Record<string, string> = {
  APPLICATION_CREATED: 'Solicitud creada',
  APPLICATION_UPDATED: 'Solicitud actualizada',
  CONSENT_RECORDED: 'Consentimiento registrado',
  EVALUATION_STARTED: 'Evaluación iniciada',
  EVALUATION_COMPLETED: 'Evaluación completada',
  EVALUATION_FAILED: 'Evaluación con error',
  EVALUATION_RETRIED: 'Evaluación reintentada',
  EVALUATION_VIEWED: 'Detalle consultado',
  HISTORY_SEARCHED: 'Histórico consultado',
  AUDIT_VIEWED: 'Trazabilidad consultada',
  RETENTION_COMPLETED: 'Retención ejecutada',
};

const METADATA_LABELS: Record<string, string> = {
  revisionNumber: 'Revisión', attemptNumber: 'Intento', state: 'Estado',
  riskBand: 'Banda de riesgo', criteriaVersion: 'Versión de criterios',
  errorCode: 'Código operativo', filterTypes: 'Filtros', resultCount: 'Resultados',
  fromStatus: 'Estado anterior', toStatus: 'Estado nuevo', retryOfEvaluationId: 'Intento anterior',
};
