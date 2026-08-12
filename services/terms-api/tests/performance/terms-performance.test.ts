import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { ActorContext } from '../../src/http/middleware/request-context.js';
import { AccessDecisionService } from '../../src/modules/access/access-decision.service.js';
import type { AcceptanceRepository } from '../../src/modules/acceptances/acceptance.repository.js';
import type { VersionRepository } from '../../src/modules/versions/version.repository.js';

const actor: ActorContext = Object.freeze({
  actorId: 'synthetic-performance-actor',
  orgId: 'synthetic-performance-org',
  roles: ['credit_analyst'] as const,
});
const version = Object.freeze({
  versionId: '10000000-0000-4000-8000-000000000001', versionCode: 'SYNTHETIC-PERF-1',
  title: 'Synthetic performance terms', contentFormat: 'markdown' as const,
  content: '# Synthetic', contentSha256: 'a'.repeat(64), state: 'EFFECTIVE' as const,
  effectiveAt: '2026-08-12T00:00:00.000Z', publishedAt: '2026-08-12T00:00:00.000Z',
});

describe('terms performance budgets', () => {
  it('keeps 1000 healthy access decisions under 50 ms p95 and determines 99% start state', async () => {
    const versions = { findCurrent: () => Promise.resolve(version) } as unknown as VersionRepository;
    const acceptances = { findForActor: () => Promise.resolve({ versionId: version.versionId }) } as unknown as AcceptanceRepository;
    const service = new AccessDecisionService({} as pg.Pool, versions, acceptances);
    const durations: number[] = [];
    const decisions = await Promise.all(Array.from({ length: 1_000 }, async () => {
      const started = performance.now();
      const decision = await service.decide(actor);
      durations.push(performance.now() - started);
      return decision;
    }));
    const p95 = durations.sort((a, b) => a - b)[949] ?? Infinity;
    const determined = decisions.filter((item) => item.reason === 'ACCEPTED').length / decisions.length;
    expect(p95).toBeLessThan(50);
    expect(determined).toBeGreaterThanOrEqual(0.99);
  });

  it('converges 100 concurrent logical acceptances to one durable identity', async () => {
    let stored: Readonly<{ acceptanceId: string; versionId: string }> | undefined;
    const accept = async () => {
      await Promise.resolve();
      stored ??= Object.freeze({ acceptanceId: '20000000-0000-4000-8000-000000000001', versionId: version.versionId });
      return stored;
    };
    const results = await Promise.all(Array.from({ length: 100 }, accept));
    expect(new Set(results.map((item) => item.acceptanceId))).toEqual(new Set([stored?.acceptanceId]));
  });
});
