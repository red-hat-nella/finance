import type { NextFunction, Request, Response } from "express";
import type { ActorContext } from "../../domain/authorization/policies.js";
import { sendProblem } from "../problem.js";
export function authenticate(verify: (token: string) => Promise<ActorContext>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = req.header("Authorization");
      if (!value?.startsWith("Bearer ")) throw new Error();
      req.actor = await verify(value.slice(7));
      next();
    } catch {
      sendProblem(req, res, {
        status: 401,
        title: "No autorizado",
        detail: "Se requieren credenciales válidas.",
        code: "UNAUTHORIZED",
      });
    }
  };
}
