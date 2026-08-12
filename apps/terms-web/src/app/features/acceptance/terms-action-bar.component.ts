import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'terms-action-bar',
  standalone: true,
  template: `
    <div class="bar" aria-label="Acciones de términos">
      <button data-action="exit" type="button" class="secondary" (click)="exit.emit()">Salir</button>
      <button type="submit" class="primary" [disabled]="disabled() || accepting()" (click)="accept.emit()">
        @if (accepting()) { <span class="spinner" aria-hidden="true"></span> Guardando aceptación… }
        @else { Aceptar y continuar }
      </button>
    </div>
  `,
  styles: [`
    :host { position: fixed; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); z-index: var(--z-header); display: block; width: calc(100% - 32px); max-width: 800px; transform: translateX(-50%); }
    .bar { display: flex; justify-content: flex-end; gap: 12px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-surface); background: var(--color-surface); box-shadow: var(--shadow-1); }
    button { min-height: 44px; padding: 0 20px; border-radius: var(--radius-control); cursor: pointer; font-weight: 500; }
    .secondary { border: 1px solid var(--color-border-strong); background: var(--color-surface); color: var(--color-primary); }
    .primary { border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); }
    .primary:hover:not(:disabled) { background: var(--color-primary-hover); }
    button:disabled { cursor: not-allowed; background: var(--color-disabled-bg); border-color: var(--color-border); color: var(--color-disabled-text); }
    .spinner { display: inline-block; width: 16px; height: 16px; margin-right: 8px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 700ms linear infinite; vertical-align: -3px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 599px) { .bar { flex-direction: column-reverse; } button { width: 100%; } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; border-right-color: currentColor; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsActionBarComponent {
  readonly disabled = input(false);
  readonly accepting = input(false);
  readonly accept = output<void>();
  readonly exit = output<void>();
}
