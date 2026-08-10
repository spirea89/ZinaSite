const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const PUBLIC = path.join(__dirname, '..', 'public');

function envelope(data) { return { ok: true, data, error: null, version: 'v1' }; }
function failure(code, message = 'safe') { return { ok: false, data: null, error: { code, message }, version: 'v1' }; }

function makeContext(handler) {
  const calls = [];
  const authEvents = [];
  const window = {
    __ZINA_RUNTIME_CONFIG: {
      backendProvider: 'google-apps-script',
      publicAppsScriptApiUrl: 'https://example.test/public',
      protectedAppsScriptApiUrl: 'https://example.test/protected',
      googleOAuthClientId: 'test-client.apps.googleusercontent.com'
    },
    crypto: webcrypto,
    AuthService: {
      getIdToken: async () => 'memory-only-test-token',
      handleRejectedToken: code => authEvents.push(code)
    }
  };
  class FileReader {
    readAsDataURL(file) { this.result = `data:${file.type};base64,${file.base64 || 'AA=='}`; queueMicrotask(() => this.onload()); }
  }
  const context = vm.createContext({
    window,
    URL,
    Uint8Array,
    console,
    FileReader,
    fetch: async (url, options = {}) => {
      const request = { url: String(url), options, body: options.body ? JSON.parse(options.body) : null };
      calls.push(request);
      const result = await handler(request, calls);
      if (result instanceof Error) throw result;
      return { json: async () => result };
    }
  });
  for (const file of ['zina-config.js', 'google-apps-script-provider.js']) {
    vm.runInContext(fs.readFileSync(path.join(PUBLIC, file), 'utf8'), context, { filename: file });
  }
  return { api: window.GoogleAppsScriptProvider, calls, authEvents, window };
}

test('production configuration defaults to Supabase with no Google identifiers', () => {
  const window = {};
  const context = vm.createContext({ window });
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'zina-config.js'), 'utf8'), context);
  assert.equal(window.ZinaConfig.get().backendProvider, 'supabase');
  assert.equal(window.ZinaConfig.get().googleOAuthClientId, '');
});

test('protected updates put concurrency metadata at the top level', async () => {
  const article = { id: 'a', title: 'old', updatedAt: '2026-08-09T10:00:00.000Z' };
  const { api, calls } = makeContext(request => {
    if (request.body.action === 'listAllArticles') return envelope([article]);
    if (request.body.action === 'updateArticle') return envelope({ ...article, title: 'new', updatedAt: '2026-08-09T10:01:00.000Z' });
    throw new Error('unexpected action');
  });
  await api.getAllArticles();
  await api.updateArticle('a', { title: 'new' });
  const request = calls.at(-1).body;
  assert.equal(request.expectedUpdatedAt, article.updatedAt);
  assert.equal('expectedUpdatedAt' in request.payload, false);
  assert.equal(request.idToken, 'memory-only-test-token');
});

test('uncertain create retries reuse the same cryptographic idempotency key', async () => {
  let attempts = 0;
  const { api, calls } = makeContext(request => {
    if (request.body.action !== 'createArticle') throw new Error('unexpected action');
    attempts += 1;
    if (attempts === 1) return new Error('connection lost');
    return envelope({ id: 'created', updatedAt: '2026-08-09T10:00:00.000Z' });
  });
  const payload = { title: 'T', content: '<p>C</p>', status: 'draft' };
  await assert.rejects(() => api.createArticle(payload));
  await api.createArticle(payload);
  assert.equal(calls[0].body.idempotencyKey, calls[1].body.idempotencyKey);
  assert.match(calls[0].body.idempotencyKey, /^[a-f0-9]{48}$/);
});

test('conflict reloads the latest record and requires review', async () => {
  let listCount = 0;
  const old = { id: 'a', updatedAt: '2026-08-09T10:00:00.000Z' };
  const latest = { id: 'a', updatedAt: '2026-08-09T10:02:00.000Z' };
  const { api } = makeContext(request => {
    if (request.body.action === 'listAllArticles') return envelope(listCount++ ? [latest] : [old]);
    if (request.body.action === 'updateArticle') return failure('CONFLICT');
    throw new Error('unexpected action');
  });
  await api.getAllArticles();
  await assert.rejects(() => api.updateArticle('a', { title: 'mine' }), error => {
    assert.equal(error.code, 'CONFLICT');
    assert.equal(error.requiresReview, true);
    assert.deepEqual(error.latestData, [latest]);
    return true;
  });
});

test('WRITE_STATE_UNCERTAIN reloads state and never invents a new key', async () => {
  const latest = { id: 'a', updatedAt: '2026-08-09T10:02:00.000Z' };
  let creates = 0;
  const { api, calls } = makeContext(request => {
    if (request.body.action === 'createArticle') {
      creates += 1;
      return creates === 1 ? failure('WRITE_STATE_UNCERTAIN') : envelope(latest);
    }
    if (request.body.action === 'listAllArticles') return envelope([latest]);
    throw new Error('unexpected action');
  });
  const payload = { title: 'T', content: '<p>C</p>', status: 'draft' };
  await assert.rejects(() => api.createArticle(payload), error => error.code === 'WRITE_STATE_UNCERTAIN' && error.requiresReview);
  await api.createArticle(payload);
  const createsOnly = calls.filter(call => call.body?.action === 'createArticle');
  assert.equal(createsOnly[0].body.idempotencyKey, createsOnly[1].body.idempotencyKey);
});

test('rejected authentication clears the in-memory credential through AuthService', async () => {
  const { api, authEvents } = makeContext(() => failure('AUTHENTICATION_FAILED'));
  await assert.rejects(() => api.getAllEvents(), error => error.code === 'AUTHENTICATION_FAILED');
  assert.deepEqual(authEvents, ['AUTHENTICATION_FAILED']);
});

test('public reads use GET and return only the backend published list', async () => {
  const { api, calls } = makeContext(request => {
    assert.equal(request.options.method, 'GET');
    return envelope({ items: [{ id: 'published', status: 'published' }], total: 1, page: 1, limit: 100 });
  });
  const articles = await api.getArticles();
  assert.deepEqual(articles.map(item => item.id), ['published']);
  assert.match(calls[0].url, /action=listPublishedArticles/);
});

test('provider exposes the complete 21-action Apps Script contract', async () => {
  const t1 = '2026-08-09T10:00:00.000Z';
  const t2 = '2026-08-09T10:01:00.000Z';
  const base = {
    article: { id: 'article', title: 'A', content: '<p>A</p>', status: 'draft', updatedAt: t1 },
    category: { id: 'category', slug: 'category', name_ro: 'R', name_en: 'E', name_de: 'D', updated_at: t1 },
    event: { id: 'event', title: 'E', startDate: t1, status: 'draft', updatedAt: t1 },
    team: { id: 'team', name: 'T', roleEn: 'R', bioEn: 'B', sortOrder: 1, updatedAt: t1 },
    home: { content: {}, heroImageUrl: '', heroDriveFileId: '', heroImagePosition: { x: 50, y: 50 }, updatedAt: t1 }
  };
  const { api, calls } = makeContext(request => {
    const action = request.body.action;
    const responses = {
      listAllArticles: [base.article], listArticleCategories: [base.category], listAllEvents: [base.event], listTeamMembers: [base.team], getHomepageContent: base.home,
      createArticle: base.article, updateArticle: { ...base.article, updatedAt: t2 }, setArticleStatus: { ...base.article, status: 'published', updatedAt: t2 }, deleteArticle: true,
      createArticleCategory: base.category, updateArticleCategory: { ...base.category, updated_at: t2 }, deleteArticleCategory: true,
      createEvent: base.event, updateEvent: { ...base.event, updatedAt: t2 }, setEventStatus: { ...base.event, status: 'published', updatedAt: t2 }, deleteEvent: true,
      createTeamMember: base.team, updateTeamMember: { ...base.team, updatedAt: t2 }, updateTeamMemberSortOrder: { ...base.team, sortOrder: 2, updatedAt: t2 }, deleteTeamMember: true,
      updateHomepageContent: { ...base.home, updatedAt: t2 }
    };
    if (!(action in responses)) throw new Error(`unexpected action ${action}`);
    return envelope(responses[action]);
  });

  await api.getAllArticles(); await api.getCategories(true); await api.getAllEvents(); await api.getTeamMembers(true); await api.getHomepageContent(true);
  await api.createArticle({ title: 'A', content: '<p>A</p>', status: 'draft' }); await api.updateArticle('article', { title: 'B' }); await api.setArticleStatus('article', 'published'); await api.deleteArticle('article');
  await api.createCategory({ slug: 'category', nameRo: 'R', nameEn: 'E', nameDe: 'D' }); await api.updateCategory('category', { nameRo: 'R2', nameEn: 'E2', nameDe: 'D2' }); await api.deleteCategory('category');
  await api.createEvent({ title: 'E', startDate: t1, status: 'draft' }); await api.updateEvent('event', { title: 'E2' }); await api.setEventStatus('event', 'published'); await api.deleteEvent('event');
  await api.createTeamMember({ name: 'T', roleEn: 'R', bioEn: 'B', sortOrder: 1 }); await api.updateTeamMember('team', { name: 'T2' }); await api.updateTeamMemberSortOrder('team', 2); await api.deleteTeamMember('team');
  await api.updateHomepageContent({ title: 'Home' }, '', { x: 50, y: 50 });

  assert.deepEqual(new Set(calls.map(call => call.body.action)), new Set([
    'listAllArticles','listArticleCategories','listAllEvents','listTeamMembers','getHomepageContent',
    'createArticle','updateArticle','setArticleStatus','deleteArticle',
    'createArticleCategory','updateArticleCategory','deleteArticleCategory',
    'createEvent','updateEvent','setEventStatus','deleteEvent',
    'createTeamMember','updateTeamMember','updateTeamMemberSortOrder','deleteTeamMember','updateHomepageContent'
  ]));
});

test('stale delete conflict reloads current state and does not retry', async () => {
  const old = { id: 'event', updatedAt: '2026-08-09T10:00:00.000Z' };
  const latest = { id: 'event', updatedAt: '2026-08-09T10:02:00.000Z' };
  let lists = 0;
  const { api, calls } = makeContext(request => {
    if (request.body.action === 'listAllEvents') return envelope(lists++ ? [latest] : [old]);
    if (request.body.action === 'deleteEvent') return failure('CONFLICT');
    throw new Error('unexpected action');
  });
  await api.getAllEvents();
  await assert.rejects(() => api.deleteEvent('event'), error => error.code === 'CONFLICT' && error.requiresReview);
  assert.equal(calls.filter(call => call.body.action === 'deleteEvent').length, 1);
});

test('inactive administrator and backend validation errors stay sanitized', async () => {
  const forbidden = makeContext(() => failure('FORBIDDEN', 'Administrator access is not authorized.'));
  await assert.rejects(() => forbidden.api.getAllArticles(), error => error.code === 'FORBIDDEN' && !/token|stack/i.test(error.message));
  assert.deepEqual(forbidden.authEvents, ['FORBIDDEN']);

  const invalid = makeContext(() => failure('UNSAFE_HTML', 'content contains unsafe HTML.'));
  await assert.rejects(() => invalid.api.createArticle({ title: 'A', content: '<script>x</script>', status: 'draft' }), error => error.code === 'UNSAFE_HTML' && !/stack/i.test(error.message));
});

test('media provider uploads, replaces, and soft-deletes with safety metadata', async () => {
  const t1 = '2026-08-09T10:00:00.000Z';
  const t2 = '2026-08-09T10:01:00.000Z';
  const first = { id: 'media-1', usage: 'team', status: 'active', updatedAt: t1, publicUrl: 'https://example.test/image' };
  const replacement = { ...first, updatedAt: t2 };
  const deleted = { ...replacement, status: 'deleted', publicUrl: '', updatedAt: '2026-08-09T10:02:00.000Z' };
  const { api, calls } = makeContext(request => {
    const action = request.body.action;
    if (action === 'listMedia') return envelope([first]);
    if (action === 'uploadMedia') return envelope(first);
    if (action === 'replaceMedia') return envelope(replacement);
    if (action === 'deleteMedia') return envelope(deleted);
    throw new Error(`unexpected action ${action}`);
  });
  const file = { name: 'portrait.png', type: 'image/png', size: 4, base64: 'iVBORw==' };
  await api.listMedia();
  await api.uploadMedia(file, { usage: 'team', entityType: 'team' });
  await api.replaceMedia(first.id, file, { usage: 'team', entityType: 'team' });
  await api.deleteMedia(first.id);
  const upload = calls.find(call => call.body.action === 'uploadMedia').body;
  const replace = calls.find(call => call.body.action === 'replaceMedia').body;
  const remove = calls.find(call => call.body.action === 'deleteMedia').body;
  assert.match(upload.idempotencyKey, /^[a-f0-9]{48}$/);
  assert.equal(upload.payload.base64Data, file.base64);
  assert.equal(replace.expectedUpdatedAt, t1);
  assert.equal(remove.expectedUpdatedAt, t2);
  assert.match(remove.idempotencyKey, /^[a-f0-9]{48}$/);
  assert.equal('idToken' in upload, true);
});

test('media provider rejects unsupported and oversized files before HTTP', async () => {
  const { api, calls } = makeContext(() => { throw new Error('must not call'); });
  await assert.rejects(() => api.uploadMedia({ name: 'x.svg', type: 'image/svg+xml', size: 10 }, { usage: 'team' }), error => error.code === 'UNSUPPORTED_MEDIA_TYPE');
  await assert.rejects(() => api.uploadMedia({ name: 'x.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }, { usage: 'team' }), error => error.code === 'MEDIA_TOO_LARGE');
  assert.equal(calls.length, 0);
});

test('large media is resized and converted to WebP before upload', async () => {
  const { api, window } = makeContext(() => envelope({ id: 'media-1' }));
  let closed = false;
  let canvas;
  window.createImageBitmap = async () => ({ width: 4000, height: 3000, close() { closed = true; } });
  window.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: callback => callback({ size: 320000 }) };
      return canvas;
    }
  };
  window.File = class {
    constructor(parts, name, options) { this.size = parts[0].size; this.name = name; this.type = options.type; this.lastModified = options.lastModified; }
  };
  const optimized = await api._test.optimizeImageFile({ name: 'portrait.jpg', type: 'image/jpeg', size: 4_300_000 }, 'team');
  assert.equal(optimized.name, 'portrait.webp');
  assert.equal(optimized.type, 'image/webp');
  assert.equal(optimized.size, 320000);
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 900);
  assert.equal(closed, true);
});

test('uncertain media upload retry reuses its idempotency key', async () => {
  let attempts = 0;
  const { api, calls } = makeContext(request => {
    if (request.body.action !== 'uploadMedia') throw new Error('unexpected action');
    attempts += 1;
    if (attempts === 1) return new Error('connection lost');
    return envelope({ id: 'media-1', status: 'active', updatedAt: '2026-08-09T10:00:00.000Z' });
  });
  const file = { name: 'portrait.png', type: 'image/png', size: 4, base64: 'iVBORw==' };
  await assert.rejects(() => api.uploadMedia(file, { usage: 'team', entityType: 'team' }));
  await api.uploadMedia(file, { usage: 'team', entityType: 'team' });
  assert.equal(calls[0].body.idempotencyKey, calls[1].body.idempotencyKey);
});

test('stale media replacement reloads metadata and requires review', async () => {
  const old = { id: 'media-1', status: 'active', updatedAt: '2026-08-09T10:00:00.000Z' };
  const latest = { ...old, updatedAt: '2026-08-09T10:02:00.000Z' };
  let lists = 0;
  const { api } = makeContext(request => {
    if (request.body.action === 'listMedia') return envelope(lists++ ? [latest] : [old]);
    if (request.body.action === 'replaceMedia') return failure('CONFLICT');
    throw new Error('unexpected action');
  });
  const file = { name: 'portrait.png', type: 'image/png', size: 4, base64: 'iVBORw==' };
  await api.listMedia();
  await assert.rejects(() => api.replaceMedia(old.id, file, { usage: 'team', entityType: 'team' }), error => error.code === 'CONFLICT' && error.requiresReview && error.latestData[0].updatedAt === latest.updatedAt);
});

test('uncertain media delete retry keeps the same destructive request key', async () => {
  const active = { id: 'media-1', status: 'active', updatedAt: '2026-08-09T10:00:00.000Z' };
  let deletes = 0;
  const { api, calls } = makeContext(request => {
    if (request.body.action === 'listMedia') return envelope([active]);
    if (request.body.action === 'deleteMedia') {
      deletes += 1;
      if (deletes === 1) return new Error('connection lost');
      return envelope({ ...active, status: 'deleted', publicUrl: '', updatedAt: '2026-08-09T10:01:00.000Z' });
    }
    throw new Error('unexpected action');
  });
  await api.listMedia();
  await assert.rejects(() => api.deleteMedia(active.id));
  await api.deleteMedia(active.id);
  const requests = calls.filter(call => call.body?.action === 'deleteMedia');
  assert.equal(requests[0].body.idempotencyKey, requests[1].body.idempotencyKey);
  assert.equal(requests[0].body.expectedUpdatedAt, active.updatedAt);
});
