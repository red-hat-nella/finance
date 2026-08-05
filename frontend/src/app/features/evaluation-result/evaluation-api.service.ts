import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  RUNTIME_CONFIG,
  RuntimeConfig,
} from '../../core/config/runtime-config';
import { IdempotencyService } from '../../core/api/idempotency.service';
import type { components } from '../../core/api/generated';

export type EvaluationDetail = components['schemas']['EvaluationDetail'];
@Injectable({ providedIn: 'root' })
export class EvaluationApiService {
  constructor(
    private http: HttpClient,
    @Inject(RUNTIME_CONFIG) private config: RuntimeConfig,
    private ids: IdempotencyService,
  ) {}
  get(id: string) {
    return firstValueFrom(
      this.http.get<EvaluationDetail>(`${this.config.API_BASE_URL}/evaluations/${id}`),
    );
  }

  async retry(id: string): Promise<EvaluationDetail> {
    const action = `retry-evaluation-${id}`;
    const result = await firstValueFrom(
      this.http.post<EvaluationDetail>(
        `${this.config.API_BASE_URL}/evaluations/${id}/retry`,
        null,
        {
          headers: new HttpHeaders({
            'Idempotency-Key': this.ids.forAction(action),
          }),
        },
      ),
    );
    this.ids.complete(action);
    return result;
  }
}
