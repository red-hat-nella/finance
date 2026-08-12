import { authorizedReturnUrl } from './terms-required.interceptor';

describe('terms-required interceptor destination policy', () => {
  it('preserves only recognized business destinations', () => {
    expect(authorizedReturnUrl('/applications/new')).toBe('/applications/new');
    expect(authorizedReturnUrl('/evaluations/id-1?tab=result')).toBe('/evaluations/id-1?tab=result');
  });

  it('falls back for terms, external and unknown destinations', () => {
    expect(authorizedReturnUrl('/terms/')).toBe('/applications/new');
    expect(authorizedReturnUrl('//evil.example')).toBe('/applications/new');
    expect(authorizedReturnUrl('/unknown')).toBe('/applications/new');
  });
});
