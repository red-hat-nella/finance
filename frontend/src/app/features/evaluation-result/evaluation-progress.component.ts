import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state.component';

@Component({
  selector: 'app-evaluation-progress',
  standalone: true,
  imports: [ErrorStateComponent, LoadingStateComponent],
  template: `
    <section
      class="evaluation-progress"
      role="region"
      aria-live="polite"
      [attr.aria-busy]="loading"
      aria-label="Estado de la evaluación"
    >
      @if (loading) {
        <app-loading-state label="Consultando resultado…" />
      } @else if (error) {
        <app-error-state [message]="error" (retry)="retry.emit()" />
      } @else {
        <span class="sr-only">Resultado de evaluación listo.</span>
        <ng-content />
      }
    </section>
  `,
})
export class EvaluationProgressComponent {
  @Input() loading = false;
  @Input() error = '';
  @Output() retry = new EventEmitter<void>();
}
