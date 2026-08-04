import { Component, Input } from '@angular/core';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
@Component({
  selector: 'app-score-summary',
  standalone: true,
  imports: [RiskBadgeComponent],
  template: `<section [class]="'summary ' + tone">
    <div>
      <span class="eyebrow">Score alternativo</span>
      @if (result.score !== null) {
        <div class="score">
          <strong>{{ result.score }}</strong
          ><span>/ 850</span>
        </div>
      } @else {
        <strong class="manual">Revisión manual</strong>
      }
    </div>
    <div class="decision">
      <app-risk-badge [band]="result.riskBand" />
      <h2>{{ result.recommendation?.text }}</h2>
      <p>
        Esta recomendación apoya la revisión del analista y no constituye una
        aprobación automática.
      </p>
    </div>
  </section>`,
  styles: [
    `
      .summary {
        display: grid;
        grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr);
        gap: 32px;
        padding: 32px;
        border-top: 5px solid var(--color-success);
      }
      .medium {
        border-color: var(--color-warning);
      }
      .high {
        border-color: var(--color-danger);
      }
      .eyebrow {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: var(--color-text-muted);
        margin-bottom: 8px;
      }
      .score {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .score strong {
        font-size: 48px;
        line-height: 56px;
      }
      .score span {
        font-size: 20px;
        color: var(--color-text-muted);
      }
      .manual {
        font-size: 32px;
        line-height: 40px;
      }
      .decision h2 {
        margin-top: 16px;
      }
      .decision p {
        color: var(--color-text-muted);
        margin-bottom: 0;
      }
      @media (max-width: 700px) {
        .summary {
          grid-template-columns: 1fr;
          padding: 24px 16px;
        }
        .score strong {
          font-size: 40px;
          line-height: 48px;
        }
      }
    `,
  ],
})
export class ScoreSummaryComponent {
  @Input({ required: true }) result: any;
  get tone() {
    return this.result.riskBand === 'riesgo_bajo'
      ? 'low'
      : this.result.riskBand === 'riesgo_medio'
        ? 'medium'
        : 'high';
  }
}
