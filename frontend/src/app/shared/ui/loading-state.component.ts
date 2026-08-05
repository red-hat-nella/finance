import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <section role="status" aria-live="polite" [attr.aria-label]="label">
      <div class="status-line">
        <mat-spinner diameter="28" [attr.aria-label]="label" /><span>{{ label }}</span>
      </div>
      <div class="skeleton heading" aria-hidden="true"></div>
      <div class="skeleton body" aria-hidden="true"></div>
      <div class="skeleton body short" aria-hidden="true"></div>
    </section>
  `,
  styles: [
    `
      section {
        min-height: 220px;
        display: grid;
        align-content: center;
        gap: 16px;
        color: var(--color-text-muted);
      }
      .status-line {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
      }
      .skeleton {
        height: 16px;
        border-radius: var(--radius-control);
        background: var(--color-surface-subtle);
      }
      .heading {
        width: min(280px, 70%);
        height: 24px;
      }
      .body {
        width: 100%;
      }
      .short {
        width: 64%;
      }
    `,
  ],
})
export class LoadingStateComponent {
  @Input() label = 'Cargando información…';
}
