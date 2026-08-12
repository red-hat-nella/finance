import type pg from 'pg';
import type { AppConfig } from '../../config/schema.js';
import type { ActorContext } from '../../http/middleware/request-context.js';
import { ProblemError } from '../../http/problem.js';
import { AcceptanceAuditRepository } from './acceptance-audit.repository.js';
import {
  actorFingerprint, decodeCursor, encodeCursor, type AcceptanceSearch,
} from './acceptance-search.model.js';

export interface AcceptanceEvidence {
  readonly acceptanceId: string;
  readonly versionId: string;
  readonly versionCode: string;
  readonly acceptedAt: string;
  readonly contentSha256: string;
  readonly actorDisplay: string | null;
}

export class AcceptanceAuditService {
  public constructor(
    private readonly pool: pg.Pool,
    private readonly key: string,
    private readonly repository = new AcceptanceAuditRepository(),
  ) {}

  public async search(actor: ActorContext, input: AcceptanceSearch): Promise<{
    items: AcceptanceEvidence[];
    nextCursor: string | null;
  }> {
    let cursor = null;
    try { cursor = input.cursor ? decodeCursor(input.cursor, this.key) : null; }
    catch { throw invalidCursor(); }
    try {
      const rows = await this.repository.search(
        this.pool, actor, input, cursor,
        input.actorPublicId ? actorFingerprint(`${actor.orgId}:${input.actorPublicId}`, this.key) : null,
      );
      const hasMore = rows.length > input.limit;
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        items: page.map((row) => ({
          acceptanceId: row.acceptance_id,
          versionId: row.version_id,
          versionCode: row.version_code,
          acceptedAt: row.accepted_at.toISOString(),
          contentSha256: row.content_sha256,
          actorDisplay: maskActor(row.actor_id),
        })),
        nextCursor: hasMore && last
          ? encodeCursor({ acceptedAt: last.accepted_at.toISOString(), acceptanceId: last.acceptance_id }, this.key)
          : null,
      };
    } catch (error) {
      if (error instanceof ProblemError) throw error;
      throw new ProblemError({
        status: 503, title: 'Evidencia no disponible',
        detail: 'No fue posible completar la búsqueda sin resultados parciales.',
        code: 'AUDIT_SEARCH_UNAVAILABLE', retryable: true,
      });
    }
  }
}

export function createAcceptanceAuditService(config: Pick<AppConfig, 'privacy'>, pool: pg.Pool): AcceptanceAuditService {
  return new AcceptanceAuditService(pool, config.privacy.acceptanceHmacKey);
}
function maskActor(value: string | null): string | null {
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}
function invalidCursor(): ProblemError {
  return new ProblemError({ status: 422, title: 'Cursor inválido', detail: 'El cursor no es válido o fue alterado.', code: 'INVALID_CURSOR' });
}
