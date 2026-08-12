import { Router } from 'express';
import { ZodError } from 'zod';
import { acceptanceInputSchema, idempotencyKeySchema } from '../../modules/acceptances/acceptance.model.js';
import type { AcceptanceService } from '../../modules/acceptances/acceptance.service.js';
import { ProblemError } from '../problem.js';

export function acceptanceRoutes(service: AcceptanceService): Router {
  const router = Router();
  router.post('/acceptances', async (req, res, next) => {
    try {
      const actor = req.actor;
      if (!actor) throw new Error('authenticated actor missing');
      const input = acceptanceInputSchema.parse(req.body);
      const idempotencyKey = idempotencyKeySchema.parse(req.header('Idempotency-Key'));
      const result = await service.accept(actor, input, idempotencyKey, req.requestId);
      res.setHeader('Idempotency-Replayed', String(result.replayed));
      res.status(result.created ? 201 : 200).json(result.acceptance);
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ProblemError({
          status: 422,
          title: 'Solicitud inválida',
          detail: 'La versión, digest o clave de idempotencia no es válida.',
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
