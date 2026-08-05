import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import type { components } from '../../core/api/generated';
import { mapApiProblem } from '../../core/api/problem-mapper';
import { AuditApiService } from './audit-api.service';

type AuditEvent = components['schemas']['AuditEvent'];

@Injectable()
export class AuditFacade {
  readonly events = signal<readonly AuditEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private activeRequest?: Subscription;

  constructor(private readonly api: AuditApiService) {}

  load(evaluationId: string): void {
    this.activeRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.activeRequest = this.api.getEvaluationAudit(evaluationId).subscribe({
      next: (result) => {
        this.events.set(result.events);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        const body = error instanceof HttpErrorResponse ? error.error : error;
        this.error.set(mapApiProblem(body).message);
        this.loading.set(false);
      },
    });
  }
}
