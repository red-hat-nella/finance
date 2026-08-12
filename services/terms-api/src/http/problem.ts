import type { Request, Response } from 'express';

export interface ProblemOptions {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly retryable?: boolean;
  readonly errors?: readonly unknown[];
  readonly acceptanceUrl?: string;
}

export class ProblemError extends Error {
  public constructor(public readonly problem: ProblemOptions) {
    super(problem.code);
    this.name = 'ProblemError';
  }
}

export function sendProblem(req: Request, res: Response, options: ProblemOptions): void {
  res.status(options.status).type('application/problem+json').json({
    type: `https://errors.example.test/${options.code.toLowerCase().replaceAll('_', '-')}`,
    title: options.title,
    status: options.status,
    detail: options.detail,
    instance: `/problems/${req.requestId}`,
    code: options.code,
    retryable: options.retryable ?? false,
    requestId: req.requestId,
    ...(options.errors ? { errors: options.errors } : {}),
    ...(options.acceptanceUrl ? { acceptanceUrl: options.acceptanceUrl } : {}),
  });
}
