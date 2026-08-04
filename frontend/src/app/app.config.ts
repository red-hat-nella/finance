import {
  ApplicationConfig,
  Provider,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideAuth,
  withAppInitializerAuthCheck,
} from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { RUNTIME_CONFIG, RuntimeConfig } from './core/config/runtime-config';
import { requestContextInterceptor } from './core/api/request-context.interceptor';
import { authInterceptor } from './core/api/auth.interceptor';
import { AuthPort } from './core/auth/auth.port';
import { DevAuthAdapter } from './core/auth/dev-auth.adapter';
import { OidcAuthAdapter } from './core/auth/oidc-auth.adapter';

export function createAppConfig(
  runtimeConfig: RuntimeConfig,
): ApplicationConfig {
  const authProvider: Provider = {
    provide: AuthPort,
    useClass:
      runtimeConfig.AUTH_MODE === 'development'
        ? DevAuthAdapter
        : OidcAuthAdapter,
  };
  const oidcProviders =
    runtimeConfig.AUTH_MODE === 'oidc'
      ? [
          provideAuth(
            {
              config: {
                authority: runtimeConfig.OIDC_ISSUER,
                clientId: runtimeConfig.OIDC_CLIENT_ID,
                redirectUrl: window.location.origin,
                postLogoutRedirectUri: window.location.origin,
                responseType: 'code',
                scope: runtimeConfig.OIDC_SCOPE,
                silentRenew: true,
                useRefreshToken: true,
                secureRoutes: [runtimeConfig.API_BASE_URL],
              },
            },
            withAppInitializerAuthCheck(),
          ),
        ]
      : [];
  return {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideRouter(
        routes,
        withInMemoryScrolling({
          scrollPositionRestoration: 'enabled',
          anchorScrolling: 'enabled',
        }),
      ),
      provideHttpClient(
        withInterceptors([requestContextInterceptor, authInterceptor]),
      ),
      provideAnimationsAsync(),
      { provide: RUNTIME_CONFIG, useValue: runtimeConfig },
      authProvider,
      ...oidcProviders,
    ],
  };
}
