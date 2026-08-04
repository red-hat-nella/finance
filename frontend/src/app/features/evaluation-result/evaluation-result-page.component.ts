import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CopyIdComponent } from '../../shared/ui/copy-id.component';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state.component';
import { EvaluationApiService } from './evaluation-api.service';
import { ScoreSummaryComponent } from './score-summary.component';
import { FactorListComponent } from './factor-list.component';
@Component({
  selector: 'app-evaluation-result-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    CopyIdComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    ScoreSummaryComponent,
    FactorListComponent,
  ],
  template: `<div class="result-page">
    <div class="page-header">
      <div>
        <h1 tabindex="-1">Resultado de la evaluación</h1>
        <p>Evaluación <app-copy-id [value]="id" /></p>
      </div>
      <a mat-stroked-button routerLink="/applications/new">Nueva solicitud</a>
    </div>
    @if (loading()) {
      <app-loading-state label="Consultando resultado…" />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (result()) {
      <article class="surface">
        <app-score-summary [result]="result()" /><app-factor-list
          [factors]="result().factors"
        />
        <footer class="metadata">
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>{{ stateLabel(result().state || result().status) }}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>
                {{ result().completedAt || result().calculatedAt || 'Ahora' }}
              </dd>
            </div>
            <div>
              <dt>Versión de criterios</dt>
              <dd>{{ result().criteriaVersion }}</dd>
            </div>
          </dl>
        </footer>
      </article>
      <div class="bottom-actions">
        <a mat-stroked-button routerLink="/evaluations">Ver histórico</a
        ><a mat-flat-button color="primary" routerLink="/applications/new"
          >Crear otra evaluación</a
        >
      </div>
    }
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
  id = this.route.snapshot.paramMap.get('id')!;
  result = signal<any>(history.state.result ?? null);
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
    } catch (e: any) {
      this.error.set(
        e?.error?.detail || 'No encontramos el resultado solicitado.',
      );
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
}
