import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { migrationChecksum, REQUIRED_MIGRATIONS } from '../../src/config/database.js';
import { runMigrations } from '../../src/jobs/migrate.js';

const directory = resolve(process.cwd(), '../../db/terms-migrations');

interface FakeMigrationClient {
  readonly query: ReturnType<typeof vi.fn>;
  readonly release: ReturnType<typeof vi.fn>;
}

function poolWithApplied(applied: ReadonlyMap<string, string>): {
  pool: pg.Pool;
  client: FakeMigrationClient;
} {
  const client: FakeMigrationClient = {
    query: vi.fn((sql: string, parameters?: readonly unknown[]) => {
      if (sql.startsWith('SELECT checksum')) {
        const filename = String(parameters?.[0]);
        const checksum = applied.get(filename);
        return Promise.resolve(checksum
          ? { rowCount: 1, rows: [{ checksum }] }
          : { rowCount: 0, rows: [] });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    }),
    release: vi.fn(),
  };
  return {
    pool: { connect: vi.fn(() => Promise.resolve(client)) } as unknown as pg.Pool,
    client,
  };
}

describe('terms migration runner', () => {
  it('owns exactly the ordered immutable foundation migration set', async () => {
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    expect(files).toEqual([...REQUIRED_MIGRATIONS]);
    const all = (await Promise.all(files.map((file) => readFile(resolve(directory, file), 'utf8')))).join('\n');
    expect(all).toContain('terms_migrator');
    expect(all).toContain('terms_app');
    expect(all).toContain('terms_retention');
    expect(all).toContain('terms_backup');
    expect(all).toContain('uq_terms_versions_single_effective');
    expect(all).toContain('trg_terms_audit_no_update_or_delete');
    expect(all).toContain("OLD.state IN ('SCHEDULED', 'EFFECTIVE', 'SUPERSEDED')");
  });

  it('applies every migration to an empty database under one advisory lock', async () => {
    const { pool, client } = poolWithApplied(new Map());
    const result = await runMigrations(pool, directory);
    expect(result).toEqual({ discoveredCount: REQUIRED_MIGRATIONS.length, appliedCount: REQUIRED_MIGRATIONS.length });
    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_lock(hashtext($1))',
      ['finance2-terms-schema-v1'],
    );
    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1))',
      ['finance2-terms-schema-v1'],
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('upgrades N-1 once and rejects a changed applied migration', async () => {
    const checksums = new Map<string, string>();
    for (const filename of REQUIRED_MIGRATIONS.slice(0, -1)) {
      checksums.set(filename, migrationChecksum(await readFile(resolve(directory, filename), 'utf8')));
    }
    const upgrade = poolWithApplied(checksums);
    await expect(runMigrations(upgrade.pool, directory)).resolves.toEqual({
      discoveredCount: REQUIRED_MIGRATIONS.length,
      appliedCount: 1,
    });

    const firstMigration = REQUIRED_MIGRATIONS.at(0);
    if (!firstMigration) throw new Error('migration inventory is unexpectedly empty');
    checksums.set(firstMigration, '0'.repeat(64));
    const changed = poolWithApplied(checksums);
    await expect(runMigrations(changed.pool, directory)).rejects.toThrow(
      'Migration checksum mismatch: 0001_terms_schema.sql',
    );
  });
});
