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
import { applicationRoutes } from "./http/routes/applications.routes.js";
import { evaluationRoutes } from "./http/routes/evaluations.routes.js";
import { historyRoutes } from "./http/routes/history.routes.js";
import { auditRoutes } from "./http/routes/audit.routes.js";
import { mvpRoutes } from "./modules/mvp/mvp.routes.js";
import { metricsMiddleware, renderMetrics } from "./observability/metrics.js";
import { TermsAccessClient } from "./clients/terms-access.client.js";
import { requireTermsAcceptance } from "./http/middleware/require-terms-acceptance.js";
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
  app.use(metricsMiddleware);
  app.use(accessLog(createLogger(config)));
  app.use(
    express.json({
      limit: "256kb",
      strict: true,
      type: ["application/json", "application/merge-patch+json"],
    }),
  );
  app.use(healthRoutes(pool));
  app.get("/metrics", (_req, res) => {
    res.type("text/plain; version=0.0.4").send(renderMetrics());
  });
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
  const termsGate = config.termsAccess
    ? requireTermsAcceptance(new TermsAccessClient(config.termsAccess))
    : config.termsGateTestBypass && config.nodeEnv !== "production"
      ? (_req: Request, res: Response, next: NextFunction): void => {
          res.setHeader("X-Terms-Gate-Bypass", "explicit-test-only");
          next();
        }
      : (req: Request, res: Response): void => {
          sendProblem(req, res, {
            status: 503,
            title: "No fue posible comprobar la aceptación",
            detail: "El acceso permanece bloqueado hasta configurar el servicio de términos.",
            code: "TERMS_SERVICE_UNAVAILABLE",
            retryable: true,
          });
        };
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
    termsGate,
    enforcePublicContract,
    applicationRoutes(pool, config),
    evaluationRoutes(pool, config),
    historyRoutes(pool, config),
    auditRoutes(pool),
    mvpRoutes(pool, config),
  );
  app.use(problemHandler);
  return app;
}
