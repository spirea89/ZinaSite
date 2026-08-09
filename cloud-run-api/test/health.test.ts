import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

let app: FastifyInstance | undefined;
afterEach(async () => { if (app) await app.close(); app = undefined; });

describe('health endpoint', () => {
  it('returns the v1 envelope without private configuration', async () => {
    app = await buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, data: { status: 'ok' }, error: null, version: 'v1' });
  });

  it('does not expose an action route before authentication exists', async () => {
    app = await buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
    const response = await app.inject({ method: 'POST', url: '/v1/admin', payload: { action: 'listAllEvents' } });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ ok: false, data: null, error: { code: 'NOT_FOUND', message: 'Route not found.' }, version: 'v1' });
  });
});

