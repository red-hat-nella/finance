import { Router } from 'express';
import type { AcceptanceService } from '../../modules/acceptances/acceptance.service.js';

export function currentRoutes(service: AcceptanceService): Router {
  const router = Router();
  router.get('/current', async (req, res, next) => {
    try {
      const actor = req.actor;
      if (!actor) throw new Error('authenticated actor missing');
      const result = await service.current(actor);
      res.setHeader('ETag', `"sha256-${result.version.contentSha256}"`);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
