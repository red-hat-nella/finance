import { Router } from 'express';
import { z } from 'zod';
import type { AccessDecisionService } from '../../modules/access/access-decision.service.js';
import { ProblemError } from '../problem.js';

const requestSchema = z.object({ resourceClass: z.literal('credit_business') }).strict();

export function internalAccessRoutes(service: AccessDecisionService): Router {
  const router = Router();
  router.post('/access-decisions', async (req, res, next) => {
    try {
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ProblemError({
          status: 400,
          title: 'Solicitud inválida',
          detail: 'La clase de recurso no es válida.',
          code: 'BAD_REQUEST',
        });
      }
      const actor = req.actor;
      if (!actor || !req.serviceAuthenticated) throw new Error('authenticated identities missing');
      res.json(await service.decide(actor));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
