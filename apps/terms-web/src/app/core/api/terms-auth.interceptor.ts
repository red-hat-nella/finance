import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthPort } from '../auth/auth.port';
import { RUNTIME_CONFIG } from '../config/runtime-config';

export const termsAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(RUNTIME_CONFIG);
  const token = inject(AuthPort).accessToken();
  const isTermsApi = request.url === config.TERMS_API_BASE_URL
    || request.url.startsWith(`${config.TERMS_API_BASE_URL}/`);
  if (!token || !isTermsApi) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
