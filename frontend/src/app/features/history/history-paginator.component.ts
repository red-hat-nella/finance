import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-history-paginator',
  standalone: true,
  imports: [MatButtonModule],
  template: `
    <nav aria-label="Paginación del histórico">
      <span>Página {{ page }} de {{ totalPages || 1 }}</span>
      <div>
        <button
          mat-button
          [disabled]="page <= 1"
          (click)="pageChanged.emit(page - 1)"
        >
          Anterior
        </button>
        <button
          mat-button
          [disabled]="page >= totalPages"
          (click)="pageChanged.emit(page + 1)"
        >
          Siguiente
        </button>
      </div>
    </nav>
  `,
  styles: [
    `
      nav {
        min-height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding-top: var(--space-3);
        color: var(--color-text-muted);
      }
      nav div {
        display: flex;
        gap: var(--space-2);
      }
      @media (max-width: 479px) {
        nav {
          align-items: stretch;
          flex-direction: column;
        }
        nav div button {
          flex: 1 1 0;
          min-width: 0;
        }
      }
    `,
  ],
})
export class HistoryPaginatorComponent {
  @Input() page = 1;
  @Input() totalPages = 0;
  @Output() pageChanged = new EventEmitter<number>();
}
