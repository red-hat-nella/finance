import type { NextFunction, Request, Response } from "express";
import { sendProblem } from "../../http/problem.js";
import {
  HistoryValidationError,
  type SearchHistoryService,
} from "./search-history.service.js";

export function searchEvaluationsController(service: SearchHistoryService) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.actor;
      if (!actor) {
        sendProblem(req, res, {
          status: 401,
          title: "Autenticación requerida",
          detail: "Inicia una sesión válida para continuar.",
          code: "UNAUTHORIZED",
        });
        return;
      }
      const result = await service.execute(req.body, actor, req.requestId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HistoryValidationError) {
        sendProblem(req, res, {
          status: 422,
          title: "Filtros inválidos",
          detail: "Corrija los filtros indicados antes de consultar.",
          code: "VALIDATION_FAILED",
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  };
}
