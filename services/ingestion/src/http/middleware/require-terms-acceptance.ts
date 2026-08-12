import type { NextFunction, Request, Response } from "express";
import type { TermsAccessClient } from "../../clients/terms-access.client.js";
import { sendProblem } from "../problem.js";

export function requireTermsAcceptance(client: TermsAccessClient) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authorization = req.header("Authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length <= 7) {
      sendUnavailable(req, res);
      return;
    }
    try {
      const decision = await client.decide({ authorization, requestId: req.requestId });
      if (decision.allowed) {
        next();
        return;
      }
      if (decision.reason === "ACCEPTANCE_REQUIRED") {
        sendProblem(req, res, {
          status: 428,
          title: "Debe aceptar los términos vigentes",
          detail: "Revise y acepte los términos vigentes antes de continuar.",
          code: "TERMS_ACCEPTANCE_REQUIRED",
          acceptanceUrl: decision.acceptanceUrl,
        });
        return;
      }
      sendUnavailable(req, res);
    } catch {
      sendUnavailable(req, res);
    }
  };
}

function sendUnavailable(req: Request, res: Response): void {
  sendProblem(req, res, {
    status: 503,
    title: "No fue posible comprobar la aceptación",
    detail: "El acceso permanece bloqueado hasta obtener una decisión confiable.",
    code: "TERMS_SERVICE_UNAVAILABLE",
    retryable: true,
  });
}
