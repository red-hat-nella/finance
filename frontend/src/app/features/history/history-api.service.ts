import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { components } from '../../core/api/generated';
import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from '../../core/config/runtime-config';
import type {
  EvaluationHistoryPage,
  HistorySearchInput,
} from './history.models';

@Injectable({ providedIn: 'root' })
export class HistoryApiService {
  constructor(
    private readonly http: HttpClient,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  search(filters: HistorySearchInput): Observable<EvaluationHistoryPage> {
    return this.http.post<EvaluationHistoryPage>(
      `${this.config.API_BASE_URL}/evaluations/search`,
      filters,
    );
  }

  getEvaluation(
    evaluationId: string,
  ): Observable<components['schemas']['EvaluationDetail']> {
    return this.http.get<components['schemas']['EvaluationDetail']>(
      `${this.config.API_BASE_URL}/evaluations/${evaluationId}`,
    );
  }
}
