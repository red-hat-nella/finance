import type { ErrorRequestHandler } from "express";
import { sendProblem } from "./problem.js";

function errorStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 500;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const value = candidate.status ?? candidate.statusCode;
  return typeof value === "number" && value >= 400 && value < 600 ? value : 500;
}

export const problemHandler: ErrorRequestHandler = (error, req, res, next) => {
  void next;
  const status = errorStatus(error);
  const payloadTooLarge = status === 413;
  console.error(
    JSON.stringify({
      level: "error",
      requestId: req.requestId,
      code: payloadTooLarge ? "PAYLOAD_TOO_LARGE" : "INTERNAL_FAILURE",
    }),
  );
  sendProblem(
    req,
    res,
    payloadTooLarge
      ? {
          status,
          title: "Solicitud demasiado grande",
          detail: "El cuerpo de la solicitud no puede superar 256 KiB.",
          code: "PAYLOAD_TOO_LARGE",
        }
      : {
          status: 500,
          title: "No fue posible completar la operación",
          detail:
            "Intente nuevamente. Use el identificador de solicitud si necesita soporte.",
          code: "INTERNAL_FAILURE",
          retryable: true,
        },
  );
};
