import type { NextFunction, Request, Response } from 'express';

const requestCounts = new Map<string, number>();
let requestDurationSeconds = 0;
let requestDurationCount = 0;
const operationDuration = new Map<string, { sum: number; count: number }>();
const dependencies = new Map<string, 0 | 1>([
  ['database', 0],
  ['migrations', 0],
  ['jwks', 1],
]);
const termsDecisions = new Map<string, number>();
const termsAcceptances = new Map<string, number>();
const termsGauges = new Map<string, number>([
  ['applicable_versions', 0], ['retention_backlog', 0],
  ['retention_last_success_timestamp_seconds', 0], ['migration_success', 0],
  ['restore_age_seconds', 0],
]);

export type DependencyName = 'database' | 'migrations' | 'jwks';

export function setDependencyState(name: DependencyName, ready: boolean): void {
  dependencies.set(name, ready ? 1 : 0);
}

export function recordTermsDecision(reason: 'ACCEPTED' | 'ACCEPTANCE_REQUIRED' | 'NO_EFFECTIVE_VERSION'): void {
  termsDecisions.set(reason, (termsDecisions.get(reason) ?? 0) + 1);
}
export function recordTermsAcceptance(outcome: 'created' | 'existing' | 'conflict' | 'failed'): void {
  termsAcceptances.set(outcome, (termsAcceptances.get(outcome) ?? 0) + 1);
}
export function setTermsGauge(
  name: 'applicable_versions' | 'retention_backlog' | 'retention_last_success_timestamp_seconds' | 'migration_success' | 'restore_age_seconds',
  value: number,
): void { termsGauges.set(name, value); }

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const statusClass = `${String(Math.floor(res.statusCode / 100))}xx`;
    const key = `${req.method}:${statusClass}`;
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
    const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    requestDurationSeconds += seconds;
    requestDurationCount += 1;
    const operation = safeOperation(req.method, req.path);
    const current = operationDuration.get(operation) ?? { sum: 0, count: 0 };
    operationDuration.set(operation, { sum: current.sum + seconds, count: current.count + 1 });
  });
  next();
}

export function renderMetrics(): string {
  const lines = [
    '# HELP finance2_http_requests_total HTTP requests by method and status class.',
    '# TYPE finance2_http_requests_total counter',
  ];
  for (const [key, count] of [...requestCounts.entries()].sort()) {
    const separator = key.indexOf(':');
    const method = key.slice(0, separator);
    const statusClass = key.slice(separator + 1);
    lines.push(
      `finance2_http_requests_total{service="terms-api",method="${method}",status_class="${statusClass}"} ${String(count)}`,
    );
  }
  lines.push(
    '# HELP finance2_http_request_duration_seconds Aggregate HTTP request duration.',
    '# TYPE finance2_http_request_duration_seconds summary',
    `finance2_http_request_duration_seconds_sum{service="terms-api"} ${String(requestDurationSeconds)}`,
    `finance2_http_request_duration_seconds_count{service="terms-api"} ${String(requestDurationCount)}`,
    '# HELP finance2_dependency_up Whether a critical dependency is available.',
    '# TYPE finance2_dependency_up gauge',
  );
  lines.push('# HELP finance2_terms_operation_duration_seconds HTTP duration by bounded operation.', '# TYPE finance2_terms_operation_duration_seconds summary');
  for (const [operation, duration] of [...operationDuration.entries()].sort()) {
    lines.push(
      `finance2_terms_operation_duration_seconds_sum{operation="${operation}"} ${String(duration.sum)}`,
      `finance2_terms_operation_duration_seconds_count{operation="${operation}"} ${String(duration.count)}`,
    );
  }
  for (const [dependency, ready] of [...dependencies.entries()].sort()) {
    lines.push(
      `finance2_dependency_up{service="terms-api",dependency="${dependency}"} ${String(ready)}`,
    );
  }
  lines.push('# HELP finance2_terms_access_decisions_total Access decisions by safe reason.', '# TYPE finance2_terms_access_decisions_total counter');
  for (const [reason, count] of [...termsDecisions.entries()].sort()) lines.push(`finance2_terms_access_decisions_total{reason="${reason}"} ${String(count)}`);
  lines.push('# HELP finance2_terms_acceptances_total Acceptance results.', '# TYPE finance2_terms_acceptances_total counter');
  for (const [outcome, count] of [...termsAcceptances.entries()].sort()) lines.push(`finance2_terms_acceptances_total{outcome="${outcome}"} ${String(count)}`);
  for (const [name, value] of [...termsGauges.entries()].sort()) {
    lines.push(`# TYPE finance2_terms_${name} gauge`, `finance2_terms_${name} ${String(value)}`);
  }
  return `${lines.join('\n')}\n`;
}

function safeOperation(method: string, path: string): string {
  if (method === 'POST' && path === '/acceptances') return 'accept';
  if (method === 'GET' && path === '/current') return 'current';
  if (method === 'POST' && path === '/audit/acceptances/search') return 'audit_search';
  if (path.startsWith('/admin/versions')) return 'version_admin';
  if (path === '/access-decisions') return 'access_decision';
  if (path.startsWith('/health/')) return 'health';
  return 'other';
}
