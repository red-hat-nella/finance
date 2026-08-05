import { DevAuthAdapter } from './dev-auth.adapter';

describe('development authentication adapter', () => {
  afterEach(() => window.sessionStorage.clear());

  it('provides only the explicit local analyst session and never a bearer token', () => {
    const auth = new DevAuthAdapter();
    const session = auth.session();

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.accessToken()).toBeNull();
    expect(session.actorId).toBe('analyst-local');
    expect(session.roles).toEqual(['credit_analyst']);
    expect(Object.isFrozen(session)).toBeTrue();
    expect(Object.isFrozen(session.roles)).toBeTrue();
  });

  it('does not grant supervisor or auditor capabilities', () => {
    const auth = new DevAuthAdapter();
    expect(auth.hasAnyRole(['credit_analyst'])).toBeTrue();
    expect(auth.hasAnyRole(['supervisor', 'auditor'])).toBeFalse();
  });

  it('allows an explicit session-scoped supervisor or auditor fixture', () => {
    window.sessionStorage.setItem('scoring.dev.role', 'supervisor');
    const supervisor = new DevAuthAdapter();
    expect(supervisor.session()).toEqual(
      jasmine.objectContaining({
        actorId: 'supervisor-local',
        roles: ['supervisor'],
      }),
    );
    expect(supervisor.hasAnyRole(['supervisor'])).toBeTrue();

    window.sessionStorage.setItem('scoring.dev.role', 'unexpected');
    expect(new DevAuthAdapter().session().roles).toEqual(['credit_analyst']);
  });
});
