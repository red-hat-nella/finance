import { DatePipe, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { components } from '../../core/api/generated';
import { mapApiProblem } from '../../core/api/problem-mapper';
import { CopyIdComponent } from '../../shared/ui/copy-id.component';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state.component';
import { FactorListComponent } from '../evaluation-result/factor-list.component';
import { ScoreSummaryComponent } from '../evaluation-result/score-summary.component';
import { HistoryApiService } from '../history/history-api.service';

type EvaluationDetail = components['schemas']['EvaluationDetail'];
type GeneratedSnapshot = NonNullable<EvaluationDetail['inputSnapshot']>;
type GeneratedApplicant = GeneratedSnapshot['applicant'];
type EvaluationDetailView = Omit<EvaluationDetail, 'inputSnapshot'> & {
  inputSnapshot:
    | (Omit<GeneratedSnapshot, 'applicant' | 'alternativeData'> & {
        applicant: Omit<GeneratedApplicant, 'contact'> & {
          contact: { phone?: string; email?: string };
        };
        alternativeData?: unknown;
      })
    | null;
};
type UnavailableData = { availability: 'unavailable'; reason: string };
type AlternativeData = {
  income?:
    | UnavailableData
    | {
        availability: 'provided';
        monthlyIncomeCop: string;
        stabilityMonths: number;
      };
  utilities?:
    | UnavailableData
    | { availability: 'provided'; references: readonly unknown[] };
  mobile?:
    | UnavailableData
    | {
        availability: 'provided';
        mode: 'prepaid' | 'postpaid';
        tenureMonths: number;
      };
};

@Component({
  selector: 'app-evaluation-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    RouterLink,
    CopyIdComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    FactorListComponent,
    ScoreSummaryComponent,
  ],
  template: `
    <div class="detail-page">
      <div class="page-header">
        <div>
          <button mat-button type="button" class="back" (click)="goBack()">
            Volver al histórico
          </button>
          <h1 tabindex="-1">Detalle de evaluación</h1>
          <p>
            Identificador
            <app-copy-id [value]="evaluationId" />
          </p>
        </div>
        <a mat-flat-button color="primary" routerLink="/applications/new"
          >Nueva solicitud</a
        >
      </div>

      @if (loading()) {
        <app-loading-state label="Consultando detalle de evaluación" />
      } @else if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else {
        @if (detail(); as evaluation) {
          <article
            class="detail-surface surface"
            aria-labelledby="result-title"
          >
            @if (evaluation.state === 'error') {
              <section class="evaluation-error" aria-labelledby="result-title">
                <p class="eyebrow">Resultado operativo</p>
                <h2 id="result-title">No fue posible calcular el score</h2>
                <p>
                  La evaluación conserva su trazabilidad y no emite una
                  recomendación definitiva. Revise el intento antes de
                  continuar.
                </p>
              </section>
            } @else {
              <h2 id="result-title" class="sr-only">Resultado</h2>
              <app-score-summary [result]="evaluation" />
            }

            @if (evaluation.manualReviewReasons.length) {
              <section
                class="section manual-review"
                aria-labelledby="reasons-title"
              >
                <h2 id="reasons-title">Motivos de revisión manual</h2>
                <ul>
                  @for (
                    reason of evaluation.manualReviewReasons;
                    track reason.code
                  ) {
                    <li>{{ reason.message }}</li>
                  }
                </ul>
              </section>
            }

            @if (evaluation.factors.length) {
              <app-factor-list [factors]="evaluation.factors" />
            } @else if (evaluation.state !== 'error') {
              <section class="section" aria-labelledby="factors-empty-title">
                <h2 id="factors-empty-title">Factores explicativos</h2>
                <p>
                  No hay factores calculados porque los datos requieren revisión
                  manual.
                </p>
              </section>
            }

            <section class="section" aria-labelledby="trace-title">
              <h2 id="trace-title">Trazabilidad del resultado</h2>
              <dl class="definition-grid">
                <div>
                  <dt>Estado</dt>
                  <dd>{{ stateLabel(evaluation.state) }}</dd>
                </div>
                <div>
                  <dt>Fecha de inicio</dt>
                  <dd>
                    {{
                      evaluation.startedAt
                        | date: 'dd/MM/yyyy, HH:mm:ss' : 'America/Bogota'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Fecha de resultado</dt>
                  <dd>
                    {{
                      evaluation.completedAt
                        ? (evaluation.completedAt
                          | date: 'dd/MM/yyyy, HH:mm:ss' : 'America/Bogota')
                        : 'En proceso'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Intento</dt>
                  <dd>{{ evaluation.attemptNumber }}</dd>
                </div>
                <div>
                  <dt>Versión de criterios</dt>
                  <dd>{{ evaluation.criteriaVersion }}</dd>
                </div>
                <div class="wide-value">
                  <dt>Huella de entrada</dt>
                  <dd>
                    <code>{{ evaluation.inputHash }}</code>
                  </dd>
                </div>
              </dl>
            </section>

            @if (evaluation.inputSnapshot; as snapshot) {
              <section class="section" aria-labelledby="applicant-title">
                <h2 id="applicant-title">Datos evaluados del solicitante</h2>
                <p class="privacy-note">
                  Datos visibles únicamente en este detalle autorizado.
                </p>
                <dl class="definition-grid">
                  <div>
                    <dt>Nombre completo</dt>
                    <dd>{{ snapshot.applicant.fullName }}</dd>
                  </div>
                  <div>
                    <dt>Documento</dt>
                    <dd>
                      {{ snapshot.applicant.documentType }}
                      {{ snapshot.applicant.documentNumber }}
                    </dd>
                  </div>
                  @if (snapshot.applicant.contact.phone) {
                    <div>
                      <dt>Teléfono</dt>
                      <dd>{{ snapshot.applicant.contact.phone }}</dd>
                    </div>
                  }
                  @if (snapshot.applicant.contact.email) {
                    <div>
                      <dt>Correo</dt>
                      <dd>{{ snapshot.applicant.contact.email }}</dd>
                    </div>
                  }
                  <div>
                    <dt>Consentimiento</dt>
                    <dd>
                      {{
                        snapshot.consent?.decision === 'accepted'
                          ? 'Registrado'
                          : 'No vigente'
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>Versión del aviso</dt>
                    <dd>
                      {{ snapshot.consent?.noticeVersion ?? 'No disponible' }}
                    </dd>
                  </div>
                </dl>
              </section>

              @if (snapshot.alternativeData; as alternatives) {
                <section class="section" aria-labelledby="alternatives-title">
                  <h2 id="alternatives-title">Datos alternativos evaluados</h2>
                  <dl class="definition-grid">
                    <div>
                      <dt>Ingresos estimados</dt>
                      <dd>{{ incomeSummary(alternatives) }}</dd>
                    </div>
                    <div>
                      <dt>Estabilidad de ingresos</dt>
                      <dd>{{ incomeStability(alternatives) }}</dd>
                    </div>
                    <div>
                      <dt>Servicios públicos</dt>
                      <dd>{{ utilitiesSummary(alternatives) }}</dd>
                    </div>
                    <div>
                      <dt>Telefonía móvil</dt>
                      <dd>{{ mobileSummary(alternatives) }}</dd>
                    </div>
                  </dl>
                </section>
              }
            } @else {
              <section class="section" aria-labelledby="snapshot-empty-title">
                <h2 id="snapshot-empty-title">Datos evaluados</h2>
                <p>
                  La instantánea ya no está disponible por la política de
                  retención.
                </p>
              </section>
            }

            <section class="section" aria-labelledby="attempts-title">
              <h2 id="attempts-title">Intentos relacionados</h2>
              @if (evaluation.relatedAttempts.length) {
                <ul class="attempts">
                  @for (
                    attempt of evaluation.relatedAttempts;
                    track attempt.evaluationId
                  ) {
                    <li>
                      <div>
                        <strong>Intento {{ attempt.attemptNumber }}</strong>
                        <span>{{ stateLabel(attempt.state) }}</span>
                        @if (attempt.errorCode) {
                          <span>Código: {{ attempt.errorCode }}</span>
                        }
                      </div>
                      <a
                        mat-button
                        [routerLink]="[
                          '/evaluations',
                          attempt.evaluationId,
                          'details',
                        ]"
                        >Abrir intento</a
                      >
                    </li>
                  }
                </ul>
              } @else {
                <p>No existen otros intentos asociados a esta solicitud.</p>
              }
            </section>
          </article>
        }
      }
    </div>
  `,
  styles: [
    `
      .detail-page {
        max-width: 960px;
        margin: 0 auto;
      }
      .back {
        min-height: 44px;
        margin: 0 0 var(--space-2) calc(var(--space-3) * -1);
      }
      .detail-surface {
        overflow: hidden;
      }
      .section,
      .evaluation-error {
        padding: var(--space-8);
        border-top: 1px solid var(--color-border);
      }
      .evaluation-error {
        border-top: 5px solid var(--color-danger);
        background: var(--color-danger-bg);
      }
      .evaluation-error p:last-child,
      .privacy-note,
      .section > p {
        color: var(--color-text-muted);
      }
      .manual-review {
        background: var(--color-warning-bg);
      }
      .manual-review ul {
        margin-bottom: 0;
      }
      .definition-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-6) var(--space-8);
        margin: var(--space-6) 0 0;
      }
      .definition-grid div {
        min-width: 0;
      }
      .definition-grid dt {
        margin-bottom: var(--space-1);
        color: var(--color-text-muted);
        font-size: 0.875rem;
        font-weight: 500;
      }
      .definition-grid dd {
        margin: 0;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      .wide-value {
        grid-column: 1 / -1;
      }
      code {
        font-size: 0.875rem;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .attempts {
        list-style: none;
        margin: var(--space-4) 0 0;
        padding: 0;
      }
      .attempts li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        min-height: 64px;
        padding: var(--space-3) 0;
        border-top: 1px solid var(--color-border);
      }
      .attempts li div {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        min-width: 0;
      }
      @media (max-width: 599px) {
        .section,
        .evaluation-error {
          padding: var(--space-6) var(--space-4);
        }
        .definition-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-4);
        }
        .wide-value {
          grid-column: 1;
        }
        .attempts li {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class EvaluationDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(HistoryApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly currency = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
  private readonly navigationState =
    (this.router.getCurrentNavigation()?.extras.state as
      Record<string, unknown> | undefined) ??
    (window.history.state as Record<string, unknown>);

  readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly detail = signal<EvaluationDetailView | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getEvaluation(this.evaluationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail as unknown as EvaluationDetailView);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const body = error instanceof HttpErrorResponse ? error.error : error;
          this.error.set(mapApiProblem(body).message);
          this.loading.set(false);
        },
      });
  }

  goBack(): void {
    if (this.navigationState['fromHistory']) this.location.back();
    else void this.router.navigate(['/evaluations']);
  }

  stateLabel(state: EvaluationDetail['state']): string {
    return state === 'evaluada'
      ? 'Evaluada'
      : state === 'revision_manual'
        ? 'Revisión manual'
        : state === 'evaluando'
          ? 'En evaluación'
          : 'Error de evaluación';
  }

  incomeSummary(value: unknown): string {
    const income = (value as AlternativeData).income;
    return income?.availability === 'provided'
      ? this.currency.format(Number(income.monthlyIncomeCop))
      : (income?.reason ?? 'No disponible');
  }

  incomeStability(value: unknown): string {
    const income = (value as AlternativeData).income;
    return income?.availability === 'provided'
      ? `${income.stabilityMonths} meses`
      : 'No disponible';
  }

  utilitiesSummary(value: unknown): string {
    const utilities = (value as AlternativeData).utilities;
    return utilities?.availability === 'provided'
      ? `${utilities.references.length} referencia(s) declarada(s)`
      : (utilities?.reason ?? 'No disponible');
  }

  mobileSummary(value: unknown): string {
    const mobile = (value as AlternativeData).mobile;
    return mobile?.availability === 'provided'
      ? `${mobile.tenureMonths} meses de antigüedad, ${mobile.mode === 'postpaid' ? 'pospago' : 'prepago'}`
      : (mobile?.reason ?? 'No disponible');
  }
}
