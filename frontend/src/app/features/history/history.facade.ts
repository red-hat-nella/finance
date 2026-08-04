import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { mapApiProblem } from '../../core/api/problem-mapper';
import { HistoryApiService } from './history-api.service';
import {
  EMPTY_HISTORY_FILTERS,
  type EvaluationHistoryItem,
  type HistorySearchInput,
} from './history.models';

@Injectable({ providedIn: 'root' })
export class HistoryFacade {
  readonly items = signal<readonly EvaluationHistoryItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filters = signal<HistorySearchInput>(EMPTY_HISTORY_FILTERS);
  readonly page = signal(1);
  readonly totalItems = signal(0);
  readonly totalPages = signal(0);

  private activeRequest?: Subscription;
  private requestSequence = 0;

  constructor(private readonly api: HistoryApiService) {}

  load(filters: HistorySearchInput = this.filters()): void {
    this.activeRequest?.unsubscribe();
    const sequence = ++this.requestSequence;
    this.filters.set(Object.freeze({ ...filters }));
    this.loading.set(true);
    this.error.set('');

    this.activeRequest = this.api.search(filters).subscribe({
      next: (result) => {
        if (sequence !== this.requestSequence) return;
        this.items.set(result.items);
        this.page.set(result.page);
        this.totalItems.set(result.totalItems);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (sequence !== this.requestSequence) return;
        const body = error instanceof HttpErrorResponse ? error.error : error;
        this.error.set(mapApiProblem(body).message);
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    this.load(this.filters());
  }

  clear(): void {
    this.load(EMPTY_HISTORY_FILTERS);
  }

  goToPage(page: number): void {
    if (page < 1 || (this.totalPages() > 0 && page > this.totalPages())) return;
    this.load({ ...this.filters(), page });
  }
}
