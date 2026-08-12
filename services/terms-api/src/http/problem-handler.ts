import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ProblemError, sendProblem } from './problem.js';

function statusOf(error: unknown): number {
  if (!error || typeof error !== 'object') return 500;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const value = candidate.status ?? candidate.statusCode;
  return typeof value === 'number' && value >= 400 && value < 600 ? value : 500;
}

export function createProblemHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next): void => {
    void next;
    if (error instanceof ProblemError) {
      logger.warn({ event: 'http.problem', requestId: req.requestId, code: error.problem.code }, 'request rejected');
      sendProblem(req, res, error.problem);
      return;
    }
    const status = statusOf(error);
    const payloadTooLarge = status === 413;
    logger.error(
      {
        event: 'http.error',
        requestId: req.requestId,
        code: payloadTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_FAILURE',
      },
      'request failed',
    );
    sendProblem(
      req,
      res,
      payloadTooLarge
        ? {
            status,
            title: 'Solicitud demasiado grande',
            detail: 'El documento no puede superar el límite configurado.',
            code: 'PAYLOAD_TOO_LARGE',
          }
        : {
            status: 500,
            title: 'No fue posible completar la operación',
            detail: 'Intente nuevamente usando el identificador de solicitud.',
            code: 'INTERNAL_FAILURE',
            retryable: true,
          },
    );
  };
}
