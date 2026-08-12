import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthPort, TermsRole } from './auth.port';

export function roleGuard(roles: readonly TermsRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthPort);
    if (!auth.isAuthenticated()) {
      auth.signIn('/terms/');
      return false;
    }
    return auth.hasAnyRole(roles) ? true : inject(Router).createUrlTree(['/']);
  };
}
