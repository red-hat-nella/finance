import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { components } from '../../core/api/generated';
import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from '../../core/config/runtime-config';

export type EvaluationAudit = {
  evaluationId: components['schemas']['Uuid'];
  events: components['schemas']['AuditEvent'][];
};

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  constructor(
    private readonly http: HttpClient,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  getEvaluationAudit(evaluationId: string): Observable<EvaluationAudit> {
    return this.http.get<EvaluationAudit>(
      `${this.config.API_BASE_URL}/evaluations/${evaluationId}/audit`,
    );
  }
}
