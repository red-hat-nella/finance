import type pg from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/load-config.js';
import { REQUIRED_MIGRATIONS } from '../../src/config/database.js';

const config = loadConfig({ NODE_ENV: 'test' });

function fakePool(query: ReturnType<typeof vi.fn>): pg.Pool {
  return { query } as unknown as pg.Pool;
}

describe('protocol-truthful health routes', () => {
  it('reports liveness without contacting dependencies', async () => {
    const query = vi.fn();
    const response = await request(createApp(config, fakePool(query))).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'terms-api' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports ready when DB and all migrations are available without requiring an effective version', async () => {
    const query = vi.fn((sql: string) => {
      if (sql === 'SELECT 1') return Promise.resolve({ rows: [{ '?column?': 1 }] });
      return Promise.resolve({
        rows: REQUIRED_MIGRATIONS.map((filename) => ({ filename, checksum: 'a'.repeat(64) })),
      });
    });
    const response = await request(createApp(config, fakePool(query))).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', service: 'terms-api' });
    expect(query.mock.calls.every(([sql]) => !sql.includes('terms_versions'))).toBe(true);
  });

  it.each([
    ['database unavailable', vi.fn(() => Promise.reject(new Error('synthetic outage')))],
    ['migration missing', vi.fn((sql: string) => Promise.resolve(sql === 'SELECT 1' ? { rows: [{}] } : { rows: [] }))],
  ])('reports 503 when %s', async (_name, query) => {
    const response = await request(createApp(config, fakePool(query))).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.type).toBe('application/problem+json');
    expect(response.body).toMatchObject({
      status: 503,
      retryable: true,
    });
  });
});
