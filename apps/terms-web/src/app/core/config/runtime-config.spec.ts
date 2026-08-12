import { loadRuntimeConfig } from './runtime-config';

describe('terms runtime configuration', () => {
  afterEach(() => jasmine.clock().uninstall());

  it('loads and freezes same-origin API and secure OIDC values', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      TERMS_API_BASE_URL: '/terms-api/',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://identity.example.test/',
      OIDC_CLIENT_ID: 'terms-web',
      OIDC_SCOPE: 'openid profile terms.read',
    })));

    const config = await loadRuntimeConfig();

    expect(window.fetch).toHaveBeenCalledWith('/terms/runtime-config.json', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(config.TERMS_API_BASE_URL).toBe('/terms-api');
    expect(Object.isFrozen(config)).toBeTrue();
  });

  it('rejects a cross-origin API endpoint', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      TERMS_API_BASE_URL: 'https://outside.example.test',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://identity.example.test',
      OIDC_CLIENT_ID: 'terms-web',
      OIDC_SCOPE: 'openid',
    })));

    await expectAsync(loadRuntimeConfig()).toBeRejectedWithError(/same-origin/);
  });
});
