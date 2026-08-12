import { Router } from 'express';
import { ZodError } from 'zod';
import type { AcceptanceAuditService } from '../../modules/audit/acceptance-audit.service.js';
import { acceptanceSearchSchema } from '../../modules/audit/acceptance-search.model.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { ProblemError } from '../problem.js';

export function acceptanceAuditRoutes(service: AcceptanceAuditService): Router {
  const router = Router();
  router.post('/audit/acceptances/search', authorizeRoles('supervisor', 'auditor'), async (req, res, next) => {
    try {
      const actor = req.actor;
      if (!actor) throw new Error('authenticated actor missing');
      res.json(await service.search(actor, acceptanceSearchSchema.parse(req.body)));
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ProblemError({
          status: 422, title: 'Filtros inválidos',
          detail: 'Los filtros o límites de búsqueda no son válidos.',
          code: 'VALIDATION_FAILED',
          errors: error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
        }));
        return;
      }
      next(error);
    }
  });
  return router;
}
