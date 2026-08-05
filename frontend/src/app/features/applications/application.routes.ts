import type { Routes } from '@angular/router';

export const APPLICATION_ROUTES: Routes = [
  {
    path: 'new',
    loadComponent: () =>
      import('./application-form-page.component').then(
        (module) => module.ApplicationFormPageComponent,
      ),
  },
];
