import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthPort } from '../auth/auth.port';
import { RUNTIME_CONFIG } from '../config/runtime-config';

export function isPublicApiRequest(url: string, apiBaseUrl: string): boolean {
  return url === apiBaseUrl || url.startsWith(`${apiBaseUrl}/`);
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(RUNTIME_CONFIG);
  const token = inject(AuthPort).accessToken();
  if (!token || !isPublicApiRequest(request.url, config.API_BASE_URL))
    return next(request);
  return next(
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
