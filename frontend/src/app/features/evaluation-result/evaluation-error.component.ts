import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CopyIdComponent } from '../../shared/ui/copy-id.component';

@Component({
  selector: 'app-evaluation-error',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule, CopyIdComponent],
  template: `
    <section class="error-panel" role="alert">
      <span class="status" aria-hidden="true">!</span>
      <div>
        <h2>No fue posible calcular el score</h2>
        <p>{{ message }}</p>
        @if (errorCode) {
          <p class="technical">Código operativo: <code>{{ errorCode }}</code></p>
        }
        @if (correlationId) {
          <p class="technical">Identificador de soporte: <app-copy-id [value]="correlationId" /></p>
        }
        @if (retryError) {
          <p class="retry-error">{{ retryError }}</p>
        }
        <div class="actions">
          <button mat-flat-button color="primary" type="button" [disabled]="retrying" (click)="retry.emit()">
            <span class="button-slot">
              @if (retrying) { <mat-spinner diameter="18" aria-label="Reintentando evaluación" /> }
              <span>{{ retrying ? 'Reintentando' : 'Reintentar evaluación' }}</span>
            </span>
          </button>
          <button mat-stroked-button type="button" [disabled]="retrying" (click)="correct.emit()">
            Corregir datos
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .error-panel { display:grid;grid-template-columns:40px minmax(0,1fr);gap:16px;padding:28px 32px;border-top:5px solid var(--color-danger); }
      .status { display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--color-danger);color:var(--color-on-primary);font-weight:700; }
      h2 { margin:0 0 8px;font-size:24px;line-height:32px; }
      p { margin:6px 0;overflow-wrap:anywhere; }
      .technical { color:var(--color-text-muted);font-size:14px; }
      .retry-error { color:var(--color-danger); }
      .actions { display:flex;gap:12px;margin-top:20px; }
      .button-slot { display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:150px; }
      @media(max-width:599px){.error-panel{grid-template-columns:1fr;padding:24px 16px}.actions{flex-direction:column}.actions button{width:100%}}
    `,
  ],
})
export class EvaluationErrorComponent {
  @Input() message = 'El servicio de evaluación no respondió. Los datos e intentos permanecen guardados.';
  @Input() errorCode = '';
  @Input() correlationId = '';
  @Input() retryError = '';
  @Input() retrying = false;
  @Output() retry = new EventEmitter<void>();
  @Output() correct = new EventEmitter<void>();
}
