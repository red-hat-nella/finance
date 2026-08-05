import { Injectable, signal } from '@angular/core';
import { EvaluationApiService, type EvaluationDetail } from './evaluation-api.service';

@Injectable()
export class EvaluationRecoveryFacade {
  private readonly retryingState = signal(false);
  private readonly errorState = signal('');
  readonly retrying = this.retryingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(private readonly api: EvaluationApiService) {}

  async retry(evaluationId: string): Promise<EvaluationDetail> {
    if (this.retryingState()) throw new Error('El reintento ya está en curso.');
    this.retryingState.set(true);
    this.errorState.set('');
    try {
      return await this.api.retry(evaluationId);
    } catch (error: unknown) {
      this.errorState.set(this.detail(error));
      throw error;
    } finally {
      this.retryingState.set(false);
    }
  }

  private detail(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const body = error.error;
      if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string')
        return body.detail;
    }
    return 'No fue posible completar el reintento. Intente nuevamente.';
  }
}
