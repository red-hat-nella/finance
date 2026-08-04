import { loadRuntimeConfig } from './runtime-config';

describe('runtime configuration', () => {
  it('loads and freezes a same-origin public API configuration', async () => {
    spyOn(window, 'fetch').and.resolveTo(
      new Response(
        JSON.stringify({
          API_BASE_URL: '/api/v1',
          AUTH_MODE: 'development',
          OIDC_ISSUER: '',
          OIDC_CLIENT_ID: '',
          OIDC_SCOPE: 'openid profile',
          APP_TIMEZONE: 'America/Bogota',
        }),
        { status: 200 },
      ),
    );

    const config = await loadRuntimeConfig();

    expect(config.API_BASE_URL).toBe('/api/v1');
    expect(Object.isFrozen(config)).toBeTrue();
    expect(window.fetch).toHaveBeenCalledWith('/runtime-config.json', {
      cache: 'no-store',
    });
  });

  it('rejects absolute and protocol-relative API URLs', async () => {
    const fetchSpy = spyOn(window, 'fetch');
    for (const API_BASE_URL of [
      'https://scoring.internal/api',
      '//scoring.internal/api',
    ]) {
      fetchSpy.and.resolveTo(
        new Response(
          JSON.stringify({
            API_BASE_URL,
            AUTH_MODE: 'oidc',
            OIDC_ISSUER: 'https://identity.example.test',
            OIDC_CLIENT_ID: 'scoring-ui',
            OIDC_SCOPE: 'openid profile',
            APP_TIMEZONE: 'America/Bogota',
          }),
          { status: 200 },
        ),
      );
      await expectAsync(loadRuntimeConfig()).toBeRejectedWithError(
        /same-origin/,
      );
    }
  });
});
