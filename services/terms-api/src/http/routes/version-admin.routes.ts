import { Router } from 'express';
import { ZodError } from 'zod';
import type { VersionAdminService } from '../../modules/versions/version-admin.service.js';
import {
  createVersionCommandSchema,
  scheduleVersionCommandSchema,
  versionIdSchema,
} from '../../modules/versions/version.commands.js';
import { idempotencyKeySchema } from '../../modules/acceptances/acceptance.model.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { ProblemError } from '../problem.js';

export function versionAdminRoutes(service: VersionAdminService): Router {
  const router = Router();
  const canRead = authorizeRoles('terms_admin', 'supervisor', 'auditor');
  const canMutate = authorizeRoles('terms_admin');

  router.get('/admin/versions', canRead, async (_req, res, next) => {
    try { res.json({ items: await service.list() }); } catch (error) { next(error); }
  });
  router.get('/admin/versions/:versionId', canRead, async (req, res, next) => {
    try { res.json(await service.get(versionIdSchema.parse(req.params.versionId))); }
    catch (error) { next(toValidation(error)); }
  });
  router.post('/admin/versions', canMutate, async (req, res, next) => {
    try {
      const actor = requiredActor(req.actor);
      const command = createVersionCommandSchema.parse(req.body);
      const key = idempotencyKeySchema.parse(req.header('Idempotency-Key'));
      const result = await service.create(actor, command, key, req.requestId);
      res.setHeader('Idempotency-Replayed', String(result.replayed));
      res.status(result.replayed ? 200 : 201).json(result.version);
    } catch (error) { next(toValidation(error)); }
  });
  router.post('/admin/versions/:versionId/schedule', canMutate, async (req, res, next) => {
    try {
      const actor = requiredActor(req.actor);
      const versionId = versionIdSchema.parse(req.params.versionId);
      const command = scheduleVersionCommandSchema.parse(req.body);
      const key = idempotencyKeySchema.parse(req.header('Idempotency-Key'));
      const result = await service.schedule(actor, versionId, command, key, req.requestId);
      res.setHeader('Idempotency-Replayed', String(result.replayed));
      res.json(result.version);
    } catch (error) { next(toValidation(error)); }
  });
  router.post('/admin/versions/:versionId/withdraw', canMutate, async (req, res, next) => {
    try {
      const actor = requiredActor(req.actor);
      const versionId = versionIdSchema.parse(req.params.versionId);
      const key = idempotencyKeySchema.parse(req.header('Idempotency-Key'));
      const result = await service.withdraw(actor, versionId, key, req.requestId);
      res.setHeader('Idempotency-Replayed', String(result.replayed));
      res.json(result.version);
    } catch (error) { next(toValidation(error)); }
  });
  return router;
}

function requiredActor(actor: Express.Request['actor']): NonNullable<Express.Request['actor']> {
  if (!actor) throw new Error('authenticated actor missing');
  return actor;
}
function toValidation(error: unknown): unknown {
  if (!(error instanceof ZodError)) return error;
  return new ProblemError({
    status: 422,
    title: 'Solicitud inválida',
    detail: 'Los datos de la versión no son válidos.',
    code: 'VALIDATION_FAILED',
    errors: error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
  });
}
