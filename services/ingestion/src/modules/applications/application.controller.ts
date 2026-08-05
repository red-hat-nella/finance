import type { NextFunction, Request, Response } from "express";
import { sendProblem } from "../../http/problem.js";
import {
  ApplicationServiceError,
  type ApplicationService,
  type ApplicationServiceResult,
} from "./application.service.js";

function analyst(req: Request, res: Response): boolean {
  if (!req.actor?.roles.includes("credit_analyst")) {
    sendProblem(req, res, {
      status: 403,
      title: "Acceso denegado",
      detail: "Solo un analista de crédito puede modificar solicitudes.",
      code: "FORBIDDEN",
    });
    return false;
  }
  return true;
}

function sendResult(res: Response, result: ApplicationServiceResult): void {
  res.set("ETag", result.etag);
  if (result.location) res.location(result.location);
  if (result.replayed !== undefined)
    res.set("Idempotency-Replayed", String(result.replayed));
  res.status(result.status).json(result.body);
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function handleKnownError(
  req: Request,
  res: Response,
  error: unknown,
): boolean {
  if (!(error instanceof ApplicationServiceError)) return false;
  const title =
    error.status === 404
      ? "Solicitud no disponible"
      : error.status === 412
        ? "El borrador cambió"
        : error.status === 422
          ? "Revisa los campos indicados"
          : "Operación en conflicto";
  sendProblem(req, res, {
    status: error.status,
    title,
    detail: error.detail,
    code:
      error.code === "APPLICATION_NOT_FOUND"
        ? "APPLICATION_NOT_AVAILABLE"
        : error.code === "PRECONDITION_FAILED"
          ? "REVISION_CONFLICT"
          : error.code,
    retryable:
      error.code === "PRECONDITION_FAILED" ||
      error.code === "IDEMPOTENCY_IN_PROGRESS",
    errors: error.errors,
    ...(error.existingApplicationId
      ? { existingApplicationId: error.existingApplicationId }
      : {}),
  });
  return true;
}

export function createApplicationController(service: ApplicationService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!analyst(req, res)) return;
    const key = req.header("Idempotency-Key");
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      sendProblem(req, res, {
        status: 400,
        title: "Falta información de la solicitud",
        detail: "Envíe una clave de idempotencia válida.",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      });
      return;
    }
    try {
      const actor = req.actor;
      if (!actor) return;
      sendResult(
        res,
        await service.create(req.body, actor, req.requestId, key),
      );
    } catch (error) {
      if (!handleKnownError(req, res, error)) next(error);
    }
  };
}

export function getApplicationController(service: ApplicationService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor;
      if (!actor) return;
      sendResult(
        res,
        await service.get(routeParam(req, "applicationId"), actor),
      );
    } catch (error) {
      if (!handleKnownError(req, res, error)) next(error);
    }
  };
}

export function updateApplicationController(service: ApplicationService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!analyst(req, res)) return;
    const ifMatch = req.header("If-Match");
    if (!ifMatch) {
      sendProblem(req, res, {
        status: 412,
        title: "El borrador cambió",
        detail: "Recargue la solicitud antes de guardar.",
        code: "REVISION_CONFLICT",
        retryable: true,
      });
      return;
    }
    try {
      const actor = req.actor;
      if (!actor) return;
      sendResult(
        res,
        await service.update(
          routeParam(req, "applicationId"),
          req.body,
          ifMatch,
          actor,
          req.requestId,
        ),
      );
    } catch (error) {
      if (!handleKnownError(req, res, error)) next(error);
    }
  };
}
