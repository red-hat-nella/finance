import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  recordTermsAcceptance, recordTermsDecision, renderMetrics, setTermsGauge,
} from '../../src/observability/metrics.js';

describe('terms operational signals', () => {
  it('publishes bounded labels and required gauges without identifiers or content', () => {
    recordTermsDecision('ACCEPTANCE_REQUIRED');
    recordTermsAcceptance('created');
    setTermsGauge('applicable_versions', 1);
    setTermsGauge('retention_backlog', 2);
    setTermsGauge('retention_last_success_timestamp_seconds', 1_786_000_000);
    const metrics = renderMetrics();
    expect(metrics).toContain('finance2_terms_access_decisions_total{reason="ACCEPTANCE_REQUIRED"}');
    expect(metrics).toContain('finance2_terms_acceptances_total{outcome="created"}');
    expect(metrics).toContain('finance2_terms_applicable_versions 1');
    expect(metrics).toContain('finance2_terms_retention_backlog 2');
    expect(metrics).not.toMatch(/actor|org_scope|content_sha256/i);
  });

  it('declares every actionable alert required by the plan', async () => {
    const alerts = await readFile(resolve(process.cwd(), '../../deploy/observability/terms-alerts.yaml'), 'utf8');
    for (const name of [
      'TermsUnavailable', 'TermsDatabaseUnavailable', 'NoSingleActiveTermsVersion',
      'TermsAcceptanceErrorRate', 'TermsAcceptanceLatency', 'TermsMigrationFailed',
      'TermsRetentionLate', 'TermsBackupRestoreStale', 'TermsGateSmokeFailed',
    ]) expect(alerts).toContain(`name: ${name}`);
    expect(alerts).not.toMatch(/token|password|actor_id|org_scope_id/i);
  });
});
