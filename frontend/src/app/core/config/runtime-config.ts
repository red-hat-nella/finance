import { InjectionToken } from '@angular/core';

export interface RuntimeConfig { API_BASE_URL: string; AUTH_MODE: 'oidc' | 'development'; OIDC_ISSUER: string; OIDC_CLIENT_ID: string; OIDC_SCOPE: string; APP_TIMEZONE: 'America/Bogota' }
export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('runtime.config');
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/runtime-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('No fue posible cargar la configuración de la aplicación.');
  const config = await response.json() as RuntimeConfig;
  if (!config.API_BASE_URL.startsWith('/') || config.API_BASE_URL.startsWith('//')) throw new Error('API_BASE_URL debe ser same-origin.');
  if (!['oidc','development'].includes(config.AUTH_MODE)) throw new Error('AUTH_MODE inválido.');
  return Object.freeze(config);
}
