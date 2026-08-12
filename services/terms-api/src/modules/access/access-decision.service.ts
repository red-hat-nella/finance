import type pg from 'pg';
import type { ActorContext } from '../../http/middleware/request-context.js';
import { ProblemError } from '../../http/problem.js';
import { recordTermsDecision } from '../../observability/metrics.js';
import { AcceptanceRepository } from '../acceptances/acceptance.repository.js';
import { VersionRepository } from '../versions/version.repository.js';

export interface AccessDecision {
  readonly allowed: boolean;
  readonly currentVersionId: string | null;
  readonly currentVersionCode: string | null;
  readonly acceptedVersionId: string | null;
  readonly checkedAt: string;
  readonly reason: 'ACCEPTED' | 'ACCEPTANCE_REQUIRED' | 'NO_EFFECTIVE_VERSION';
  readonly acceptanceUrl: '/terms/';
}

export class AccessDecisionService {
  public constructor(
    private readonly pool: pg.Pool,
    private readonly versions = new VersionRepository(),
    private readonly acceptances = new AcceptanceRepository(),
  ) {}

  public async decide(actor: ActorContext): Promise<AccessDecision> {
    try {
      const version = await this.versions.findCurrent(this.pool);
      if (!version) {
        recordTermsDecision('NO_EFFECTIVE_VERSION');
        return {
          allowed: false,
          currentVersionId: null,
          currentVersionCode: null,
          acceptedVersionId: null,
          checkedAt: new Date().toISOString(),
          reason: 'NO_EFFECTIVE_VERSION',
          acceptanceUrl: '/terms/',
        };
      }
      const acceptance = await this.acceptances.findForActor(this.pool, actor, version.versionId);
      recordTermsDecision(acceptance ? 'ACCEPTED' : 'ACCEPTANCE_REQUIRED');
      return {
        allowed: Boolean(acceptance),
        currentVersionId: version.versionId,
        currentVersionCode: version.versionCode,
        acceptedVersionId: acceptance?.versionId ?? null,
        checkedAt: new Date().toISOString(),
        reason: acceptance ? 'ACCEPTED' : 'ACCEPTANCE_REQUIRED',
        acceptanceUrl: '/terms/',
      };
    } catch {
      throw new ProblemError({
        status: 503,
        title: 'No fue posible comprobar la aceptación',
        detail: 'La decisión de acceso no puede producirse de forma confiable.',
        code: 'TERMS_SERVICE_UNAVAILABLE',
        retryable: true,
      });
    }
  }
}
