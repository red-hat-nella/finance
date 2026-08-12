import assert from 'node:assert/strict';
import test from 'node:test';

import { runtimeConfigFromEnv } from './write-runtime-config.mjs';

const valid = {
  TERMS_API_BASE_URL: '/terms-api/',
  AUTH_MODE: 'oidc',
  OIDC_ISSUER: 'https://identity.example.test/',
  OIDC_CLIENT_ID: 'terms-web',
  OIDC_SCOPE: 'openid profile',
};

test('emits only the allowlisted public runtime settings', () => {
  const config = runtimeConfigFromEnv({ ...valid, SECRET: 'must-not-leak' });
  assert.deepEqual(config, {
    TERMS_API_BASE_URL: '/terms-api',
    AUTH_MODE: 'oidc',
    OIDC_ISSUER: 'https://identity.example.test',
    OIDC_CLIENT_ID: 'terms-web',
    OIDC_SCOPE: 'openid profile',
  });
  assert.ok(Object.isFrozen(config));
});

test('rejects cross-origin APIs and insecure issuers', () => {
  assert.throws(() => runtimeConfigFromEnv({ ...valid, TERMS_API_BASE_URL: '//evil.test' }), /same-origin/);
  assert.throws(() => runtimeConfigFromEnv({ ...valid, OIDC_ISSUER: 'http://evil.test' }), /HTTPS/);
});
