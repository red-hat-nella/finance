export type TermsRole = 'credit_analyst' | 'terms_admin' | 'supervisor' | 'auditor';

export interface Session {
  readonly actorId: string;
  readonly displayName: string;
  readonly roles: readonly TermsRole[];
  readonly organizationId?: string;
}

export abstract class AuthPort {
  abstract session(): Session | null;
  abstract accessToken(): string | null;
  abstract isAuthenticated(): boolean;
  abstract signIn(returnUrl?: string): void;
  abstract signOut(): Promise<void>;

  hasAnyRole(roles: readonly TermsRole[]): boolean {
    const session = this.session();
    return Boolean(session && roles.some((role) => session.roles.includes(role)));
  }
}
