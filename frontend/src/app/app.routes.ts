import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'applications/new',
    canActivate: [authGuard, roleGuard(['credit_analyst'])],
    loadComponent: () =>
      import('./features/applications/application-form-page.component').then(
        (m) => m.ApplicationFormPageComponent,
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
