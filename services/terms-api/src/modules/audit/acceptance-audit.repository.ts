import type pg from 'pg';
import type { ActorContext } from '../../http/middleware/request-context.js';
import type { AcceptanceCursor, AcceptanceSearch } from './acceptance-search.model.js';

export interface AcceptanceEvidenceRow {
  readonly acceptance_id: string;
  readonly version_id: string;
  readonly version_code: string;
  readonly accepted_at: Date;
  readonly content_sha256: string;
  readonly actor_id: string | null;
}

export class AcceptanceAuditRepository {
  public async search(
    pool: pg.Pool,
    actor: ActorContext,
    input: AcceptanceSearch,
    cursor: AcceptanceCursor | null,
    fingerprint: string | null,
  ): Promise<AcceptanceEvidenceRow[]> {
    const result = await pool.query<AcceptanceEvidenceRow>(
      `SELECT a.acceptance_id, a.version_id, v.version_code, a.accepted_at,
              a.content_sha256, a.actor_id
         FROM terms.terms_acceptances a
         JOIN terms.terms_versions v ON v.version_id=a.version_id
        WHERE a.org_scope_id=$1 AND a.anonymized_at IS NULL
          AND ($2::text IS NULL OR a.actor_fingerprint=$2)
          AND ($3::text IS NULL OR v.version_code=$3)
          AND ($4::timestamptz IS NULL OR a.accepted_at >= $4)
          AND ($5::timestamptz IS NULL OR a.accepted_at <= $5)
          AND ($6::timestamptz IS NULL OR (a.accepted_at, a.acceptance_id) < ($6, $7::uuid))
        ORDER BY a.accepted_at DESC, a.acceptance_id DESC
        LIMIT $8`,
      [actor.orgId, fingerprint, input.versionCode ?? null, input.from ?? null,
        input.to ?? null, cursor?.acceptedAt ?? null, cursor?.acceptanceId ?? null,
        input.limit + 1],
    );
    return result.rows;
  }
}
