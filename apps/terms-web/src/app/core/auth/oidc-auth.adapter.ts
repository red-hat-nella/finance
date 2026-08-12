import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';

import { AuthPort, Session, TermsRole } from './auth.port';

const TERMS_ROLES = new Set<TermsRole>([
  'credit_analyst',
  'terms_admin',
  'supervisor',
  'auditor',
]);

export function sessionFromClaims(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null;
  const claims = value as Record<string, unknown>;
  if (typeof claims['sub'] !== 'string') return null;
  const roleClaims = Array.isArray(claims['roles']) ? claims['roles'] : [];
  const roles = roleClaims.filter(
    (role): role is TermsRole => typeof role === 'string' && TERMS_ROLES.has(role as TermsRole),
  );
  const displayName = typeof claims['name'] === 'string' ? claims['name'] : claims['sub'];
  const organizationId = typeof claims['organization_id'] === 'string'
    ? claims['organization_id']
    : undefined;
  return Object.freeze({
    actorId: claims['sub'],
    displayName,
    roles: Object.freeze(roles),
    ...(organizationId ? { organizationId } : {}),
  });
}

@Injectable()
export class OidcAuthAdapter extends AuthPort {
  private readonly destroyRef = inject(DestroyRef);
  private currentSession: Session | null = null;
  private token: string | null = null;
  private authenticated = false;

  constructor(private readonly oidc: OidcSecurityService) {
    super();
    this.oidc.isAuthenticated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ isAuthenticated }) => (this.authenticated = isAuthenticated));
    this.oidc.userData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ userData }) => (this.currentSession = sessionFromClaims(userData)));
    this.oidc.getAccessToken()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((token) => (this.token = token || null));
  }

  session(): Session | null {
    return this.currentSession;
  }

  accessToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  signIn(): void {
    this.oidc.authorize();
  }

  async signOut(): Promise<void> {
    this.currentSession = null;
    this.token = null;
    this.authenticated = false;
    await firstValueFrom(this.oidc.logoff());
  }
}
