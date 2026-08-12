import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { ActorContext } from '../../http/middleware/request-context.js';
import { ProblemError } from '../../http/problem.js';
import { inTransaction } from '../../infrastructure/db/transaction.js';
import { AuditRepository } from '../audit/audit.repository.js';
import { canonicalContent, contentDigest } from './content-digest.js';
import type { CreateVersionCommand, ScheduleVersionCommand } from './version.commands.js';
import { assertSchedulable, assertWithdrawable } from './version-lifecycle.js';
import type { TermsVersion } from './version.model.js';
import { VersionRepository } from './version.repository.js';

interface IdempotencyRow { request_sha256: string; resource_id: string | null }
type AdminOperation = 'create_version' | 'schedule' | 'withdraw';

export class VersionAdminService {
  public constructor(
    private readonly pool: pg.Pool,
    private readonly versions = new VersionRepository(),
    private readonly audit = new AuditRepository(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public list(): Promise<TermsVersion[]> { return this.versions.list(this.pool); }

  public async get(versionId: string): Promise<TermsVersion> {
    const version = await this.versions.findById(this.pool, versionId);
    if (!version) throw notFound();
    return version;
  }

  public async create(
    actor: ActorContext,
    command: CreateVersionCommand,
    key: string,
    requestId: string,
  ): Promise<{ version: TermsVersion; replayed: boolean }> {
    const content = canonicalContent(command.content);
    const digest = contentDigest(content);
    const hash = requestHash({ ...command, content });
    return inTransaction(this.pool, async (client) => {
      const replay = await this.replay(client, actor, 'create_version', key, hash);
      if (replay) return { version: await this.getReplay(client, replay), replayed: true };
      let version: TermsVersion;
      try {
        version = await this.versions.insertDraft(client, command, content, digest, actor, requestId);
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict('VERSION_ALREADY_EXISTS', 'El código o digest ya existe.');
        throw error;
      }
      await this.audit.versionEvent(client, 'created', actor, version.versionId, requestId);
      await this.record(client, actor, 'create_version', key, hash, version.versionId, 201);
      return { version, replayed: false };
    });
  }

  public async schedule(
    actor: ActorContext,
    versionId: string,
    command: ScheduleVersionCommand,
    key: string,
    requestId: string,
  ): Promise<{ version: TermsVersion; replayed: boolean }> {
    const hash = requestHash({ versionId, ...command });
    return inTransaction(this.pool, async (client) => {
      await this.versions.lockLifecycle(client);
      const replay = await this.replay(client, actor, 'schedule', key, hash);
      if (replay) return { version: await this.getReplay(client, replay), replayed: true };
      const version = await this.versions.findById(client, versionId, true);
      if (!version) throw notFound();
      const effectiveAt = new Date(command.effectiveAt);
      assertSchedulable(version, effectiveAt, this.now());
      if (await this.versions.hasOtherScheduled(client, versionId)) {
        throw conflict('VERSION_OVERLAP', 'Ya existe una versión futura programada.');
      }
      const scheduled = await this.versions.schedule(client, versionId, effectiveAt, actor);
      await this.audit.versionEvent(client, 'scheduled', actor, versionId, requestId);
      await this.record(client, actor, 'schedule', key, hash, versionId, 200);
      return { version: scheduled, replayed: false };
    }, 'SERIALIZABLE');
  }

  public async withdraw(
    actor: ActorContext,
    versionId: string,
    key: string,
    requestId: string,
  ): Promise<{ version: TermsVersion; replayed: boolean }> {
    const hash = requestHash({ versionId });
    return inTransaction(this.pool, async (client) => {
      await this.versions.lockLifecycle(client);
      const replay = await this.replay(client, actor, 'withdraw', key, hash);
      if (replay) return { version: await this.getReplay(client, replay), replayed: true };
      const version = await this.versions.findById(client, versionId, true);
      if (!version) throw notFound();
      assertWithdrawable(version, this.now());
      const withdrawn = await this.versions.withdraw(client, versionId);
      await this.audit.versionEvent(client, 'withdrawn', actor, versionId, requestId);
      await this.record(client, actor, 'withdraw', key, hash, versionId, 200);
      return { version: withdrawn, replayed: false };
    }, 'SERIALIZABLE');
  }

  public async promoteDue(actor: ActorContext, requestId: string): Promise<TermsVersion | null> {
    return inTransaction(this.pool, async (client) => {
      const prior = await this.versions.findCurrent(client, true);
      const promoted = await this.versions.promoteDue(client, this.now());
      if (promoted) {
        if (prior) await this.audit.versionEvent(client, 'superseded', actor, prior.versionId, requestId);
        await this.audit.versionEvent(client, 'effective', actor, promoted.versionId, requestId);
      }
      return promoted;
    }, 'SERIALIZABLE');
  }

  private async replay(client: pg.PoolClient, actor: ActorContext, operation: AdminOperation, key: string, hash: string): Promise<string | null> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_sha256, resource_id FROM terms.terms_idempotency_records
        WHERE actor_id=$1 AND org_scope_id=$2 AND operation=$3 AND idempotency_key=$4 FOR UPDATE`,
      [actor.actorId, actor.orgId, operation, key],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.request_sha256 !== hash) throw conflict('IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otra solicitud.');
    if (!row.resource_id) throw unavailable();
    return row.resource_id;
  }

  private async getReplay(client: pg.PoolClient, id: string): Promise<TermsVersion> {
    const version = await this.versions.findById(client, id);
    if (!version) throw unavailable();
    return version;
  }

  private async record(client: pg.PoolClient, actor: ActorContext, operation: AdminOperation, key: string, hash: string, resourceId: string, status: number): Promise<void> {
    await client.query(
      `INSERT INTO terms.terms_idempotency_records (
         record_id, actor_id, org_scope_id, operation, idempotency_key,
         request_sha256, response_status, resource_id, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,transaction_timestamp()+interval '24 hours')`,
      [randomUUID(), actor.actorId, actor.orgId, operation, key, hash, status, resourceId],
    );
  }
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function conflict(code: string, detail: string): ProblemError {
  return new ProblemError({ status: 409, title: 'Conflicto de versión', detail, code });
}
function notFound(): ProblemError {
  return new ProblemError({ status: 404, title: 'Versión no encontrada', detail: 'La versión no existe o no es visible.', code: 'VERSION_NOT_FOUND' });
}
function unavailable(): ProblemError {
  return new ProblemError({ status: 503, title: 'Versión no disponible', detail: 'No fue posible recuperar el resultado previo.', code: 'VERSION_UNAVAILABLE', retryable: true });
}
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
