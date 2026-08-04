import type { Routes } from '@angular/router';

export const HISTORY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./history-page.component').then((m) => m.HistoryPageComponent),
  },
  {
    path: ':id/details',
    loadComponent: () =>
      import('../detail/evaluation-detail-page.component').then(
        (m) => m.EvaluationDetailPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('../evaluation-result/evaluation-result-page.component').then(
        (m) => m.EvaluationResultPageComponent,
      ),
  },
];
