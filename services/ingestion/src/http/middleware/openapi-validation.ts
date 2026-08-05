import type { NextFunction, Request, Response } from "express";
import { sendProblem } from "../problem.js";

const OPERATIONS = [
  { pattern: /^\/applications$/, methods: ["POST"] },
  { pattern: /^\/applications\/[0-9a-f-]{36}$/i, methods: ["GET", "PATCH"] },
  {
    pattern: /^\/applications\/[0-9a-f-]{36}\/evaluations$/i,
    methods: ["POST"],
  },
  { pattern: /^\/evaluations\/search$/, methods: ["POST"] },
  { pattern: /^\/evaluations\/[^/]+$/i, methods: ["GET"] },
  { pattern: /^\/evaluations\/[^/]+\/audit$/i, methods: ["GET"] },
] as const;

export function enforcePublicContract(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const operation = OPERATIONS.find(({ pattern }) => pattern.test(req.path));
  if (!operation) {
    sendProblem(req, res, {
      status: 404,
      title: "Recurso no encontrado",
      detail: "No se encontró un recurso accesible con esa ruta.",
      code: "NOT_FOUND",
    });
    return;
  }
  if (!(operation.methods as readonly string[]).includes(req.method)) {
    res.setHeader("Allow", operation.methods.join(", "));
    sendProblem(req, res, {
      status: 405,
      title: "Método no permitido",
      detail: "Use uno de los métodos indicados en el encabezado Allow.",
      code: "METHOD_NOT_ALLOWED",
    });
    return;
  }
  const acceptedBody =
    req.is("application/json") ||
    (req.method === "PATCH" && req.is("application/merge-patch+json"));
  if (["POST", "PATCH", "PUT"].includes(req.method) && !acceptedBody) {
    sendProblem(req, res, {
      status: 415,
      title: "Formato no soportado",
      detail: "Use Content-Type application/json.",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    return;
  }
  next();
}
