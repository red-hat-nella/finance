/* eslint-disable @typescript-eslint/no-namespace */
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { ActorContext } from "../../domain/authorization/policies.js";
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: ActorContext;
    }
  }
}
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const supplied = req.header("X-Request-Id");
  req.requestId =
    supplied && /^[0-9a-f-]{36}$/i.test(supplied) ? supplied : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
