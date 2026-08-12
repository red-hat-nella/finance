import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type pg from 'pg';
import { MIGRATION_LOCK_NAME, migrationChecksum } from '../config/database.js';
import { loadJobDatabaseConfig } from '../config/load-job-database.js';
import { createDatabasePool } from '../infrastructure/db/pool.js';

const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

export interface MigrationResult {
  readonly discoveredCount: number;
  readonly appliedCount: number;
}

export async function runMigrations(
  pool: pg.Pool,
  directory: string,
): Promise<MigrationResult> {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);
    locked = true;
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.terms_schema_migrations (
         filename text PRIMARY KEY,
         checksum char(64) NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
       )`,
    );
    const files = (await readdir(directory)).filter((file) => MIGRATION_FILE_PATTERN.test(file)).sort();
    let appliedCount = 0;
    for (const filename of files) {
      const sql = await readFile(join(directory, filename), 'utf8');
      const checksum = migrationChecksum(sql);
      const applied = await client.query<{ checksum: string }>(
        'SELECT checksum FROM public.terms_schema_migrations WHERE filename = $1',
        [filename],
      );
      if (applied.rowCount) {
        if (applied.rows[0]?.checksum !== checksum) {
          throw new Error(`Migration checksum mismatch: ${filename}`);
        }
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO public.terms_schema_migrations (filename, checksum)
           VALUES ($1, $2)`,
          [filename, checksum],
        );
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return { discoveredCount: files.length, appliedCount };
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_NAME]);
      }
    } finally {
      client.release();
    }
  }
}

async function main(): Promise<void> {
  const directory = process.env.MIGRATIONS_DIR ?? '/opt/app-root/src/migrations';
  const pool = createDatabasePool(loadJobDatabaseConfig());
  try {
    const result = await runMigrations(pool, directory);
    process.stdout.write(`${JSON.stringify({ level: 'info', event: 'migrations.completed', ...result })}\n`);
  } finally {
    await pool.end();
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await main();
}
