import { Injectable } from '@angular/core';
import { AuthPort, Session } from './auth.port';
@Injectable()
export class DevAuthAdapter extends AuthPort {
  session(): Session {
    const role = this.developmentRole();
    const displayName =
      role === 'supervisor'
        ? 'Supervisor local'
        : role === 'auditor'
          ? 'Auditor local'
          : 'Analista local';
    return Object.freeze({
      actorId: role === 'credit_analyst' ? 'analyst-local' : `${role}-local`,
      displayName,
      roles: Object.freeze([role]),
    });
  }
  accessToken(): null {
    return null;
  }
  isAuthenticated(): boolean {
    return true;
  }
  signIn(): void {}
  async signOut(): Promise<void> {
    return Promise.resolve();
  }

  private developmentRole(): Session['roles'][number] {
    const configured = window.sessionStorage.getItem('scoring.dev.role');
    return configured === 'supervisor' || configured === 'auditor'
      ? configured
      : 'credit_analyst';
  }
}
