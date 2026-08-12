import express, { type Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type pg from 'pg';
import type { AppConfig } from './config/schema.js';
import { accessLog } from './http/middleware/access-log.js';
import { authenticate, authorizeRoles, requireAuthenticated } from './http/middleware/authorize.js';
import { requestContext, requireRequestId } from './http/middleware/request-context.js';
import { serviceAuth } from './http/middleware/service-auth.js';
import { createProblemHandler } from './http/problem-handler.js';
import { sendProblem } from './http/problem.js';
import { healthRoutes } from './http/routes/health.routes.js';
import { acceptanceRoutes } from './http/routes/acceptance.routes.js';
import { acceptanceAuditRoutes } from './http/routes/acceptance-audit.routes.js';
import { currentRoutes } from './http/routes/current.routes.js';
import { internalAccessRoutes } from './http/routes/internal-access.routes.js';
import { versionAdminRoutes } from './http/routes/version-admin.routes.js';
import { createJwtVerifier, type JwtVerifier } from './infrastructure/auth/jwt-verifier.js';
import { createLogger } from './infrastructure/logging/logger.js';
import { metricsMiddleware, renderMetrics } from './observability/metrics.js';
import { createAcceptanceService } from './modules/acceptances/acceptance.service.js';
import { AccessDecisionService } from './modules/access/access-decision.service.js';
import { createAcceptanceAuditService } from './modules/audit/acceptance-audit.service.js';
import { VersionAdminService } from './modules/versions/version-admin.service.js';

export interface AppDependencies { readonly verifyJwt?: JwtVerifier }

export function createApp(config: AppConfig, pool: pg.Pool, dependencies: AppDependencies = {}): Express {
  const app = express();
  const logger = createLogger(config);
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(helmet());
  app.use(requestContext);
  app.use(metricsMiddleware);
  app.use(accessLog(logger));
  app.use(express.json({ limit: config.http.jsonLimit, strict: true, type: 'application/json' }));
  app.use(healthRoutes(pool));
  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4').send(renderMetrics());
  });
  const verifyJwt = dependencies.verifyJwt ?? createJwtVerifier(config);
  const auth = authenticate(verifyJwt);
  const acceptanceService = createAcceptanceService(config, pool);
  app.use(
    '/v1',
    requireRequestId,
    auth,
    requireAuthenticated,
    authorizeRoles('credit_analyst', 'supervisor', 'auditor', 'terms_admin'),
    rateLimit({
      windowMs: 60_000,
      limit: config.http.publicRateLimit,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    currentRoutes(acceptanceService),
    acceptanceRoutes(acceptanceService),
    versionAdminRoutes(new VersionAdminService(pool)),
    acceptanceAuditRoutes(createAcceptanceAuditService(config, pool)),
  );
  app.use(
    '/internal/v1',
    requireRequestId,
    serviceAuth(config),
    auth,
    requireAuthenticated,
    internalAccessRoutes(new AccessDecisionService(pool)),
  );
  app.use((req, res) => {
    sendProblem(req, res, {
      status: 404,
      title: 'Recurso no encontrado',
      detail: 'La ruta solicitada no existe.',
      code: 'NOT_FOUND',
    });
  });
  app.use(createProblemHandler(logger));
  return app;
}
