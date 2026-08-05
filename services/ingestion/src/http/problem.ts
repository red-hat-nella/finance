import type { Request, Response } from "express";

interface ProblemOptions {
  status: number;
  code: string;
  title: string;
  detail: string;
  retryable?: boolean;
  errors?: readonly unknown[];
  existingApplicationId?: string;
  evaluationId?: string;
  evaluationStatus?: "error";
}

export function sendProblem(
  req: Request,
  res: Response,
  options: ProblemOptions,
): void {
  res
    .status(options.status)
    .type("application/problem+json")
    .json({
      type: `https://errors.example.test/${options.code.toLowerCase().replaceAll("_", "-")}`,
      title: options.title,
      status: options.status,
      detail: options.detail,
      instance: `/problems/${req.requestId}`,
      code: options.code,
      correlationId: req.requestId,
      retryable: options.retryable ?? false,
      errors: options.errors ?? [],
      ...(options.existingApplicationId
        ? { existingApplicationId: options.existingApplicationId }
        : {}),
      ...(options.evaluationId ? { evaluationId: options.evaluationId } : {}),
      ...(options.evaluationStatus
        ? { evaluationStatus: options.evaluationStatus }
        : {}),
    });
}
