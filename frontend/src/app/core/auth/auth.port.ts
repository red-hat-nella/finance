export type AppRole = 'credit_analyst' | 'supervisor' | 'auditor';

export interface Session {
  readonly actorId: string;
  readonly displayName: string;
  readonly roles: readonly AppRole[];
}

export abstract class AuthPort {
  abstract session(): Session | null;
  abstract accessToken(): string | null;
  abstract isAuthenticated(): boolean;
  abstract signIn(): void;
  abstract signOut(): Promise<void>;

  hasAnyRole(roles: readonly AppRole[]): boolean {
    const session = this.session();
    return Boolean(
      session && roles.some((role) => session.roles.includes(role)),
    );
  }
}
