import { Injectable } from '@angular/core';
import { AuthPort, Session } from './auth.port';
@Injectable()
export class DevAuthAdapter extends AuthPort {
  private readonly localSession = Object.freeze<Session>({
    actorId: 'analyst-local',
    displayName: 'Analista local',
    roles: Object.freeze(['credit_analyst']),
  });

  session(): Session {
    return this.localSession;
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
}
