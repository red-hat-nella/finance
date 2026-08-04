import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `<section>
    <span class="symbol" aria-hidden="true">□</span>
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <ng-content />
  </section>`,
  styles: [
    `
      section {
        text-align: center;
        padding: 48px 24px;
      }
      .symbol {
        font-size: 32px;
      }
      h2 {
        margin-top: 12px;
      }
      p {
        color: var(--color-text-muted);
        margin: 8px auto 20px;
        max-width: 520px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() title = 'Sin información';
  @Input() message = 'No hay registros disponibles.';
}
