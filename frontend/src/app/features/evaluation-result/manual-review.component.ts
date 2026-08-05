import { Component, Input } from '@angular/core';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import type { EvaluationDetail } from './evaluation-api.service';

@Component({
  selector: 'app-manual-review',
  standalone: true,
  imports: [RiskBadgeComponent],
  template: `
    <section class="manual-panel">
      <div>
        <span class="eyebrow">Resultado operativo</span>
        @if (result.score !== null) {
          <div class="score"><strong>{{ result.score }}</strong><span>/ 850</span></div>
          <app-risk-badge [band]="result.riskBand" />
        } @else {
          <strong class="no-score">Sin score concluyente</strong>
        }
      </div>
      <div>
        <h2>Revisión manual obligatoria</h2>
        <p>{{ result.recommendation?.text || 'Revise los datos disponibles antes de tomar una decisión.' }}</p>
        @if (result.manualReviewReasons.length) {
          <h3>Motivos</h3>
          <ul>
            @for (reason of result.manualReviewReasons; track $index) {
              <li>{{ reasonMessage(reason) }}</li>
            }
          </ul>
        }
        <p class="disclaimer">Este resultado no constituye una aprobación automática.</p>
      </div>
    </section>
  `,
  styles: [
    `
      .manual-panel{display:grid;grid-template-columns:minmax(200px,.7fr) minmax(0,1.3fr);gap:32px;padding:32px;border-top:5px solid var(--color-warning)}
      .eyebrow{display:block;color:var(--color-text-muted);font-size:14px;margin-bottom:8px}.score{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}.score strong{font-size:48px;line-height:56px}.score span,.disclaimer{color:var(--color-text-muted)}.no-score{display:block;font-size:28px;line-height:36px}h2{margin-top:0}li{margin:6px 0;overflow-wrap:anywhere}@media(max-width:700px){.manual-panel{grid-template-columns:1fr;padding:24px 16px}.score strong{font-size:40px;line-height:48px}}
    `,
  ],
})
export class ManualReviewComponent {
  @Input({ required: true }) result!: EvaluationDetail;
  reasonMessage(reason: EvaluationDetail['manualReviewReasons'][number]): string {
    return typeof reason === 'string' ? reason : reason.message;
  }
}
