import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadJobDatabaseConfig } from "../config/load-job-database.js";
import { createDatabasePool } from "../infrastructure/db/pool.js";

const directory = process.env["MIGRATIONS_DIR"] ?? "/opt/app-root/src/migrations";
const pool = createDatabasePool(loadJobDatabaseConfig());

try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS public.schema_migrations(
       filename text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const files = (await readdir(directory))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  for (const filename of files) {
    const applied = await pool.query(
      "SELECT 1 FROM public.schema_migrations WHERE filename=$1",
      [filename],
    );
    if (applied.rowCount) continue;
    const sql = await readFile(join(directory, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO public.schema_migrations(filename) VALUES($1)",
        [filename],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const retentionSecret = process.env["RETENTION_DATABASE_PASSWORD_FILE"];
  if (retentionSecret) {
    const password = readFileSync(retentionSecret, "utf8").trim();
    const escaped = await pool.query<{ statement: string }>(
      "SELECT format('ALTER ROLE scoring_retention LOGIN PASSWORD %L', $1) statement",
      [password],
    );
    const statement = escaped.rows[0]?.statement;
    if (!statement) throw new Error("Could not prepare retention role");
    await pool.query(statement);
  }
  console.log(
    JSON.stringify({ level: "info", event: "migrations.completed", count: files.length }),
  );
} finally {
  await pool.end();
}
