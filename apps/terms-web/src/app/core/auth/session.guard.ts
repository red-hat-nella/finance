import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { AuthPort } from './auth.port';

export const sessionGuard: CanActivateFn = () => {
  const auth = inject(AuthPort);
  if (auth.isAuthenticated()) return true;
  auth.signIn('/terms/');
  return false;
};
