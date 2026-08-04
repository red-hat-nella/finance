import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import type { EvaluationHistoryItem } from './history.models';

@Component({
  selector: 'app-history-table',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatTableModule,
    RouterLink,
    RiskBadgeComponent,
  ],
  template: `
    <div class="table-wrap surface">
      <table
        mat-table
        [dataSource]="items"
        aria-label="Evaluaciones encontradas"
      >
        <ng-container matColumnDef="completedAt">
          <th mat-header-cell *matHeaderCellDef aria-sort="descending">
            Fecha y hora
          </th>
          <td mat-cell *matCellDef="let item">
            {{
              item.completedAt | date: 'dd/MM/yyyy, HH:mm' : 'America/Bogota'
            }}
          </td>
        </ng-container>
        <ng-container matColumnDef="displayName">
          <th mat-header-cell *matHeaderCellDef>Solicitante</th>
          <td mat-cell *matCellDef="let item">{{ item.displayName }}</td>
        </ng-container>
        <ng-container matColumnDef="documentMasked">
          <th mat-header-cell *matHeaderCellDef>Documento</th>
          <td mat-cell *matCellDef="let item">{{ item.documentMasked }}</td>
        </ng-container>
        <ng-container matColumnDef="score">
          <th mat-header-cell *matHeaderCellDef>Score</th>
          <td mat-cell *matCellDef="let item" class="score">
            {{ item.score ?? '—' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="result">
          <th mat-header-cell *matHeaderCellDef>Resultado</th>
          <td mat-cell *matCellDef="let item">
            @if (item.riskBand) {
              <app-risk-badge [band]="item.riskBand" />
            } @else {
              <span class="error-label">Error de evaluación</span>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>
            <span class="sr-only">Acciones</span>
          </th>
          <td mat-cell *matCellDef="let item">
            <a
              mat-button
              [routerLink]="['/evaluations', item.evaluationId, 'details']"
              [state]="{ fromHistory: true }"
              >Abrir</a
            >
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </div>
  `,
  styles: [
    `
      .table-wrap {
        overflow: hidden;
      }
      table {
        width: 100%;
        table-layout: fixed;
      }
      th,
      td {
        overflow-wrap: anywhere;
      }
      .score {
        font-size: 20px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .error-label {
        color: var(--color-danger);
        font-weight: 700;
      }
      @media (max-width: 959px) {
        :host {
          display: none;
        }
      }
    `,
  ],
})
export class HistoryTableComponent {
  @Input({ required: true }) items: readonly EvaluationHistoryItem[] = [];
  readonly columns = [
    'completedAt',
    'displayName',
    'documentMasked',
    'score',
    'result',
    'actions',
  ];
}
