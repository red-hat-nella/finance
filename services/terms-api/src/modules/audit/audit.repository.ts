import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { ActorContext } from '../../http/middleware/request-context.js';

export class AuditRepository {
  public async versionEvent(
    client: pg.PoolClient,
    eventType: 'created' | 'scheduled' | 'effective' | 'superseded' | 'withdrawn',
    actor: ActorContext,
    versionId: string,
    requestId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO terms.terms_audit_events (
         event_id, event_type, actor_id, org_scope_id, actor_role, version_id,
         request_id, outcome
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'succeeded')`,
      [randomUUID(), eventType, actor.actorId, actor.orgId, actor.roles[0] ?? null, versionId, requestId],
    );
  }

  public async accepted(
    client: pg.PoolClient,
    actor: ActorContext,
    versionId: string,
    acceptanceId: string,
    requestId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO terms.terms_audit_events (
         event_id, event_type, actor_id, org_scope_id, actor_role, version_id,
         acceptance_id, request_id, outcome, retention_until
       ) VALUES ($1, 'accepted', $2, $3, $4, $5, $6, $7, 'succeeded',
                 transaction_timestamp() + interval '5 years')`,
      [randomUUID(), actor.actorId, actor.orgId, actor.roles[0] ?? null,
        versionId, acceptanceId, requestId],
    );
  }
}
