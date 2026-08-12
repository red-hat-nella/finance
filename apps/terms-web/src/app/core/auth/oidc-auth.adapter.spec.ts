import { sessionFromClaims } from './oidc-auth.adapter';

describe('OIDC session mapping', () => {
  it('keeps only recognized roles and scope claims', () => {
    const session = sessionFromClaims({
      sub: 'synthetic-actor',
      name: 'Persona sintética',
      roles: ['terms_admin', 'unknown', 12],
      organization_id: 'synthetic-org',
    });

    expect(session).toEqual({
      actorId: 'synthetic-actor',
      displayName: 'Persona sintética',
      roles: ['terms_admin'],
      organizationId: 'synthetic-org',
    });
    expect(Object.isFrozen(session)).toBeTrue();
    expect(Object.isFrozen(session?.roles)).toBeTrue();
  });

  it('rejects claims without a subject', () => {
    expect(sessionFromClaims({ roles: ['terms_admin'] })).toBeNull();
  });
});
