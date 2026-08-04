import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  RUNTIME_CONFIG,
  RuntimeConfig,
} from '../../core/config/runtime-config';
import { IdempotencyService } from '../../core/api/idempotency.service';
import { ApplicationInput } from './application-form.model';
@Injectable({ providedIn: 'root' })
export class ApplicationApiService {
  constructor(
    private http: HttpClient,
    @Inject(RUNTIME_CONFIG) private config: RuntimeConfig,
    private ids: IdempotencyService,
  ) {}
  async createAndEvaluate(input: ApplicationInput): Promise<any> {
    const createHeaders = new HttpHeaders({
      'Idempotency-Key': this.ids.forAction('create'),
    });
    const application = await firstValueFrom(
      this.http.post<any>(`${this.config.API_BASE_URL}/applications`, input, {
        headers: createHeaders,
      }),
    );
    this.ids.complete('create');
    const evaluation = await firstValueFrom(
      this.http.post<any>(
        `${this.config.API_BASE_URL}/applications/${application.applicationId}/evaluations`,
        { revisionNumber: application.revisionNumber, expectedCriteriaVersion: 'SCORING-MVP-1.0.0' },
        {
          headers: new HttpHeaders({
            'Idempotency-Key': this.ids.forAction('evaluate'),
          }),
        },
      ),
    );
    this.ids.complete('evaluate');
    return evaluation;
  }
}
