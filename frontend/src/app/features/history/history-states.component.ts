import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state.component';

@Component({
  selector: 'app-history-states',
  standalone: true,
  imports: [
    MatButtonModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  template: `
    @if (loading) {
      <app-loading-state label="Consultando evaluaciones…" />
    } @else if (error) {
      <app-error-state [message]="error" (retry)="retry.emit()" />
    } @else {
      <div class="surface">
        @if (filtered) {
          <app-empty-state
            title="No encontramos evaluaciones con estos filtros"
            message="Ajusta los criterios o limpia los filtros para ver el histórico completo."
          >
            <button mat-stroked-button (click)="clearFilters.emit()">
              Limpiar filtros
            </button>
          </app-empty-state>
        } @else {
          <app-empty-state
            title="Aún no hay evaluaciones"
            message="Cuando complete una evaluación aparecerá en este histórico."
          >
            <a mat-flat-button color="primary" routerLink="/applications/new"
              >Registrar solicitud</a
            >
          </app-empty-state>
        }
      </div>
    }
  `,
})
export class HistoryStatesComponent {
  @Input() loading = false;
  @Input() error = '';
  @Input() filtered = false;
  @Output() retry = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
}
