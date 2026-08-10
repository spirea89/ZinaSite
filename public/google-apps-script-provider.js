(function (root) {
  'use strict';

  const API_VERSION = 'v1';
  const records = {
    articles: new Map(), categories: new Map(), events: new Map(), team: new Map(), media: new Map()
  };
  let homepage = null;
  const uncertainOperations = new Map();

  class ZinaApiError extends Error {
    constructor(code, message, options = {}) {
      super(message);
      this.name = 'ZinaApiError';
      this.code = code;
      this.latestData = options.latestData;
      this.requiresReview = Boolean(options.requiresReview);
    }
  }

  function config() {
    const value = root.ZinaConfig.get();
    if (!value.publicAppsScriptApiUrl || !value.protectedAppsScriptApiUrl || !value.googleOAuthClientId) {
      throw new ZinaApiError('CONFIGURATION_ERROR', 'The Google CMS test backend is not configured.');
    }
    return value;
  }

  function newIdempotencyKey() {
    if (!root.crypto?.getRandomValues) throw new ZinaApiError('SECURE_RANDOM_UNAVAILABLE', 'Secure request identifiers are unavailable.');
    const bytes = new Uint8Array(24);
    root.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function canonical(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }

  function operationKey(action, id, payload) {
    return `${action}:${id || ''}:${canonical(payload || null)}`;
  }

  function cache(list, map) {
    map.clear();
    (list || []).forEach(item => map.set(item.id, item));
    return list || [];
  }

  function normalizeCategory(item) {
    return item ? {
      id: item.id,
      slug: item.slug,
      name_ro: item.name_ro ?? item.nameRo ?? '',
      name_en: item.name_en ?? item.nameEn ?? '',
      name_de: item.name_de ?? item.nameDe ?? '',
      created_at: item.created_at ?? item.createdAt,
      updated_at: item.updated_at ?? item.updatedAt
    } : item;
  }

  async function readEnvelope(response) {
    let envelope;
    try { envelope = await response.json(); } catch (_) { throw new ZinaApiError('INVALID_RESPONSE', 'The CMS returned an invalid response.'); }
    if (!envelope || envelope.version !== API_VERSION || typeof envelope.ok !== 'boolean' || !('data' in envelope) || !('error' in envelope)) {
      throw new ZinaApiError('INVALID_RESPONSE', 'The CMS returned an invalid response.');
    }
    return envelope;
  }

  async function publicCall(action, parameters = {}) {
    const url = new URL(config().publicAppsScriptApiUrl);
    url.searchParams.set('action', action);
    Object.entries(parameters).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, String(value)));
    const envelope = await readEnvelope(await fetch(url.toString(), { method: 'GET', cache: 'no-store', referrerPolicy: 'no-referrer' }));
    if (!envelope.ok) throw new ZinaApiError(envelope.error?.code || 'REQUEST_FAILED', envelope.error?.message || 'The CMS request failed.');
    return envelope.data;
  }

  async function refreshFor(action) {
    if (/ArticleCategory/.test(action)) return api.getCategories(true);
    if (/Article/.test(action)) return api.getAllArticles();
    if (/Event/.test(action)) return api.getAllEvents();
    if (/TeamMember/.test(action)) return api.getTeamMembers(true);
    if (/Homepage/.test(action)) return api.getHomepageContent(true);
    if (/Media/.test(action)) return api.listMedia();
    return null;
  }

  async function protectedCall(action, fields = {}, operation) {
    const idToken = await root.AuthService.getIdToken();
    let envelope;
    try {
      envelope = await readEnvelope(await fetch(config().protectedAppsScriptApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, idToken, ...fields }),
        redirect: 'follow',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      }));
    } catch (error) {
      if (operation) uncertainOperations.set(operation.key, operation);
      throw error;
    }
    if (envelope.ok) {
      if (operation) uncertainOperations.delete(operation.key);
      return envelope.data;
    }
    const code = envelope.error?.code || 'REQUEST_FAILED';
    if (code === 'AUTHENTICATION_FAILED' || code === 'FORBIDDEN') {
      root.AuthService.handleRejectedToken(code);
      throw new ZinaApiError(code, code === 'FORBIDDEN' ? 'Administrator access is not authorized.' : 'Google authentication expired or was rejected. Sign in again.');
    }
    if (code === 'CONFLICT') {
      const latestData = await refreshFor(action);
      throw new ZinaApiError(code, 'This content changed after you loaded it. The latest version has been reloaded; review it before saving again.', { latestData, requiresReview: true });
    }
    if (code === 'WRITE_STATE_UNCERTAIN') {
      if (operation) uncertainOperations.set(operation.key, operation);
      const latestData = await refreshFor(action);
      throw new ZinaApiError(code, 'The write may have completed. Current data was reloaded; review it before retrying.', { latestData, requiresReview: true });
    }
    if (operation && code !== 'WRITE_LOCK_TIMEOUT') uncertainOperations.delete(operation.key);
    throw new ZinaApiError(code, envelope.error?.message || 'The CMS request failed.');
  }

  function timestamp(map, id, field = 'updatedAt') {
    const record = map.get(id);
    const value = record?.[field];
    if (!value) throw new ZinaApiError('STALE_LOCAL_STATE', 'Reload this record before changing it.');
    return value;
  }

  function operation(action, id, payload) {
    const key = operationKey(action, id, payload);
    return uncertainOperations.get(key) || { key, idempotencyKey: newIdempotencyKey() };
  }

  function readFileAsBase64(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject(new ZinaApiError('UNSUPPORTED_MEDIA_TYPE', 'Choose a JPEG, PNG, or WebP image.'));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new ZinaApiError('MEDIA_TOO_LARGE', 'Image must not exceed 5 MB.'));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new ZinaApiError('MALFORMED_MEDIA', 'The selected image could not be read.'));
      reader.onload = () => {
        const result = String(reader.result || '');
        const separator = result.indexOf(',');
        if (separator < 0) reject(new ZinaApiError('MALFORMED_MEDIA', 'The selected image could not be read.'));
        else resolve(result.slice(separator + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  async function optimizeImageFile(file, usage) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ZinaApiError('UNSUPPORTED_MEDIA_TYPE', 'Choose a JPEG, PNG, or WebP image.');
    if (file.size > 5 * 1024 * 1024) throw new ZinaApiError('MEDIA_TOO_LARGE', 'Image must not exceed 5 MB.');
    const targetBytes = 900 * 1024;
    if (file.size <= targetBytes) return file;
    if (!root.createImageBitmap || !root.document?.createElement || !root.File) return file;
    let bitmap;
    try {
      bitmap = await root.createImageBitmap(file);
      const maxDimension = usage === 'team' ? 1200 : 1920;
      const initialScale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      let width = Math.max(1, Math.round(bitmap.width * initialScale));
      let height = Math.max(1, Math.round(bitmap.height * initialScale));
      const canvas = root.document.createElement('canvas');
      const qualities = [0.82, 0.74, 0.66, 0.58];
      let blob = null;
      for (const quality of qualities) {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) return file;
        context.drawImage(bitmap, 0, 0, width, height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) return file;
        if (blob.size <= targetBytes) break;
        width = Math.max(1, Math.round(width * 0.85));
        height = Math.max(1, Math.round(height * 0.85));
      }
      if (!blob || blob.size >= file.size) return file;
      const outputTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      const outputType = String(blob.type || '').toLowerCase();
      const outputExtension = outputTypes[outputType];
      if (!outputExtension) return file;
      const baseName = String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
      return new root.File([blob], `${baseName}.${outputExtension}`, { type: outputType, lastModified: Date.now() });
    } catch (_) {
      return file;
    } finally {
      if (bitmap?.close) bitmap.close();
    }
  }

  async function mediaPayload(file, options = {}) {
    const optimized = await optimizeImageFile(file, options.usage);
    return { payload: { usage: options.usage, entityType: options.entityType || options.usage, entityId: options.entityId || '', originalFilename: optimized.name, declaredMimeType: optimized.type, base64Data: await readFileAsBase64(optimized), altTextRo: options.altTextRo || '', altTextEn: options.altTextEn || '', altTextDe: options.altTextDe || '' }, size: optimized.size };
  }

  const api = {
    ensureConfigured: config,
    async getArticlesPage(page = 1, limit = 9) { return publicCall('listPublishedArticles', { page, limit }); },
    async getArticles() { return (await this.getArticlesPage(1, 100)).items; },
    async getAllArticles() { return cache(await protectedCall('listAllArticles'), records.articles); },
    async createArticle(payload) { const op = operation('createArticle', '', payload); const value = await protectedCall('createArticle', { payload, idempotencyKey: op.idempotencyKey }, op); records.articles.set(value.id, value); return value; },
    async updateArticle(id, payload) { const value = await protectedCall('updateArticle', { id, payload, expectedUpdatedAt: timestamp(records.articles, id) }); records.articles.set(id, value); return value; },
    async setArticleStatus(id, status) { const value = await protectedCall('setArticleStatus', { id, payload: { status }, expectedUpdatedAt: timestamp(records.articles, id) }); records.articles.set(id, value); return value; },
    async deleteArticle(id) { const payload = { expectedUpdatedAt: timestamp(records.articles, id) }; const op = operation('deleteArticle', id, payload); const value = await protectedCall('deleteArticle', { id, expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: op.idempotencyKey }, op); records.articles.delete(id); return value; },
    async getEventsPage(page = 1, limit = 9) { return publicCall('listPublishedEvents', { page, limit }); },
    async getEvents() { return (await this.getEventsPage(1, 100)).items; },
    async getAllEvents() { return cache(await protectedCall('listAllEvents'), records.events); },
    async createEvent(payload) { const op = operation('createEvent', '', payload); const value = await protectedCall('createEvent', { payload, idempotencyKey: op.idempotencyKey }, op); records.events.set(value.id, value); return value; },
    async updateEvent(id, payload) { const value = await protectedCall('updateEvent', { id, payload, expectedUpdatedAt: timestamp(records.events, id) }); records.events.set(id, value); return value; },
    async setEventStatus(id, status) { const value = await protectedCall('setEventStatus', { id, payload: { status }, expectedUpdatedAt: timestamp(records.events, id) }); records.events.set(id, value); return value; },
    async deleteEvent(id) { const payload = { expectedUpdatedAt: timestamp(records.events, id) }; const op = operation('deleteEvent', id, payload); const value = await protectedCall('deleteEvent', { id, expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: op.idempotencyKey }, op); records.events.delete(id); return value; },
    async getCategories(admin = false) { const items = admin ? await protectedCall('listArticleCategories') : (await publicCall('listArticleCategories', { page: 1, limit: 100 })).items; return cache(items.map(normalizeCategory), records.categories); },
    async createCategory(payload) { const valuePayload = { slug: payload.slug || payload.nameRo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), nameRo: payload.nameRo, nameEn: payload.nameEn || payload.nameRo, nameDe: payload.nameDe || payload.nameRo }; const op = operation('createArticleCategory', '', valuePayload); const value = normalizeCategory(await protectedCall('createArticleCategory', { payload: valuePayload, idempotencyKey: op.idempotencyKey }, op)); records.categories.set(value.id, value); return value; },
    async updateCategory(id, payload) { const valuePayload = { nameRo: payload.nameRo, nameEn: payload.nameEn || payload.nameRo, nameDe: payload.nameDe || payload.nameRo }; const value = normalizeCategory(await protectedCall('updateArticleCategory', { id, payload: valuePayload, expectedUpdatedAt: timestamp(records.categories, id, 'updated_at') })); records.categories.set(id, value); return value; },
    async deleteCategory(id) { const payload = { expectedUpdatedAt: timestamp(records.categories, id, 'updated_at') }; const op = operation('deleteArticleCategory', id, payload); const value = await protectedCall('deleteArticleCategory', { id, expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: op.idempotencyKey }, op); records.categories.delete(id); return value; },
    async getTeamMembers(admin = false) { const items = admin ? await protectedCall('listTeamMembers') : (await publicCall('listPublishedTeamMembers', { page: 1, limit: 100 })).items; return cache(items, records.team); },
    async createTeamMember(payload) { const op = operation('createTeamMember', '', payload); const value = await protectedCall('createTeamMember', { payload, idempotencyKey: op.idempotencyKey }, op); records.team.set(value.id, value); return value; },
    async updateTeamMember(id, payload) { const value = await protectedCall('updateTeamMember', { id, payload, expectedUpdatedAt: timestamp(records.team, id) }); records.team.set(id, value); return value; },
    async updateTeamMemberSortOrder(id, sortOrder) { const value = await protectedCall('updateTeamMemberSortOrder', { id, payload: { sortOrder }, expectedUpdatedAt: timestamp(records.team, id) }); records.team.set(id, value); return value; },
    async deleteTeamMember(id) { const payload = { expectedUpdatedAt: timestamp(records.team, id) }; const op = operation('deleteTeamMember', id, payload); const value = await protectedCall('deleteTeamMember', { id, expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: op.idempotencyKey }, op); records.team.delete(id); return value; },
    async getHomepageContent(admin = false) { homepage = admin ? await protectedCall('getHomepageContent') : await publicCall('getPublishedHomepageContent'); return homepage; },
    async updateHomepageContent(content, heroImageUrl, heroImagePosition) { const payload = { content, heroImageUrl: heroImageUrl || '', heroDriveFileId: homepage?.heroDriveFileId || '', heroImagePosition }; const value = await protectedCall('updateHomepageContent', { payload, expectedUpdatedAt: homepage?.updatedAt ?? null }); homepage = value; return value; },
    async listMedia() { return cache(await protectedCall('listMedia'), records.media); },
    async uploadMedia(file, options) { const prepared = await mediaPayload(file, options), payload = prepared.payload; const op = operation('uploadMedia', '', { usage: payload.usage, entityType: payload.entityType, entityId: payload.entityId, originalFilename: payload.originalFilename, declaredMimeType: payload.declaredMimeType, size: prepared.size }); const value = await protectedCall('uploadMedia', { payload, idempotencyKey: op.idempotencyKey }, op); records.media.set(value.id, value); return value; },
    async replaceMedia(id, file, options) { const prepared = await mediaPayload(file, options), payload = prepared.payload; const value = await protectedCall('replaceMedia', { id, payload, expectedUpdatedAt: timestamp(records.media, id) }); records.media.set(id, value); return value; },
    async deleteMedia(id) { const payload = { expectedUpdatedAt: timestamp(records.media, id) }; const op = operation('deleteMedia', id, payload); const value = await protectedCall('deleteMedia', { id, expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: op.idempotencyKey }, op); records.media.set(id, value); return value; },
    _test: { newIdempotencyKey, canonical, records, uncertainOperations, ZinaApiError, readFileAsBase64, optimizeImageFile }
  };

  root.GoogleAppsScriptProvider = Object.freeze(api);
  root.ZinaApiError = ZinaApiError;
})(window);
