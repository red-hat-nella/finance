import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';

export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [roleGuard(['supervisor', 'auditor'])],
    loadComponent: () =>
      import('./audit-page.component').then((m) => m.AuditPageComponent),
  },
];
