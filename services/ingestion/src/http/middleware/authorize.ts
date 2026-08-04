import type { NextFunction, Request, Response } from "express";
import { canRead } from "../../domain/authorization/policies.js";
import { sendProblem } from "../problem.js";

export function authorizeRead(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.actor || !canRead(req.actor)) {
    sendProblem(req, res, {
      status: 403,
      title: "Acceso denegado",
      detail: "No tiene permisos para esta operación.",
      code: "FORBIDDEN",
    });
    return;
  }
  next();
}
