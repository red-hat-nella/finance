import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-risk-badge',
  standalone: true,
  template: `<span [class]="'badge ' + tone"
    ><span aria-hidden="true">{{ icon }}</span
    >{{ label }}</span
  >`,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 700;
      }
      .low {
        color: var(--color-success);
        background: var(--color-success-bg);
      }
      .medium {
        color: var(--color-warning);
        background: var(--color-warning-bg);
      }
      .high,
      .error {
        color: var(--color-danger);
        background: var(--color-danger-bg);
      }
      .neutral {
        color: var(--color-text-muted);
        background: var(--color-surface-subtle);
        border: 1px solid var(--color-border);
      }
    `,
  ],
})
export class RiskBadgeComponent {
  @Input() band: string | null = null;
  get tone() {
    return this.band === null
      ? 'neutral'
      : this.band === 'riesgo_bajo'
        ? 'low'
        : this.band === 'riesgo_medio'
          ? 'medium'
          : 'high';
  }
  get label() {
    return this.band === null
      ? 'Banda no disponible'
      : this.band === 'riesgo_bajo'
        ? 'Riesgo bajo'
        : this.band === 'riesgo_medio'
          ? 'Riesgo medio'
          : 'Riesgo alto';
  }
  get icon() {
    return this.tone === 'low'
      ? '✓'
      : this.tone === 'medium'
        ? '!'
        : this.tone === 'neutral'
          ? '–'
          : '×';
  }
}
