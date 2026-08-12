import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../../config/schema.js';
import { sendProblem } from '../problem.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function serviceAuth(config: Pick<AppConfig, 'serviceAuth'>) {
  const expected = digest(config.serviceAuth.token);
  return (req: Request, res: Response, next: NextFunction): void => {
    const supplied = req.header('X-Service-Token');
    if (!supplied || !timingSafeEqual(digest(supplied), expected)) {
      sendProblem(req, res, {
        status: 401,
        title: 'Identidad de servicio inválida',
        detail: 'Se requiere una identidad de servicio válida.',
        code: 'INVALID_SERVICE_IDENTITY',
      });
      return;
    }
    req.serviceAuthenticated = true;
    next();
  };
}
