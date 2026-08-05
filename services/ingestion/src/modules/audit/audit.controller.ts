import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { sendProblem } from "../../http/problem.js";
import {
  AuditNotFoundError,
  type GetEvaluationAuditService,
} from "./get-evaluation-audit.service.js";

const idSchema = z.uuid();

export function getEvaluationAuditController(
  service: GetEvaluationAuditService,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const actor = req.actor;
    if (!actor) return;
    if (!actor.roles.some((role) => role === "supervisor" || role === "auditor")) {
      await service.recordDenied(actor, req.requestId);
      sendProblem(req, res, {
        status: 403,
        title: "Operación no permitida",
        detail: "No tienes permiso para consultar la auditoría.",
        code: "FORBIDDEN",
      });
      return;
    }
    const evaluationId = idSchema.safeParse(req.params.evaluationId);
    if (!evaluationId.success) {
      sendNotFound(req, res);
      return;
    }
    try {
      res.status(200).json(
        await service.execute(evaluationId.data, actor, req.requestId),
      );
    } catch (error) {
      if (error instanceof AuditNotFoundError) {
        sendNotFound(req, res);
        return;
      }
      next(error);
    }
  };
}

function sendNotFound(req: Request, res: Response): void {
  sendProblem(req, res, {
    status: 404,
    title: "Evaluación no disponible",
    detail: "No fue posible abrir la auditoría solicitada.",
    code: "EVALUATION_NOT_AVAILABLE",
  });
}
