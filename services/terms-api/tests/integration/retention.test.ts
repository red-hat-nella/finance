import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runRetention } from '../../src/jobs/retention.js';
import { scriptedPool } from '../support/fixtures.js';

describe('five-year acceptance retention', () => {
  it('uses a bounded, idempotent database function until the backlog is drained', async () => {
    const counts = [2, 2, 0];
    const calls: readonly unknown[][] = [];
    const pool = scriptedPool((sql, values) => {
      expect(sql).toBe('SELECT terms.anonymize_expired_acceptances($1, $2) AS anonymized_count');
      (calls as unknown[][]).push([...(values ?? [])]);
      return { rows: [{ anonymized_count: counts.shift() ?? 0 }] };
    });
    const result = await runRetention(pool, 2, 10);
    expect(result).toEqual({ anonymizedCount: 4, batches: 3 });
    expect(calls.every((values) => values[0] === 2 && typeof values[1] === 'string')).toBe(true);
  });

  it('defines controlled-clock expiry, SKIP LOCKED batches, irreversible masking and restricted grants', async () => {
    const sql = await readFile(resolve(process.cwd(), '../../db/terms-migrations/0005_terms_retention.sql'), 'utf8');
    expect(sql).toContain('retention_until <= transaction_timestamp()');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toMatch(/actor_id=NULL, org_scope_id=NULL, actor_fingerprint=NULL/);
    expect(sql).toContain("current_user <> 'terms_retention'");
    expect(sql).toContain('REVOKE ALL ON FUNCTION');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION');
    expect(sql).not.toMatch(/DELETE FROM terms\.terms_acceptances/i);
  });

  it('rejects unsafe batch sizes before touching the database', async () => {
    let queried = false;
    const pool = scriptedPool(() => { queried = true; return { rows: [] }; });
    await expect(runRetention(pool, 0)).rejects.toThrow('batchSize must be 1..1000');
    await expect(runRetention(pool, 1001)).rejects.toThrow('batchSize must be 1..1000');
    expect(queried).toBe(false);
  });
});
