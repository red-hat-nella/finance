import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import { isPublicApiRequest } from './auth.interceptor';

const DEFAULT_RETURN_URL = '/applications/new';
const AUTHORIZED_BUSINESS_DESTINATION = /^\/(?:applications(?:\/new)?|evaluations(?:\/[A-Za-z0-9-]+)?)\/?$/;

export function authorizedReturnUrl(value: string): string {
  const path = value.split(/[?#]/, 1)[0] || '';
  return AUTHORIZED_BUSINESS_DESTINATION.test(path) ? value : DEFAULT_RETURN_URL;
}

function acceptancePath(error: HttpErrorResponse): string {
  const body = error.error && typeof error.error === 'object'
    ? error.error as Record<string, unknown>
    : {};
  const candidate = typeof body['acceptanceUrl'] === 'string' ? body['acceptanceUrl'] : '/terms/';
  return /^\/terms(?:\/|$)/.test(candidate) && !candidate.startsWith('//') ? candidate : '/terms/';
}

export const termsRequiredInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const config = inject(RUNTIME_CONFIG);
  return next(request).pipe(catchError((error: unknown) => {
    if (
      isPublicApiRequest(request.url, config.API_BASE_URL)
      && error instanceof HttpErrorResponse
      && error.status === 428
    ) {
      const body = error.error && typeof error.error === 'object'
        ? error.error as Record<string, unknown>
        : {};
      if (body['code'] === 'TERMS_ACCEPTANCE_REQUIRED') {
        const returnUrl = encodeURIComponent(authorizedReturnUrl(router.url));
        window.location.assign(`${acceptancePath(error)}?returnUrl=${returnUrl}`);
      }
    }
    return throwError(() => error);
  }));
};
