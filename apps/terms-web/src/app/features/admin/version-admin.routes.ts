import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/role.guard';

export const VERSION_ADMIN_ROUTES: Routes = [
  { path: '', canActivate: [roleGuard(['terms_admin'])], loadComponent: () => import('./version-admin-page.component').then((module) => module.VersionAdminPageComponent) },
  { path: 'new', canActivate: [roleGuard(['terms_admin'])], loadComponent: () => import('./version-editor.component').then((module) => module.VersionEditorComponent) },
  { path: ':versionId', canActivate: [roleGuard(['terms_admin'])], loadComponent: () => import('./version-admin-page.component').then((module) => module.VersionAdminPageComponent) },
];
