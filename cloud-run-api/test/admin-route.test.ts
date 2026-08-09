import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryAdministratorDirectory } from '../src/auth/in-memory-admin-directory.js';
import { InMemoryCmsRepository } from '../src/repositories/in-memory-cms-repository.js';
import { FakeTokenVerifier, TEST_EMAIL, TEST_ORIGIN, testConfig } from './helpers.js';

let app: FastifyInstance | undefined;
afterEach(async () => { if (app) await app.close(); app = undefined; });

const snapshot = {
  articles: [{ id: 'article-fixture' }],
  categories: [{ id: 'category-fixture' }],
  events: [{ id: 'event-fixture', status: 'draft' }],
  teamMembers: [{ id: 'team-fixture' }],
  homepageContent: { content: {} },
};

function request(action: string, authorization = 'Bearer fake-unit-test-credential') {
  return { method: 'POST' as const, url: '/v1/admin', headers: { authorization, origin: TEST_ORIGIN }, payload: { action } };
}

describe('protected admin reads', () => {
  it('rejects missing and malformed bearer headers before verification', async () => {
    app = await buildApp(testConfig(), {
      tokenVerifier: new FakeTokenVerifier(),
      administratorDirectory: new InMemoryAdministratorDirectory([{ email: TEST_EMAIL, active: true }]),
      cmsRepository: new InMemoryCmsRepository(),
    });
    const missing = await app.inject({ method: 'POST', url: '/v1/admin', payload: { action: 'listAllEvents' } });
    expect(missing.statusCode).toBe(401);
    expect(missing.json().error.code).toBe('AUTHENTICATION_REQUIRED');
    const malformed = await app.inject(request('listAllEvents', 'Basic not-a-bearer-token'));
    expect(malformed.statusCode).toBe(401);
    expect(malformed.json().error.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects invalid verification without exposing verifier details', async () => {
    app = await buildApp(testConfig(), {
      tokenVerifier: new FakeTokenVerifier(undefined, true),
      administratorDirectory: new InMemoryAdministratorDirectory(),
      cmsRepository: new InMemoryCmsRepository(),
    });
    const response = await app.inject(request('listAllEvents'));
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ ok: false, data: null, error: { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed.' }, version: 'v1' });
  });

  it('rejects missing and inactive administrators', async () => {
    for (const records of [[], [{ email: TEST_EMAIL, active: false }]]) {
      app = await buildApp(testConfig(), {
        tokenVerifier: new FakeTokenVerifier(),
        administratorDirectory: new InMemoryAdministratorDirectory(records),
        cmsRepository: new InMemoryCmsRepository(),
      });
      const response = await app.inject(request('listAllEvents'));
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ ok: false, data: null, error: { code: 'FORBIDDEN', message: 'Administrator access is not authorized.' }, version: 'v1' });
      await app.close(); app = undefined;
    }
  });

  it.each([
    ['listAllArticles', snapshot.articles],
    ['listArticleCategories', snapshot.categories],
    ['listAllEvents', snapshot.events],
    ['listTeamMembers', snapshot.teamMembers],
    ['getHomepageContent', snapshot.homepageContent],
  ])('authorizes active administrator for %s', async (action, expected) => {
    app = await buildApp(testConfig(), {
      tokenVerifier: new FakeTokenVerifier(),
      administratorDirectory: new InMemoryAdministratorDirectory([{ email: TEST_EMAIL, active: true }]),
      cmsRepository: new InMemoryCmsRepository(snapshot),
    });
    const response = await app.inject(request(action));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, data: expected, error: null, version: 'v1' });
  });

  it('does not expose write actions or trust body origin fields', async () => {
    app = await buildApp(testConfig(), {
      tokenVerifier: new FakeTokenVerifier(),
      administratorDirectory: new InMemoryAdministratorDirectory([{ email: TEST_EMAIL, active: true }]),
      cmsRepository: new InMemoryCmsRepository(snapshot),
    });
    const writeResponse = await app.inject(request('createArticle'));
    expect(writeResponse.statusCode).toBe(404);
    expect(writeResponse.json().error.code).toBe('UNKNOWN_ADMIN_ACTION');
    const originResponse = await app.inject({ ...request('listAllEvents'), payload: { action: 'listAllEvents', origin: TEST_ORIGIN } });
    expect(originResponse.statusCode).toBe(400);
    expect(originResponse.json().error.code).toBe('INVALID_PAYLOAD');
  });
});
