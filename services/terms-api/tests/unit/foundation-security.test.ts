import { PassThrough } from 'node:stream';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config/load-config.js';
import { serviceAuth } from '../../src/http/middleware/service-auth.js';
import { createLogger } from '../../src/infrastructure/logging/logger.js';

describe('foundation security', () => {
  it('rejects production defaults, plaintext DB traffic and shared runtime roles', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_SSL_MODE must protect production traffic',
    );
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_SSL_MODE: 'require',
        DATABASE_PASSWORD_FILE: '/synthetic/missing',
        TERMS_SERVICE_TOKEN_FILE: '/synthetic/missing',
        DATABASE_USER: 'postgres',
      }),
    ).toThrow();
  });

  it('compares the internal service credential and never attaches the supplied value', () => {
    const middleware = serviceAuth({ serviceAuth: { token: 'a'.repeat(32) } });
    const request = {
      header: vi.fn(() => 'a'.repeat(32)),
    } as unknown as Request;
    const response = {} as Response;
    const next = vi.fn() as NextFunction;
    middleware(request, response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(request.serviceAuthenticated).toBe(true);
    expect(request).not.toHaveProperty('serviceToken');
  });

  it('redacts credentials, content and raw identity fields from structured logs', async () => {
    const destination = new PassThrough();
    let output = '';
    destination.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    const logger = createLogger({ logLevel: 'info' }, destination);
    logger.info({
      authorization: 'synthetic-secret-bearer',
      token: 'synthetic-secret-service-token',
      content: 'synthetic legal body',
      actorId: 'synthetic-actor-raw',
      orgScopeId: 'synthetic-org-raw',
      safeCode: 'TERMS_ACCEPTED',
    });
    await new Promise<void>((resolve) => destination.end(resolve));
    expect(output).not.toContain('synthetic-secret');
    expect(output).not.toContain('synthetic legal body');
    expect(output).not.toContain('synthetic-actor-raw');
    expect(output).not.toContain('synthetic-org-raw');
    expect(output).toContain('TERMS_ACCEPTED');
  });
});
