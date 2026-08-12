import type { NextFunction, Request, Response } from 'express';
import type { JwtVerifier } from '../../infrastructure/auth/jwt-verifier.js';
import type { AppRole } from './request-context.js';
import { sendProblem } from '../problem.js';

export function authenticate(verify: JwtVerifier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = req.header('Authorization');
      if (!authorization?.startsWith('Bearer ') || authorization.length <= 7) {
        throw new Error('missing bearer token');
      }
      req.actor = await verify(authorization.slice(7));
      next();
    } catch {
      sendProblem(req, res, {
        status: 401,
        title: 'No autorizado',
        detail: 'Se requieren credenciales válidas.',
        code: 'UNAUTHORIZED',
      });
    }
  };
}

export function authorizeRoles(...allowed: readonly AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.actor || !req.actor.roles.some((role) => allowed.includes(role))) {
      sendProblem(req, res, {
        status: 403,
        title: 'Acceso denegado',
        detail: 'No tiene permisos para esta operación.',
        code: 'FORBIDDEN',
      });
      return;
    }
    next();
  };
}

export function requireAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (!req.actor) {
    sendProblem(req, res, {
      status: 401,
      title: 'No autorizado',
      detail: 'Se requieren credenciales válidas.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  next();
}
