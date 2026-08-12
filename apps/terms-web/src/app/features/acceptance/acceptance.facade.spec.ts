import { Acceptance } from '../../core/api/terms-api.service';
import { AuthPort, Session } from '../../core/auth/auth.port';
import { AcceptanceFacade } from './acceptance.facade';
import { TermsApiError, TermsApiService } from '../../core/api/terms-api.service';

const version = {
  versionId: '00000000-0000-4000-8000-000000000101', versionCode: 'TERMS-1',
  title: 'Términos', contentSha256: 'a'.repeat(64), state: 'EFFECTIVE' as const,
  contentFormat: 'markdown' as const, content: 'Texto', effectiveAt: '2026-08-12T00:00:00Z',
};

class FakeApi {
  getCurrent = jasmine.createSpy('getCurrent').and.resolveTo({ version, acceptanceStatus: 'PENDING', acceptedAt: null });
  accept = jasmine.createSpy('accept').and.resolveTo({
    acceptanceId: '00000000-0000-4000-8000-000000000201', versionId: version.versionId,
    versionCode: version.versionCode, acceptedAt: '2026-08-12T12:00:00Z', contentSha256: version.contentSha256,
  } satisfies Acceptance);
}

class FakeAuth extends AuthPort {
  session(): Session | null { return { actorId: 'synthetic', displayName: 'Synthetic', roles: ['credit_analyst'] }; }
  accessToken(): string | null { return 'token'; }
  isAuthenticated(): boolean { return true; }
  signIn(): void {}
  async signOut(): Promise<void> {}
}

describe('AcceptanceFacade', () => {
  it('uses one idempotency key and prevents a second submission after success', async () => {
    const api = new FakeApi();
    const facade = new AcceptanceFacade(api as unknown as TermsApiService, new FakeAuth());
    await facade.load();
    await facade.accept();
    await facade.accept();
    expect(api.accept).toHaveBeenCalledTimes(1);
    expect(api.accept.calls.first().args[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(facade.state().kind).toBe('success');
  });

  it('recovers safely when the effective version changed', async () => {
    const api = new FakeApi();
    api.accept.and.rejectWith(new TermsApiError(409, 'TERMS_VERSION_CHANGED', true));
    const facade = new AcceptanceFacade(api as unknown as TermsApiService, new FakeAuth());
    await facade.load();
    await facade.accept();
    expect(facade.state()).toEqual({ kind: 'changed' });
  });
});
