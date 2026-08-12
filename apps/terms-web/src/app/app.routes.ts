import { Routes } from '@angular/router';
import { sessionGuard } from './core/auth/session.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/acceptance/acceptance-page.component')
      .then((module) => module.AcceptancePageComponent),
  },
  {
    path: 'versions',
    canActivate: [sessionGuard],
    loadChildren: () => import('./features/admin/version-admin.routes')
      .then((module) => module.VERSION_ADMIN_ROUTES),
  },
  {
    path: 'acceptances',
    canActivate: [sessionGuard],
    loadChildren: () => import('./features/audit/acceptance-audit.routes')
      .then((module) => module.ACCEPTANCE_AUDIT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
