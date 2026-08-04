import pino, { type DestinationStream } from "pino";
import type { AppConfig } from "../../config/schema.js";
export function createLogger(
  config: Pick<AppConfig, "logLevel">,
  destination?: DestinationStream,
) {
  return pino(
    {
      level: config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body",
          "applicant",
          "documentNumber",
          "fullName",
          "phone",
          "email",
          "monthlyIncomeCop",
          "database.password",
          "scoring.token",
          "pii.encryptionKey",
          "pii.hmacKey",
        ],
        censor: "[REDACTED]",
      },
    },
    destination,
  );
}
