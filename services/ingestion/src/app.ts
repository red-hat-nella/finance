import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type pg from "pg";
import type { AppConfig } from "./config/schema.js";
import { createJwtVerifier } from "./infrastructure/auth/jwt-verifier.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { accessLog } from "./http/middleware/access-log.js";
import { authenticate } from "./http/middleware/authenticate.js";
import { authorizeRead } from "./http/middleware/authorize.js";
import { enforcePublicContract } from "./http/middleware/openapi-validation.js";
import { requestContext } from "./http/middleware/request-context.js";
import { problemHandler } from "./http/problem-handler.js";
import { sendProblem } from "./http/problem.js";
import { healthRoutes } from "./http/routes/health.routes.js";
import { evaluationRoutes } from "./http/routes/evaluations.routes.js";
import { historyRoutes } from "./http/routes/history.routes.js";
import { mvpRoutes } from "./modules/mvp/mvp.routes.js";
export function createApp(config: AppConfig, pool: pg.Pool): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsAllowedOrigins.length
        ? config.corsAllowedOrigins
        : false,
    }),
  );
  app.use(requestContext);
  app.use(accessLog(createLogger(config)));
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(healthRoutes(pool));
  const auth =
    config.nodeEnv === "development"
      ? (req: Request, _res: Response, next: NextFunction): void => {
          req.actor = Object.freeze({
            actorId: "analyst-local",
            orgId: "org-local",
            roles: Object.freeze(["credit_analyst"] as const),
          });
          next();
        }
      : authenticate(createJwtVerifier(config));
  app.use(
    "/api/v1",
    auth,
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      keyGenerator: (req) => {
        const actor = req.actor;
        return actor ? `${actor.orgId}:${actor.actorId}` : "unauthenticated";
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        sendProblem(req, res, {
          status: 429,
          title: "Demasiadas solicitudes",
          detail: "Espere antes de intentar nuevamente.",
          code: "TOO_MANY_REQUESTS",
          retryable: true,
        });
      },
    }),
    authorizeRead,
    enforcePublicContract,
    evaluationRoutes(pool, config),
    historyRoutes(pool, config),
    mvpRoutes(pool, config),
  );
  app.use(problemHandler);
  return app;
}
