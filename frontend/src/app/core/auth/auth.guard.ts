import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AppRole, AuthPort } from './auth.port';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthPort);
  if (auth.isAuthenticated()) return true;
  auth.signIn();
  return false;
};

export function roleGuard(roles: readonly AppRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthPort);
    if (!auth.isAuthenticated()) {
      auth.signIn();
      return false;
    }
    return auth.hasAnyRole(roles)
      ? true
      : inject(Router).createUrlTree(['/evaluations'], {
          queryParams: { access: 'denied' },
        });
  };
}
