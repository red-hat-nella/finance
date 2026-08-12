import { ApplicationConfig, Provider, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAuth, withAppInitializerAuthCheck } from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { AuthPort } from './core/auth/auth.port';
import { OidcAuthAdapter } from './core/auth/oidc-auth.adapter';
import { RUNTIME_CONFIG, RuntimeConfig } from './core/config/runtime-config';
import { termsAuthInterceptor } from './core/api/terms-auth.interceptor';
import { E2eAuthAdapter } from './core/auth/e2e-auth.adapter';

export function createAppConfig(runtimeConfig: RuntimeConfig): ApplicationConfig {
  const authProvider: Provider = {
    provide: AuthPort,
    useClass: runtimeConfig.AUTH_MODE === 'e2e' ? E2eAuthAdapter : OidcAuthAdapter,
  };
  const oidcProviders = runtimeConfig.AUTH_MODE === 'oidc' ? [
    provideAuth({ config: {
      authority: runtimeConfig.OIDC_ISSUER,
      clientId: runtimeConfig.OIDC_CLIENT_ID,
      redirectUrl: `${window.location.origin}/terms/`,
      postLogoutRedirectUri: `${window.location.origin}/terms/`,
      responseType: 'code',
      scope: runtimeConfig.OIDC_SCOPE,
      silentRenew: true,
      useRefreshToken: true,
      secureRoutes: [runtimeConfig.TERMS_API_BASE_URL],
    } }, withAppInitializerAuthCheck()),
  ] : [];
  return {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideRouter(routes, withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      })),
      provideHttpClient(withInterceptors([termsAuthInterceptor])),
      { provide: RUNTIME_CONFIG, useValue: runtimeConfig },
      authProvider,
      ...oidcProviders,
    ],
  };
}
