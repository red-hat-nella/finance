import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadJobDatabaseConfig } from "../config/load-job-database.js";
import { MIGRATION_LOCK_NAME, migrationChecksum } from "../config/database.js";
import { createDatabasePool } from "../infrastructure/db/pool.js";

const directory = process.env["MIGRATIONS_DIR"] ?? "/opt/app-root/src/migrations";
const pool = createDatabasePool(loadJobDatabaseConfig());
const client = await pool.connect();

try {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [MIGRATION_LOCK_NAME]);
  await client.query(
    `CREATE TABLE IF NOT EXISTS public.schema_migrations(
       filename text PRIMARY KEY,
       checksum text,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  await client.query("ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum text");

  const files = (await readdir(directory))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  let appliedCount = 0;
  for (const filename of files) {
    const sql = await readFile(join(directory, filename), "utf8");
    const checksum = migrationChecksum(sql);
    const applied = await client.query<{ checksum: string | null }>(
      "SELECT checksum FROM public.schema_migrations WHERE filename=$1",
      [filename],
    );
    if (applied.rowCount) {
      const recorded = applied.rows[0]?.checksum;
      if (recorded && recorded !== checksum) {
        throw new Error(`Migration checksum mismatch: ${filename}`);
      }
      if (!recorded) {
        await client.query(
          "UPDATE public.schema_migrations SET checksum=$2 WHERE filename=$1 AND checksum IS NULL",
          [filename, checksum],
        );
      }
      continue;
    }

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO public.schema_migrations(filename, checksum)
         VALUES($1, $2)
         ON CONFLICT (filename) DO NOTHING`,
        [filename, checksum],
      );
      await client.query("COMMIT");
      appliedCount += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log(
    JSON.stringify({
      level: "info",
      event: "migrations.completed",
      discoveredCount: files.length,
      appliedCount,
    }),
  );
} finally {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [MIGRATION_LOCK_NAME]);
  } finally {
    client.release();
    await pool.end();
  }
}
