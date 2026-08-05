import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-review-section',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `<section aria-labelledby="review-title">
    <div><h2 id="review-title">Revisión y evaluación</h2><p>Intento {{attemptNumber}}. Verifique los datos antes de calcular.</p></div>
    <div class="form-actions">
      <button mat-stroked-button type="button" (click)="save.emit()" [disabled]="busy">
        <span class="button-slot">@if(saving){<mat-spinner diameter="20"/>}{{saving?'Guardando…':'Guardar borrador'}}</span>
      </button>
      <button mat-flat-button color="primary" type="submit" [disabled]="busy">
        <span class="button-slot">@if(evaluating){<mat-spinner diameter="20"/>}{{evaluating?'Evaluando…':'Calcular score'}}</span>
      </button>
    </div>
  </section>`,
  styles: [
    `
      section {
        padding: var(--space-8);
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space-3);
      }
      section > div:first-child {
        margin-bottom: var(--space-6);
      }
      h2 {
        font-size: 20px;
        line-height: 28px;
      }
      p {
        margin: var(--space-1) 0 0;
        color: var(--color-text-muted);
      }
      .button-slot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        min-width: 112px;
      }
      @media (max-width: 599px) {
        section {
          padding: var(--space-6) var(--space-4);
        }
        .form-actions {
          flex-direction: column-reverse;
        }
        .form-actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class ReviewSectionComponent {
  @Input() attemptNumber = 1;
  @Input() saving = false;
  @Input() evaluating = false;
  @Input() busy = false;
  @Output() save = new EventEmitter<void>();
}
