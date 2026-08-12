import { Injectable } from '@angular/core';

import { AuthPort, Session } from './auth.port';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

@Injectable()
export class E2eAuthAdapter extends AuthPort {
  private readonly enabled = LOCAL_HOSTS.has(window.location.hostname);
  private readonly syntheticSession: Session = Object.freeze({
    actorId: 'e2e-synthetic-actor',
    displayName: 'Persona E2E sintética',
    roles: Object.freeze(['credit_analyst', 'terms_admin', 'supervisor', 'auditor'] as const),
    organizationId: 'e2e-synthetic-org',
  });

  constructor() {
    super();
    if (!this.enabled) throw new Error('E2E authentication is restricted to localhost.');
  }

  session(): Session | null { return this.syntheticSession; }
  accessToken(): string | null { return 'e2e-synthetic-token-not-a-jwt'; }
  isAuthenticated(): boolean { return true; }
  signIn(): void {}
  async signOut(): Promise<void> { window.history.replaceState(null, '', '/terms/?signedOut=true'); }
}
