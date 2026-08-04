import type pg from "pg";
import { sanitizeAuditMetadata, type AuditEventInput } from "./audit-event.js";
export interface AuditWriter {
  write(event: AuditEventInput, client?: pg.PoolClient): Promise<void>;
}
export class PostgresAuditWriter implements AuditWriter {
  constructor(private pool: pg.Pool) {}
  async write(event: AuditEventInput, client?: pg.PoolClient): Promise<void> {
    const db = client ?? this.pool;
    await db.query(
      `INSERT INTO scoring.audit_events(org_scope_id,actor_id,actor_roles,event_type,application_id,evaluation_id,correlation_id,outcome,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        event.orgId,
        event.actorId,
        event.roles,
        event.type,
        event.applicationId ?? null,
        event.evaluationId ?? null,
        event.correlationId,
        event.outcome,
        JSON.stringify(sanitizeAuditMetadata(event.metadata ?? {})),
      ],
    );
  }
}
