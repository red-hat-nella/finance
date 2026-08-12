import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type pg from 'pg';
import { loadRetentionDatabaseConfig } from '../config/load-retention-database.js';
import { createDatabasePool } from '../infrastructure/db/pool.js';

export interface RetentionResult { readonly anonymizedCount: number; readonly batches: number }

export async function runRetention(pool: pg.Pool, batchSize = 500, maxBatches = 20): Promise<RetentionResult> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('batchSize must be 1..1000');
  let anonymizedCount = 0;
  let batches = 0;
  for (; batches < maxBatches; batches += 1) {
    const result = await pool.query<{ anonymized_count: number }>(
      'SELECT terms.anonymize_expired_acceptances($1, $2) AS anonymized_count',
      [batchSize, randomUUID()],
    );
    const count = result.rows[0]?.anonymized_count ?? 0;
    anonymizedCount += count;
    if (count < batchSize) return { anonymizedCount, batches: batches + 1 };
  }
  return { anonymizedCount, batches };
}

async function main(): Promise<void> {
  const pool = createDatabasePool(loadRetentionDatabaseConfig());
  try {
    const result = await runRetention(pool, Number(process.env.RETENTION_BATCH_SIZE ?? 500));
    process.stdout.write(`${JSON.stringify({ level: 'info', event: 'retention.completed', ...result })}\n`);
  } finally { await pool.end(); }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) await main();
