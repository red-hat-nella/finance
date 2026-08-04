import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import type { EvaluationHistoryItem } from './history.models';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [DatePipe, MatButtonModule, RouterLink, RiskBadgeComponent],
  template: `
    <ul class="history-list surface" aria-label="Evaluaciones encontradas">
      @for (item of items; track item.evaluationId) {
        <li>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>
                {{
                  item.completedAt
                    | date: 'dd/MM/yyyy, HH:mm' : 'America/Bogota'
                }}
              </dd>
            </div>
            <div>
              <dt>Solicitante</dt>
              <dd>{{ item.displayName }}</dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd>{{ item.documentMasked }}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd class="score">{{ item.score ?? '—' }}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>
                @if (item.riskBand) {
                  <app-risk-badge [band]="item.riskBand" />
                } @else {
                  <span class="error-label">Error de evaluación</span>
                }
              </dd>
            </div>
          </dl>
          <a
            mat-button
            [routerLink]="['/evaluations', item.evaluationId, 'details']"
            [state]="{ fromHistory: true }"
            >Abrir evaluación</a
          >
        </li>
      }
    </ul>
  `,
  styles: [
    `
      .history-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        padding: var(--space-4);
        border-bottom: 1px solid var(--color-border);
      }
      li:last-child {
        border-bottom: 0;
      }
      dl {
        margin: 0;
      }
      dl div {
        display: grid;
        grid-template-columns: minmax(96px, 32%) minmax(0, 1fr);
        gap: var(--space-3);
        padding: var(--space-1) 0;
      }
      dt {
        color: var(--color-text-muted);
        font-size: 14px;
        font-weight: 500;
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .score {
        font-size: 20px;
        font-weight: 700;
      }
      .error-label {
        color: var(--color-danger);
        font-weight: 700;
      }
      a {
        display: flex;
        margin: var(--space-2) 0 0 auto;
        width: fit-content;
      }
      @media (min-width: 960px) {
        :host {
          display: none;
        }
      }
    `,
  ],
})
export class HistoryListComponent {
  @Input({ required: true }) items: readonly EvaluationHistoryItem[] = [];
}
