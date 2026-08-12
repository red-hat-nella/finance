import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';
export const ACCEPTANCE_AUDIT_ROUTES:Routes=[{path:'',canActivate:[roleGuard(['supervisor','auditor'])],loadComponent:()=>import('./acceptance-audit-page.component').then(module=>module.AcceptanceAuditPageComponent)}];
