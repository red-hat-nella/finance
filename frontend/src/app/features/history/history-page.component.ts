import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { HistoryFiltersComponent } from './history-filters.component';
import { HistoryListComponent } from './history-list.component';
import { HistoryPaginatorComponent } from './history-paginator.component';
import { HistoryStatesComponent } from './history-states.component';
import { HistoryTableComponent } from './history-table.component';
import { HistoryFacade } from './history.facade';
import type { HistorySearchInput } from './history.models';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [
    MatButtonModule,
    RouterLink,
    HistoryFiltersComponent,
    HistoryListComponent,
    HistoryPaginatorComponent,
    HistoryStatesComponent,
    HistoryTableComponent,
  ],
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1 tabindex="-1">Histórico de evaluaciones</h1>
          <p>Consulte resultados previos con datos personales minimizados.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/applications/new"
          >Nueva solicitud</a
        >
      </div>

      <app-history-filters
        [initialFilters]="facade.filters()"
        (filtersApplied)="applyFilters($event)"
        (filtersCleared)="clearFilters()"
      />

      @if (loading() || error() || items().length === 0) {
        <app-history-states
          [loading]="loading()"
          [error]="error()"
          [filtered]="filtered()"
          (retry)="facade.retry()"
          (clearFilters)="clearFilters()"
        />
      } @else {
        <app-history-table [items]="items()" />
        <app-history-list [items]="items()" />
        <app-history-paginator
          [page]="facade.page()"
          [totalPages]="facade.totalPages()"
          (pageChanged)="facade.goToPage($event)"
        />
      }
    </div>
  `,
})
export class HistoryPageComponent {
  readonly facade = inject(HistoryFacade);
  readonly items = this.facade.items;
  readonly loading = this.facade.loading;
  readonly error = this.facade.error;
  readonly filtered = computed(() =>
    Object.keys(this.facade.filters()).some((key) => key !== 'page'),
  );

  constructor() {
    this.facade.load();
  }

  applyFilters(filters: HistorySearchInput): void {
    this.facade.load(filters);
  }

  clearFilters(): void {
    this.facade.clear();
  }
}
