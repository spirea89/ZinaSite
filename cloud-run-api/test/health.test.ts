import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { testConfig } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => { if (app) await app.close(); app = undefined; });

describe('health endpoint', () => {
  it('returns the v1 envelope without private configuration', async () => {
    app = await buildApp(testConfig());
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, data: { status: 'ok' }, error: null, version: 'v1' });
  });

  it('fails closed on the admin route when authentication is missing', async () => {
    app = await buildApp(testConfig());
    const response = await app.inject({ method: 'POST', url: '/v1/admin', payload: { action: 'listAllEvents' } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ ok: false, data: null, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }, version: 'v1' });
  });
});
