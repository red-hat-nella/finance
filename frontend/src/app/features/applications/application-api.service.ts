import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdempotencyService } from '../../core/api/idempotency.service';
import {
  RUNTIME_CONFIG,
  RuntimeConfig,
} from '../../core/config/runtime-config';
import { ApplicationDraftInput } from './application-form.model';

export interface ApplicationResource extends ApplicationDraftInput {
  applicationId: string;
  state: 'borrador' | 'evaluando' | 'evaluada' | 'revision_manual' | 'error';
  revisionNumber: number;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
  draftExpiresAt: string | null;
}

export interface VersionedApplication {
  resource: ApplicationResource;
  etag: string;
}

@Injectable({ providedIn: 'root' })
export class ApplicationApiService {
  constructor(
    private http: HttpClient,
    @Inject(RUNTIME_CONFIG) private config: RuntimeConfig,
    private ids: IdempotencyService,
  ) {}

  async create(input: ApplicationDraftInput): Promise<VersionedApplication> {
    const action = 'create-application';
    const response = await firstValueFrom(
      this.http.post<ApplicationResource>(
        `${this.config.API_BASE_URL}/applications`,
        input,
        {
          headers: new HttpHeaders({
            'Idempotency-Key': this.ids.forAction(action),
          }),
          observe: 'response',
        },
      ),
    );
    this.ids.complete(action);
    return this.versioned(response);
  }

  async get(applicationId: string): Promise<VersionedApplication> {
    return this.versioned(
      await firstValueFrom(
        this.http.get<ApplicationResource>(
          `${this.config.API_BASE_URL}/applications/${applicationId}`,
          { observe: 'response' },
        ),
      ),
    );
  }

  async update(
    applicationId: string,
    input: ApplicationDraftInput,
    etag: string,
  ): Promise<VersionedApplication> {
    return this.versioned(
      await firstValueFrom(
        this.http.patch<ApplicationResource>(
          `${this.config.API_BASE_URL}/applications/${applicationId}`,
          input,
          {
            headers: new HttpHeaders({
              'Content-Type': 'application/merge-patch+json',
              'If-Match': etag,
            }),
            observe: 'response',
          },
        ),
      ),
    );
  }

  async evaluate(application: VersionedApplication): Promise<unknown> {
    const action = `evaluate-${application.resource.applicationId}`;
    const result = await firstValueFrom(
      this.http.post<unknown>(
        `${this.config.API_BASE_URL}/applications/${application.resource.applicationId}/evaluations`,
        {
          revisionNumber: application.resource.revisionNumber,
          expectedCriteriaVersion: 'SCORING-MVP-1.0.0',
        },
        {
          headers: new HttpHeaders({
            'Idempotency-Key': this.ids.forAction(action),
            'If-Match': application.etag,
          }),
        },
      ),
    );
    this.ids.complete(action);
    return result;
  }

  private versioned(
    response: HttpResponse<ApplicationResource>,
  ): VersionedApplication {
    const resource = response.body;
    const etag = response.headers.get('ETag');
    if (!resource || !etag)
      throw new Error('La respuesta no incluyó el recurso o su versión.');
    return { resource, etag };
  }
}
