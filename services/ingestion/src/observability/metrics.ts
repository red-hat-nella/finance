import type { NextFunction, Request, Response } from "express";

const requestCounts = new Map<string, number>();
let requestDurationSeconds = 0;
let requestDurationCount = 0;
const dependencies = new Map<string, 0 | 1>([
  ["database", 0],
  ["scoring", 1],
  ["jwks", 1],
]);

export function setDependencyState(name: "database" | "scoring" | "jwks", ready: boolean): void {
  dependencies.set(name, ready ? 1 : 0);
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const statusClass = `${String(Math.floor(res.statusCode / 100))}xx`;
    const key = `${req.method}:${statusClass}`;
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
    requestDurationSeconds += Number(process.hrtime.bigint() - started) / 1_000_000_000;
    requestDurationCount += 1;
  });
  next();
}

export function renderMetrics(): string {
  const lines = [
    "# HELP finance2_http_requests_total HTTP requests by method and status class.",
    "# TYPE finance2_http_requests_total counter",
  ];
  for (const [key, count] of [...requestCounts.entries()].sort()) {
    const separator = key.indexOf(":");
    const method = key.slice(0, separator);
    const statusClass = key.slice(separator + 1);
    lines.push(`finance2_http_requests_total{service="ingestion",method="${method}",status_class="${statusClass}"} ${String(count)}`);
  }
  lines.push(
    "# HELP finance2_http_request_duration_seconds Aggregate HTTP request duration.",
    "# TYPE finance2_http_request_duration_seconds summary",
    `finance2_http_request_duration_seconds_sum{service="ingestion"} ${String(requestDurationSeconds)}`,
    `finance2_http_request_duration_seconds_count{service="ingestion"} ${String(requestDurationCount)}`,
    "# HELP finance2_dependency_up Whether a critical dependency is available.",
    "# TYPE finance2_dependency_up gauge",
  );
  for (const [dependency, ready] of [...dependencies.entries()].sort())
    lines.push(`finance2_dependency_up{service="ingestion",dependency="${dependency}"} ${String(ready)}`);
  return `${lines.join("\n")}\n`;
}
