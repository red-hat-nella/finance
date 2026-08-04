import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  RUNTIME_CONFIG,
  RuntimeConfig,
} from '../../core/config/runtime-config';
@Injectable({ providedIn: 'root' })
export class EvaluationApiService {
  constructor(
    private http: HttpClient,
    @Inject(RUNTIME_CONFIG) private config: RuntimeConfig,
  ) {}
  get(id: string) {
    return firstValueFrom(
      this.http.get<any>(`${this.config.API_BASE_URL}/evaluations/${id}`),
    );
  }
}
