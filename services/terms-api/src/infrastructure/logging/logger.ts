import pino, { type DestinationStream, type Logger } from 'pino';
import type { AppConfig } from '../../config/schema.js';

export function createLogger(
  config: Pick<AppConfig, 'logLevel'>,
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.x-service-token',
          'req.body',
          'authorization',
          'token',
          'serviceAuth.token',
          'database.password',
          'content',
          'contentSource',
          'actorId',
          'orgId',
          'orgScopeId',
          'actorFingerprint',
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}
