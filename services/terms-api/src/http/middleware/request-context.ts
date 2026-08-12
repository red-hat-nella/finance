/* eslint-disable @typescript-eslint/no-namespace */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const APP_ROLES = [
  'credit_analyst',
  'supervisor',
  'auditor',
  'terms_admin',
] as const;
export type AppRole = (typeof APP_ROLES)[number];
export interface ActorContext {
  readonly actorId: string;
  readonly orgId: string;
  readonly roles: readonly AppRole[];
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: ActorContext;
      serviceAuthenticated?: boolean;
    }
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('X-Request-Id');
  req.requestId = supplied && UUID_PATTERN.test(supplied) ? supplied : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function requireRequestId(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('X-Request-Id');
  if (!supplied || !UUID_PATTERN.test(supplied)) {
    res.status(400).type('application/problem+json').json({
      type: 'https://errors.example.test/invalid-request-id',
      title: 'Identificador de solicitud inválido',
      status: 400,
      detail: 'X-Request-Id debe contener un UUID válido.',
      code: 'INVALID_REQUEST_ID',
      retryable: false,
      requestId: req.requestId,
    });
    return;
  }
  next();
}
