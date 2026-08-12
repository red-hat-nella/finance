import { safeReturnUrl } from './return-url.service';

describe('safeReturnUrl', () => {
  it('allows only known same-origin business destinations', () => {
    expect(safeReturnUrl('/applications/new')).toBe('/applications/new');
    expect(safeReturnUrl('/evaluations/00000000-0000-4000-8000-000000000001?tab=detail')).toContain('/evaluations/');
  });

  it('rejects absolute, protocol-relative, terms and unknown destinations', () => {
    for (const value of ['https://evil.example', '//evil.example', '/terms/', '/admin', null]) {
      expect(safeReturnUrl(value)).toBe('/applications/new');
    }
  });
});
