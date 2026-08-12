import { createHash, createHmac, randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { AppConfig } from '../../config/schema.js';
import type { ActorContext } from '../../http/middleware/request-context.js';
import { ProblemError } from '../../http/problem.js';
import { inTransaction } from '../../infrastructure/db/transaction.js';
import { recordTermsAcceptance } from '../../observability/metrics.js';
import { AuditRepository } from '../audit/audit.repository.js';
import { AcceptanceRepository } from './acceptance.repository.js';
import type { Acceptance, AcceptanceInput } from './acceptance.model.js';
import { VersionRepository } from '../versions/version.repository.js';

interface IdempotencyRow { request_sha256: string; resource_id: string | null }

export class AcceptanceService {
  public constructor(
    private readonly pool: pg.Pool,
    private readonly hmacKey: string,
    private readonly versions = new VersionRepository(),
    private readonly acceptances = new AcceptanceRepository(),
    private readonly audit = new AuditRepository(),
  ) {}

  public async current(actor: ActorContext): Promise<{
    version: NonNullable<Awaited<ReturnType<VersionRepository['findCurrent']>>>;
    acceptanceStatus: 'PENDING' | 'ACCEPTED';
    acceptedAt: string | null;
  }> {
    try {
      const version = await this.versions.findCurrent(this.pool);
      if (!version) throw unavailable('NO_EFFECTIVE_VERSION', 'No hay una versión vigente verificable.');
      const acceptance = await this.acceptances.findForActor(this.pool, actor, version.versionId);
      return {
        version,
        acceptanceStatus: acceptance ? 'ACCEPTED' : 'PENDING',
        acceptedAt: acceptance?.acceptedAt ?? null,
      };
    } catch (error) {
      if (error instanceof ProblemError) throw error;
      throw unavailable('TERMS_SERVICE_UNAVAILABLE', 'No fue posible consultar los términos vigentes.');
    }
  }

  public async accept(
    actor: ActorContext,
    input: AcceptanceInput,
    idempotencyKey: string,
    requestId: string,
  ): Promise<{ acceptance: Acceptance; replayed: boolean; created: boolean }> {
    const requestHash = createHash('sha256').update(`${input.versionId}:${input.contentSha256}`).digest('hex');
    try {
      return await inTransaction(this.pool, async (client) => {
        const replay = await client.query<IdempotencyRow>(
          `SELECT request_sha256, resource_id FROM terms.terms_idempotency_records
            WHERE actor_id=$1 AND org_scope_id=$2 AND operation='accept' AND idempotency_key=$3
            FOR UPDATE`,
          [actor.actorId, actor.orgId, idempotencyKey],
        );
        const record = replay.rows[0];
        if (record) {
          if (record.request_sha256 !== requestHash) {
            throw conflict('IDEMPOTENCY_CONFLICT', 'La clave de idempotencia ya se usó con otra solicitud.');
          }
          const existing = await this.acceptances.findForActor(client, actor, input.versionId);
          if (!existing || existing.acceptanceId !== record.resource_id) {
            throw unavailable('EVIDENCE_UNAVAILABLE', 'No fue posible verificar la aceptación existente.');
          }
          recordTermsAcceptance('existing');
          return { acceptance: existing, replayed: true, created: false };
        }
        const version = await this.versions.findCurrent(client, true);
        if (!version || version.versionId !== input.versionId || version.contentSha256 !== input.contentSha256) {
          throw conflict('TERMS_VERSION_CHANGED', 'Vuelva a revisar el documento vigente antes de aceptar.');
        }
        const existing = await this.acceptances.findForActor(client, actor, version.versionId);
        const inserted = existing ? null : await this.acceptances.insert(
          client, actor, version, requestId, idempotencyKey,
          createHmac('sha256', this.hmacKey).update(`${actor.orgId}:${actor.actorId}`).digest('hex'),
        );
        const acceptance = existing ?? inserted?.acceptance;
        if (!acceptance) throw new Error('acceptance resolution returned no evidence');
        const created = inserted?.created ?? false;
        if (created) await this.audit.accepted(client, actor, version.versionId, acceptance.acceptanceId, requestId);
        const idempotency = await client.query<{ request_sha256: string }>(
          `INSERT INTO terms.terms_idempotency_records (
             record_id, actor_id, org_scope_id, operation, idempotency_key,
             request_sha256, response_status, resource_id, expires_at
           ) VALUES ($7, $1, $2, 'accept', $3, $4, $5, $6,
                     transaction_timestamp() + interval '24 hours')
           ON CONFLICT (actor_id, org_scope_id, operation, idempotency_key)
           DO UPDATE SET expires_at = GREATEST(
             terms.terms_idempotency_records.expires_at, EXCLUDED.expires_at
           )
           WHERE terms.terms_idempotency_records.request_sha256 = EXCLUDED.request_sha256
           RETURNING request_sha256`,
          [actor.actorId, actor.orgId, idempotencyKey, requestHash, created ? 201 : 200, acceptance.acceptanceId, randomUUID()],
        );
        if (!idempotency.rowCount) {
          throw conflict('IDEMPOTENCY_CONFLICT', 'La clave de idempotencia ya se usó con otra solicitud.');
        }
        recordTermsAcceptance(created ? 'created' : 'existing');
        return { acceptance, replayed: false, created };
      }, 'READ COMMITTED');
    } catch (error) {
      if (error instanceof ProblemError) {
        recordTermsAcceptance(error.problem.status === 409 ? 'conflict' : 'failed');
        throw error;
      }
      recordTermsAcceptance('failed');
      throw unavailable('ACCEPTANCE_PERSISTENCE_UNAVAILABLE', 'No fue posible guardar la aceptación.');
    }
  }
}

export function createAcceptanceService(config: Pick<AppConfig, 'privacy'>, pool: pg.Pool): AcceptanceService {
  return new AcceptanceService(pool, config.privacy.acceptanceHmacKey);
}

function conflict(code: string, detail: string): ProblemError {
  return new ProblemError({ status: 409, title: 'Conflicto de aceptación', detail, code });
}
function unavailable(code: string, detail: string): ProblemError {
  return new ProblemError({ status: 503, title: 'Términos no disponibles', detail, code, retryable: true });
}
