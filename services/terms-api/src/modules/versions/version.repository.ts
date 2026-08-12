import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import type { ActorContext } from '../../http/middleware/request-context.js';
import type { CreateVersionCommand } from './version.commands.js';
import type { TermsVersion } from './version.model.js';

interface VersionRow {
  version_id: string;
  version_code: string;
  title: string;
  content_format: 'markdown';
  content_source: string;
  content_sha256: string;
  state: TermsVersion['state'];
  effective_at: Date | null;
  published_at: Date | null;
}

function mapVersion(row: VersionRow): TermsVersion {
  return {
    versionId: row.version_id,
    versionCode: row.version_code,
    title: row.title,
    contentFormat: row.content_format,
    content: row.content_source,
    contentSha256: row.content_sha256,
    state: row.state,
    effectiveAt: row.effective_at?.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

const CURRENT_VERSION_SQL = `
  SELECT version_id, version_code, title, content_format, content_source,
         content_sha256, state, effective_at, published_at
    FROM terms.terms_versions
   WHERE state IN ('EFFECTIVE', 'SCHEDULED') AND effective_at <= transaction_timestamp()
   ORDER BY effective_at DESC
   LIMIT 1`;

export class VersionRepository {
  public async findCurrent(queryable: pg.Pool | pg.PoolClient, lock = false): Promise<TermsVersion | null> {
    const result = await queryable.query<VersionRow>(`${CURRENT_VERSION_SQL}${lock ? ' FOR SHARE' : ''}`);
    const row = result.rows[0];
    return row ? mapVersion(row) : null;
  }

  public async list(queryable: pg.Pool | pg.PoolClient): Promise<TermsVersion[]> {
    const result = await queryable.query<VersionRow>(
      `SELECT version_id, version_code, title, content_format, content_source,
              content_sha256, state, effective_at, published_at
         FROM terms.terms_versions ORDER BY created_at DESC, version_id DESC`,
    );
    return result.rows.map(mapVersion);
  }

  public async findById(
    queryable: pg.Pool | pg.PoolClient,
    versionId: string,
    lock = false,
  ): Promise<TermsVersion | null> {
    const result = await queryable.query<VersionRow>(
      `SELECT version_id, version_code, title, content_format, content_source,
              content_sha256, state, effective_at, published_at
         FROM terms.terms_versions WHERE version_id=$1${lock ? ' FOR UPDATE' : ''}`,
      [versionId],
    );
    const row = result.rows[0];
    return row ? mapVersion(row) : null;
  }

  public async insertDraft(
    client: pg.PoolClient,
    command: CreateVersionCommand,
    content: string,
    digest: string,
    actor: ActorContext,
    requestId: string,
  ): Promise<TermsVersion> {
    const result = await client.query<VersionRow>(
      `INSERT INTO terms.terms_versions (
         version_id, version_code, title, content_format, content_source,
         content_sha256, state, created_by_actor_id, request_id
       ) VALUES ($1,$2,$3,'markdown',$4,$5,'DRAFT',$6,$7)
       RETURNING version_id, version_code, title, content_format, content_source,
                 content_sha256, state, effective_at, published_at`,
      [randomUUID(), command.versionCode, command.title, content, digest, actor.actorId, requestId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('version insert returned no row');
    return mapVersion(row);
  }

  public async lockLifecycle(client: pg.PoolClient): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('finance2-terms-lifecycle-v1'))");
  }

  public async hasOtherScheduled(client: pg.PoolClient, versionId: string): Promise<boolean> {
    const result = await client.query(
      `SELECT 1 FROM terms.terms_versions
        WHERE state='SCHEDULED' AND version_id<>$1 LIMIT 1`,
      [versionId],
    );
    return Boolean(result.rowCount);
  }

  public async schedule(
    client: pg.PoolClient,
    versionId: string,
    effectiveAt: Date,
    actor: ActorContext,
  ): Promise<TermsVersion> {
    const result = await client.query<VersionRow>(
      `UPDATE terms.terms_versions
          SET state='SCHEDULED', scheduled_at=transaction_timestamp(), effective_at=$2,
              published_at=transaction_timestamp(), published_by_actor_id=$3
        WHERE version_id=$1 AND state='DRAFT'
       RETURNING version_id, version_code, title, content_format, content_source,
                 content_sha256, state, effective_at, published_at`,
      [versionId, effectiveAt, actor.actorId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('schedule update returned no row');
    return mapVersion(row);
  }

  public async withdraw(client: pg.PoolClient, versionId: string): Promise<TermsVersion> {
    const result = await client.query<VersionRow>(
      `UPDATE terms.terms_versions
          SET state='WITHDRAWN', withdrawn_at=transaction_timestamp()
        WHERE version_id=$1 AND state IN ('DRAFT','SCHEDULED')
       RETURNING version_id, version_code, title, content_format, content_source,
                 content_sha256, state, effective_at, published_at`,
      [versionId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('withdraw update returned no row');
    return mapVersion(row);
  }

  public async promoteDue(client: pg.PoolClient, now: Date): Promise<TermsVersion | null> {
    await this.lockLifecycle(client);
    const due = await client.query<VersionRow>(
      `SELECT version_id, version_code, title, content_format, content_source,
              content_sha256, state, effective_at, published_at
         FROM terms.terms_versions
        WHERE state='SCHEDULED' AND effective_at <= $1
        ORDER BY effective_at DESC LIMIT 1 FOR UPDATE`,
      [now],
    );
    const row = due.rows[0];
    if (!row) return null;
    await client.query(
      `UPDATE terms.terms_versions SET state='SUPERSEDED', superseded_at=$2
        WHERE state='EFFECTIVE' AND version_id<>$1`,
      [row.version_id, now],
    );
    const promoted = await client.query<VersionRow>(
      `UPDATE terms.terms_versions SET state='EFFECTIVE'
        WHERE version_id=$1 AND state='SCHEDULED'
       RETURNING version_id, version_code, title, content_format, content_source,
                 content_sha256, state, effective_at, published_at`,
      [row.version_id],
    );
    const promotedRow = promoted.rows[0];
    return promotedRow ? mapVersion(promotedRow) : null;
  }
}
