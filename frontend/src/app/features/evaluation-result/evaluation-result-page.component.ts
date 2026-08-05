import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CopyIdComponent } from '../../shared/ui/copy-id.component';
import { EvaluationApiService, type EvaluationDetail } from './evaluation-api.service';
import { EvaluationProgressComponent } from './evaluation-progress.component';
import { ScoreSummaryComponent } from './score-summary.component';
import { FactorListComponent } from './factor-list.component';
import { EvaluationErrorComponent } from './evaluation-error.component';
import { ManualReviewComponent } from './manual-review.component';
import { EvaluationRecoveryFacade } from './evaluation-recovery.facade';
@Component({
  selector: 'app-evaluation-result-page',
  standalone: true,
  providers: [EvaluationRecoveryFacade],
  imports: [
    RouterLink,
    MatButtonModule,
    CopyIdComponent,
    EvaluationProgressComponent,
    ScoreSummaryComponent,
    FactorListComponent,
    EvaluationErrorComponent,
    ManualReviewComponent,
  ],
  template: `<div class="result-page">
    <div class="page-header">
      <div>
        <h1 tabindex="-1">Resultado de la evaluación</h1>
        <p>Evaluación <app-copy-id [value]="id" /></p>
      </div>
      <a mat-stroked-button routerLink="/applications/new">Nueva solicitud</a>
    </div>
    <app-evaluation-progress
      [loading]="loading()"
      [error]="error()"
      (retry)="load()"
    >
      @if (result()) {
        <article class="surface">
          @if (result()!.state === 'error') {
            <app-evaluation-error
              [errorCode]="result()!.errorCode || ''"
              [correlationId]="correlationId()"
              [retrying]="recovery.retrying()"
              [retryError]="recovery.error()"
              (retry)="retryEvaluation()"
              (correct)="correctData()"
            />
          } @else if (result()!.state === 'revision_manual') {
            <app-manual-review [result]="result()!" />
            @if (result()!.factors.length) {
              <app-factor-list [factors]="result()!.factors" />
            }
          } @else {
            <app-score-summary [result]="result()!" />
            <app-factor-list [factors]="result()!.factors" />
          }
          <footer class="metadata">
            <dl>
              <div>
                <dt>Estado</dt>
                <dd>{{ stateLabel(result()!.state) }}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {{ result()!.completedAt || 'Ahora' }}
                </dd>
              </div>
              <div>
                <dt>Versión de criterios</dt>
                <dd>{{ result()!.criteriaVersion }}</dd>
              </div>
            </dl>
            @if (result()!.relatedAttempts.length) {
              <section class="attempts" aria-labelledby="related-attempts-title">
                <h2 id="related-attempts-title">Intentos relacionados</h2>
                <ul>
                  @for (attempt of result()!.relatedAttempts; track attempt.evaluationId) {
                    <li>
                      <a [routerLink]="['/evaluations', attempt.evaluationId]">
                        Intento {{ attempt.attemptNumber }} · {{ stateLabel(attempt.state) }}
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }
          </footer>
        </article>
        <div class="bottom-actions">
          <a mat-stroked-button routerLink="/evaluations">Ver histórico</a
          ><a mat-flat-button color="primary" routerLink="/applications/new"
            >Crear otra evaluación</a
          >
        </div>
      }
    </app-evaluation-progress>
  </div>`,
  styles: [
    `
      .result-page {
        max-width: 960px;
        margin: auto;
      }
      .metadata {
        border-top: 1px solid var(--color-border);
        padding: 24px 32px;
        background: var(--color-surface-subtle);
      }
      dl {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 24px;
        margin: 0;
      }
      dt {
        font-size: 14px;
        color: var(--color-text-muted);
        margin-bottom: 4px;
      }
      dd {
        margin: 0;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      .attempts {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }
      .attempts h2 {
        font-size: 18px;
        line-height: 26px;
        margin: 0 0 8px;
      }
      .attempts ul {
        margin: 0;
        padding-left: 20px;
      }
      .attempts a {
        overflow-wrap: anywhere;
      }
      .bottom-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }
      @media (max-width: 599px) {
        dl {
          grid-template-columns: 1fr;
        }
        .metadata {
          padding: 24px 16px;
        }
        .bottom-actions {
          flex-direction: column-reverse;
        }
        .bottom-actions a {
          width: 100%;
        }
      }
    `,
  ],
})
export class EvaluationResultPageComponent {
  private route = inject(ActivatedRoute);
  private api = inject(EvaluationApiService);
  private router = inject(Router);
  readonly recovery = inject(EvaluationRecoveryFacade);
  id = this.route.snapshot.paramMap.get('id')!;
  result = signal<EvaluationDetail | null>(this.navigationState().result ?? null);
  correlationId = signal(this.navigationState().correlationId ?? '');
  loading = signal(!this.result());
  error = signal('');
  constructor() {
    if (!this.result()) void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.result.set(await this.api.get(this.id));
    } catch (error: unknown) {
      this.error.set(this.errorDetail(error));
    } finally {
      this.loading.set(false);
    }
  }
  stateLabel(s: string) {
    return s === 'evaluada'
      ? 'Evaluada'
      : s === 'revision_manual'
        ? 'Revisión manual'
        : 'Error';
  }

  async retryEvaluation(): Promise<void> {
    try {
      const retried = await this.recovery.retry(this.id);
      this.result.set(retried);
      this.id = retried.evaluationId;
      await this.router.navigate(['/evaluations', retried.evaluationId], {
        replaceUrl: true,
        state: { result: retried },
      });
    } catch {
      // The facade exposes the safe observable message in the error component.
    }
  }

  async correctData(): Promise<void> {
    const applicationId = this.result()?.applicationId;
    if (applicationId)
      await this.router.navigate(['/applications/new'], {
        queryParams: { applicationId },
      });
  }

  private navigationState(): {
    result?: EvaluationDetail;
    correlationId?: string;
  } {
    const state = globalThis.history?.state as Record<string, unknown> | undefined;
    return {
      ...(state?.['result'] ? { result: state['result'] as EvaluationDetail } : {}),
      ...(typeof state?.['correlationId'] === 'string'
        ? { correlationId: state['correlationId'] }
        : {}),
    };
  }

  private errorDetail(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const body = error.error;
      if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string')
        return body.detail;
    }
    return 'No encontramos el resultado solicitado.';
  }
}
