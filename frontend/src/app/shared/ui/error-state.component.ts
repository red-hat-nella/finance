import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AlertComponent } from './alert.component';
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [MatButtonModule, AlertComponent],
  template: `<app-alert
    type="error"
    title="No fue posible completar la operación"
    ><p>{{ message }}</p>
    @if (requestId) {
      <p>
        Identificador: <code>{{ requestId }}</code>
      </p>
    }
    <button mat-stroked-button (click)="retry.emit()">
      Intentar nuevamente
    </button></app-alert
  >`,
})
export class ErrorStateComponent {
  @Input() message = 'Revise su conexión e intente nuevamente.';
  @Input() requestId = '';
  @Output() retry = new EventEmitter<void>();
}
