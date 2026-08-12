import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { ActorContext } from '../../http/middleware/request-context.js';
import type { Acceptance } from './acceptance.model.js';
import type { TermsVersion } from '../versions/version.model.js';

interface AcceptanceRow {
  acceptance_id: string;
  version_id: string;
  version_code: string;
  accepted_at: Date;
  content_sha256: string;
  created?: boolean;
}

function mapAcceptance(row: AcceptanceRow): Acceptance {
  return {
    acceptanceId: row.acceptance_id,
    versionId: row.version_id,
    versionCode: row.version_code,
    acceptedAt: row.accepted_at.toISOString(),
    contentSha256: row.content_sha256,
  };
}

export class AcceptanceRepository {
  public async findForActor(
    queryable: pg.Pool | pg.PoolClient,
    actor: ActorContext,
    versionId: string,
  ): Promise<Acceptance | null> {
    const result = await queryable.query<AcceptanceRow>(
      `SELECT a.acceptance_id, a.version_id, v.version_code, a.accepted_at, a.content_sha256
         FROM terms.terms_acceptances a
         JOIN terms.terms_versions v ON v.version_id = a.version_id
        WHERE a.actor_id = $1 AND a.org_scope_id = $2 AND a.version_id = $3
          AND a.anonymized_at IS NULL`,
      [actor.actorId, actor.orgId, versionId],
    );
    const row = result.rows[0];
    return row ? mapAcceptance(row) : null;
  }

  public async insert(
    client: pg.PoolClient,
    actor: ActorContext,
    version: TermsVersion,
    requestId: string,
    idempotencyKey: string,
    actorFingerprint: string,
  ): Promise<{ acceptance: Acceptance; created: boolean }> {
    const result = await client.query<AcceptanceRow>(
      `INSERT INTO terms.terms_acceptances (
         acceptance_id, version_id, actor_id, org_scope_id, actor_fingerprint,
         content_sha256, request_id, idempotency_key, retention_until
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 transaction_timestamp() + interval '5 years')
       ON CONFLICT (org_scope_id, actor_id, version_id) WHERE anonymized_at IS NULL
       DO UPDATE SET actor_id = EXCLUDED.actor_id
       RETURNING acceptance_id, version_id, $9::text AS version_code,
                 accepted_at, content_sha256, (xmax = 0) AS created`,
      [
        randomUUID(), version.versionId, actor.actorId, actor.orgId,
        actorFingerprint, version.contentSha256, requestId,
        idempotencyKey, version.versionCode,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('acceptance insert returned no row');
    return { acceptance: mapAcceptance(row), created: row.created === true };
  }
}
