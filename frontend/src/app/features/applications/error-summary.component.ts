import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface FormErrorItem {
  readonly control: string;
  readonly label: string;
}

@Component({
  selector: 'app-error-summary',
  standalone: true,
  template: `
    @if (items.length) {
      <section class="error-summary" role="alert" aria-labelledby="error-summary-title">
        <h2 id="error-summary-title">Revise la información</h2>
        <p>Complete los campos obligatorios y corrija los valores señalados:</p>
        <ul>
          @for (item of items; track item.control) {
            <li>
              <a [href]="'#' + item.control" (click)="select($event, item.control)">
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: [
    `
      .error-summary {
        margin-bottom: 16px;
        padding: 16px 20px;
        border-left: 4px solid var(--color-danger);
        background: var(--color-danger-soft);
      }
      h2 {
        font-size: 18px;
        line-height: 26px;
        margin: 0 0 4px;
      }
      p,
      ul {
        margin: 4px 0;
      }
      a {
        color: var(--color-danger-text, var(--color-danger));
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class ErrorSummaryComponent {
  @Input() items: readonly FormErrorItem[] = [];
  @Output() focusControl = new EventEmitter<string>();

  select(event: Event, control: string): void {
    event.preventDefault();
    this.focusControl.emit(control);
  }
}
