import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import { isPublicApiRequest } from './auth.interceptor';

export const requestContextInterceptor: HttpInterceptorFn = (request, next) => {
  const { API_BASE_URL } = inject(RUNTIME_CONFIG);
  if (!isPublicApiRequest(request.url, API_BASE_URL)) return next(request);
  return next(
    request.clone({ setHeaders: { 'X-Request-Id': crypto.randomUUID() } }),
  );
};
