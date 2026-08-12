import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface RuntimeConfig {
  readonly TERMS_API_BASE_URL: string;
  readonly AUTH_MODE: 'oidc' | 'e2e';
  readonly OIDC_ISSUER: string;
  readonly OIDC_CLIENT_ID: string;
  readonly OIDC_SCOPE: string;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('terms.runtime.config');

function requireNonEmpty(config: Record<string, unknown>, key: keyof RuntimeConfig): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} es obligatorio.`);
  }
  return value;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (environment.e2e) {
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) {
      throw new Error('La configuración E2E solo está permitida en localhost.');
    }
    return Object.freeze({
      TERMS_API_BASE_URL: '/terms-api',
      AUTH_MODE: 'e2e' as const,
      OIDC_ISSUER: 'http://localhost/oidc-e2e-only',
      OIDC_CLIENT_ID: 'terms-web-e2e',
      OIDC_SCOPE: 'openid profile',
    });
  }
  const response = await fetch('/terms/runtime-config.json', {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error('No fue posible cargar la configuración de términos.');
  }

  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La configuración de términos no es válida.');
  }
  const config = value as Record<string, unknown>;
  const apiBaseUrl = requireNonEmpty(config, 'TERMS_API_BASE_URL');
  if (!apiBaseUrl.startsWith('/') || apiBaseUrl.startsWith('//')) {
    throw new Error('TERMS_API_BASE_URL debe ser una ruta same-origin.');
  }
  if (config['AUTH_MODE'] !== 'oidc') {
    throw new Error('AUTH_MODE debe ser oidc.');
  }

  const issuer = requireNonEmpty(config, 'OIDC_ISSUER');
  const issuerUrl = new URL(issuer);
  if (issuerUrl.protocol !== 'https:' && issuerUrl.hostname !== 'localhost') {
    throw new Error('OIDC_ISSUER debe usar HTTPS.');
  }

  return Object.freeze({
    TERMS_API_BASE_URL: apiBaseUrl.replace(/\/$/, ''),
    AUTH_MODE: 'oidc' as const,
    OIDC_ISSUER: issuerUrl.toString().replace(/\/$/, ''),
    OIDC_CLIENT_ID: requireNonEmpty(config, 'OIDC_CLIENT_ID'),
    OIDC_SCOPE: requireNonEmpty(config, 'OIDC_SCOPE'),
  });
}
