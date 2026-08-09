import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { TEST_ORIGIN, testConfig } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => { if (app) await app.close(); app = undefined; });

describe('CORS', () => {
  it('supports an exact allowed-origin preflight', async () => {
    app = await buildApp(testConfig());
    const response = await app.inject({
      method: 'OPTIONS', url: '/v1/admin',
      headers: { origin: TEST_ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']?.toLowerCase()).toContain('authorization');
    expect(response.headers.vary?.toLowerCase()).toContain('origin');
  });

  it('omits CORS permission for every unlisted origin', async () => {
    app = await buildApp(testConfig());
    const response = await app.inject({
      method: 'OPTIONS', url: '/v1/admin',
      headers: { origin: 'https://unlisted.example.invalid', 'access-control-request-method': 'POST' },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

