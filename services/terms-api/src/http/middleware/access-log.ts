import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';

export function accessLog(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      logger.info(
        {
          event: 'http.request',
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
          requestId: req.requestId,
        },
        'request completed',
      );
    });
    next();
  };
}
