import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-alert',
  standalone: true,
  template: `<div
    [class]="'alert ' + type"
    [attr.role]="type === 'error' ? 'alert' : null"
  >
    <strong>{{ title }}</strong
    ><ng-content />
  </div>`,
  styles: [
    `
      .alert {
        padding: 16px;
        border-left: 4px solid var(--color-info);
        background: var(--color-info-bg);
        border-radius: 4px;
      }
      .alert strong {
        display: block;
        margin-bottom: 4px;
      }
      .error {
        border-color: var(--color-danger);
        background: var(--color-danger-bg);
      }
      .warning {
        border-color: var(--color-warning);
        background: var(--color-warning-bg);
      }
    `,
  ],
})
export class AlertComponent {
  @Input() title = 'Información';
  @Input() type: 'info' | 'error' | 'warning' = 'info';
}
