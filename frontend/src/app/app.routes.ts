import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'applications',
    canActivate: [authGuard, roleGuard(['credit_analyst'])],
    loadChildren: () =>
      import('./features/applications/application.routes').then(
        (module) => module.APPLICATION_ROUTES,
      ),
  },
  {
    path: 'evaluations',
    canActivate: [
      authGuard,
      roleGuard(['credit_analyst', 'supervisor', 'auditor']),
    ],
    loadChildren: () =>
      import('./features/history/history.routes').then((m) => m.HISTORY_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'applications/new' },
  { path: '**', redirectTo: 'applications/new' },
];
