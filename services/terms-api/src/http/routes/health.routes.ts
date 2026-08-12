import { Router } from 'express';
import type pg from 'pg';
import { REQUIRED_MIGRATIONS } from '../../config/database.js';
import { setDependencyState } from '../../observability/metrics.js';

interface MigrationRow {
  filename: string;
  checksum: string;
}

export function healthRoutes(pool: pg.Pool): Router {
  const router = Router();
  router.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', service: 'terms-api' });
  });
  router.get('/health/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      setDependencyState('database', true);
    } catch {
      setDependencyState('database', false);
      setDependencyState('migrations', false);
      res.status(503).type('application/problem+json').json({
        type: 'https://errors.example.test/dependency-unavailable',
        title: 'Servicio no disponible',
        status: 503,
        detail: 'La persistencia no está disponible.',
        code: 'DEPENDENCY_UNAVAILABLE',
        retryable: true,
        requestId: _req.requestId,
      });
      return;
    }
    try {
      const applied = await pool.query<MigrationRow>(
        `SELECT filename, checksum
           FROM public.terms_schema_migrations
          WHERE filename = ANY($1::text[])`,
        [REQUIRED_MIGRATIONS],
      );
      const complete =
        applied.rows.length === REQUIRED_MIGRATIONS.length &&
        applied.rows.every((row) => row.checksum.length === 64);
      setDependencyState('migrations', complete);
      if (!complete) throw new Error('required migrations are not complete');
      res.json({ status: 'ready', service: 'terms-api' });
    } catch {
      setDependencyState('migrations', false);
      res.status(503).type('application/problem+json').json({
        type: 'https://errors.example.test/migrations-incomplete',
        title: 'Servicio no disponible',
        status: 503,
        detail: 'Las migraciones requeridas no están completas.',
        code: 'MIGRATIONS_INCOMPLETE',
        retryable: true,
        requestId: _req.requestId,
      });
    }
  });
  return router;
}
