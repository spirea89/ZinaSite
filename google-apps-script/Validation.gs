const API_VERSION = 'v1';
const VALID_STATUSES = Object.freeze(['draft', 'published']);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function apiError_(code, message) {
  const error = new Error(message);
  error.apiCode = code;
  return error;
}

function successEnvelope_(data) {
  return { ok: true, data: data, error: null, version: API_VERSION };
}

function failureEnvelope_(error) {
  const code = error && error.apiCode ? error.apiCode : 'INTERNAL_ERROR';
  const privateCodes = ['INTERNAL_ERROR', 'INTERNAL_CONFIGURATION'];
  const message = privateCodes.indexOf(code) !== -1 ? 'The backend is not configured correctly.' : error && error.apiCode ? error.message : 'The request could not be completed.';
  return {
    ok: false,
    data: null,
    error: { code: code, message: message },
    version: API_VERSION
  };
}

function assertObject_(value, name) {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') throw apiError_('INVALID_PAYLOAD', name + ' must be an object.');
  return value;
}

function rejectUnknownFields_(object, allowed) {
  Object.keys(object).forEach(function (key) {
    if (allowed.indexOf(key) === -1) throw apiError_('UNKNOWN_FIELD', 'Unknown field: ' + key + '.');
  });
}

function stringValue_(value, name, options) {
  const config = options || {};
  if (value === null || value === undefined || value === '') {
    if (config.required) throw apiError_('VALIDATION_ERROR', name + ' is required.');
    return '';
  }
  if (typeof value !== 'string') throw apiError_('VALIDATION_ERROR', name + ' must be text.');
  const result = config.preserveWhitespace ? value : value.trim();
  if (config.required && !result) throw apiError_('VALIDATION_ERROR', name + ' is required.');
  if (result.length > (config.max || 10000)) throw apiError_('VALIDATION_ERROR', name + ' is too long.');
  return result;
}

function idValue_(value, name, required) {
  const result = stringValue_(value, name, { required: required, max: 36 });
  if (result && !ID_PATTERN.test(result)) throw apiError_('INVALID_ID', name + ' must be a UUID.');
  return result;
}

function statusValue_(value) {
  if (VALID_STATUSES.indexOf(value) === -1) throw apiError_('INVALID_STATUS', 'status must be draft or published.');
  return value;
}

function urlValue_(value, name) {
  const result = stringValue_(value, name, { max: 2048 });
  if (!result) return '';
  if (/[<>"'\u0000-\u001F\u007F]/.test(result) || !/^https:\/\/(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?::\d{1,5})?(?:[/?#][^\s]*)?$/.test(result)) throw apiError_('INVALID_URL', name + ' must be a valid HTTPS URL.');
  return result;
}

function dateValue_(value, name, required) {
  const result = stringValue_(value, name, { required: required, max: 40 });
  if (!result) return '';
  const date = new Date(result);
  if (isNaN(date.getTime())) throw apiError_('INVALID_DATE', name + ' must be a valid date.');
  return date.toISOString();
}

function expectedUpdatedAtValue_(value, allowNull) {
  if (allowNull && value === null) return null;
  if (value === undefined || value === null || value === '') throw apiError_('INVALID_CONCURRENCY_VALUE', 'expectedUpdatedAt is required.');
  const result = stringValue_(value, 'expectedUpdatedAt', { required: true, max: 30 });
  const date = new Date(result);
  if (isNaN(date.getTime()) || date.toISOString() !== result) throw apiError_('INVALID_CONCURRENCY_VALUE', 'expectedUpdatedAt must be an exact UTC ISO timestamp.');
  return result;
}

function idempotencyKeyValue_(value) {
  if (value === undefined || value === null || value === '') throw apiError_('INVALID_IDEMPOTENCY_KEY', 'idempotencyKey is required.');
  const result = stringValue_(value, 'idempotencyKey', { required: true, max: 128 });
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(result)) throw apiError_('INVALID_IDEMPOTENCY_KEY', 'idempotencyKey must contain 16 to 128 URL-safe characters.');
  return result;
}

function plainTextValue_(value, name, options) {
  const result = stringValue_(value, name, options);
  if (/[<>]/.test(result) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(result)) {
    throw apiError_('UNSAFE_CONTENT', name + ' contains unsafe characters.');
  }
  return result;
}

const SAFE_HTML_TAGS = Object.freeze(['p','br','strong','b','em','i','u','s','ol','ul','li','blockquote','h1','h2','h3','a','span']);
const SAFE_HTML_CLASSES = /^(?:ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|size-(?:small|large|huge)))(?:\s+ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|size-(?:small|large|huge)))*$/;

function safeRichHtmlValue_(value, name, options) {
  const html = stringValue_(value, name, options);
  if (!html) return '';
  if (/<!--[\s\S]*?-->|<![^>]*>|<\?|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(html)) throw apiError_('UNSAFE_HTML', name + ' contains unsafe HTML.');
  const stack = [];
  let cursor = 0;
  const tagPattern = /<[^>]*>/g;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    if (html.slice(cursor, match.index).indexOf('<') !== -1) throw apiError_('UNSAFE_HTML', name + ' contains malformed HTML.');
    const token = match[0];
    const parsed = token.match(/^<\s*(\/?)\s*([A-Za-z0-9]+)([\s\S]*?)\s*(\/?)>$/);
    if (!parsed) throw apiError_('UNSAFE_HTML', name + ' contains malformed HTML.');
    const closing = parsed[1] === '/';
    const tag = parsed[2].toLowerCase();
    const attributes = parsed[3];
    const selfClosing = parsed[4] === '/' || tag === 'br';
    if (SAFE_HTML_TAGS.indexOf(tag) === -1) throw apiError_('UNSAFE_HTML', name + ' contains a disallowed HTML element.');
    if (closing) {
      if (attributes.trim() || selfClosing || stack.pop() !== tag) throw apiError_('UNSAFE_HTML', name + ' contains malformed HTML nesting.');
    } else {
      validateSafeHtmlAttributes_(tag, attributes, name);
      if (!selfClosing) stack.push(tag);
    }
    cursor = tagPattern.lastIndex;
  }
  if (html.slice(cursor).indexOf('<') !== -1 || stack.length) throw apiError_('UNSAFE_HTML', name + ' contains malformed HTML.');
  return html;
}

function validateSafeHtmlAttributes_(tag, source, name) {
  let rest = source;
  const seen = {};
  const attributePattern = /^\s+([A-Za-z][A-Za-z0-9_-]*)\s*=\s*("[^"]*"|'[^']*')/;
  while (rest) {
    if (!rest.trim()) return;
    const match = rest.match(attributePattern);
    if (!match) throw apiError_('UNSAFE_HTML', name + ' contains a disallowed HTML attribute.');
    const attribute = match[1].toLowerCase();
    const rawValue = match[2].slice(1, -1);
    if (seen[attribute]) throw apiError_('UNSAFE_HTML', name + ' contains duplicate HTML attributes.');
    seen[attribute] = true;
    if (attribute === 'class') {
      if (tag !== 'p' && tag !== 'span') throw apiError_('UNSAFE_HTML', name + ' contains a disallowed class attribute.');
      if (!SAFE_HTML_CLASSES.test(rawValue)) throw apiError_('UNSAFE_HTML', name + ' contains a disallowed class name.');
    } else if (attribute === 'href') {
      if (tag !== 'a') throw apiError_('UNSAFE_HTML', name + ' contains a disallowed link attribute.');
      urlValue_(rawValue, name + '.href');
    } else if (attribute === 'target') {
      if (tag !== 'a' || rawValue !== '_blank') throw apiError_('UNSAFE_HTML', name + ' contains a disallowed link target.');
    } else if (attribute === 'rel') {
      if (tag !== 'a' || !/^(?:noopener noreferrer|noreferrer noopener)$/.test(rawValue)) throw apiError_('UNSAFE_HTML', name + ' contains a disallowed link relationship.');
    } else {
      throw apiError_('UNSAFE_HTML', name + ' contains a disallowed HTML attribute.');
    }
    rest = rest.slice(match[0].length);
  }
}

function numberValue_(value, name, min, max) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') throw apiError_('VALIDATION_ERROR', name + ' must be a number.');
  const number = Number(value);
  if (!isFinite(number) || number < min || number > max) throw apiError_('VALIDATION_ERROR', name + ' is outside the allowed range.');
  return number;
}

function pagination_(parameters) {
  const rawPage = parameters.page === undefined ? '1' : String(parameters.page);
  const rawLimit = parameters.limit === undefined ? '20' : String(parameters.limit);
  if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawLimit)) throw apiError_('INVALID_PAGINATION', 'page and limit must be positive integers.');
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (page < 1 || limit < 1 || limit > 100) throw apiError_('INVALID_PAGINATION', 'page must be at least 1 and limit must be between 1 and 100.');
  return { page: page, limit: limit };
}

function validateArticle_(input, partial) {
  const value = assertObject_(input, 'payload');
  const allowed = ['title', 'content', 'titleEn', 'contentEn', 'titleDe', 'contentDe', 'categoryId', 'status'];
  rejectUnknownFields_(value, allowed);
  const output = {};
  function include(key, fn) { if (!partial || Object.prototype.hasOwnProperty.call(value, key)) output[key] = fn(value[key]); }
  include('title', function (v) { return plainTextValue_(v, 'title', { required: true, max: 500 }); });
  include('content', function (v) { return safeRichHtmlValue_(v, 'content', { required: true, max: 200000, preserveWhitespace: true }); });
  include('titleEn', function (v) { return plainTextValue_(v, 'titleEn', { max: 500 }); });
  include('contentEn', function (v) { return safeRichHtmlValue_(v, 'contentEn', { max: 200000, preserveWhitespace: true }); });
  include('titleDe', function (v) { return plainTextValue_(v, 'titleDe', { max: 500 }); });
  include('contentDe', function (v) { return safeRichHtmlValue_(v, 'contentDe', { max: 200000, preserveWhitespace: true }); });
  include('categoryId', function (v) { return v ? idValue_(v, 'categoryId', true) : ''; });
  include('status', statusValue_);
  if (partial && !Object.keys(output).length) throw apiError_('VALIDATION_ERROR', 'At least one article field is required.');
  return output;
}

function validateCategory_(input, partial) {
  const value = assertObject_(input, 'payload');
  rejectUnknownFields_(value, ['slug', 'nameRo', 'nameEn', 'nameDe']);
  const output = {};
  ['slug', 'nameRo', 'nameEn', 'nameDe'].forEach(function (key) {
    if (!partial || Object.prototype.hasOwnProperty.call(value, key)) output[key] = plainTextValue_(value[key], key, { required: true, max: key === 'slug' ? 120 : 300 });
  });
  if (output.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(output.slug)) throw apiError_('VALIDATION_ERROR', 'slug must contain lowercase letters, numbers and single hyphens only.');
  if (partial && !Object.keys(output).length) throw apiError_('VALIDATION_ERROR', 'At least one category field is required.');
  return output;
}

function validateEvent_(input, partial) {
  const value = assertObject_(input, 'payload');
  const allowed = ['title', 'description', 'titleEn', 'descriptionEn', 'titleDe', 'descriptionDe', 'startDate', 'endDate', 'location', 'registrationUrl', 'status'];
  rejectUnknownFields_(value, allowed);
  const output = {};
  function include(key, fn) { if (!partial || Object.prototype.hasOwnProperty.call(value, key)) output[key] = fn(value[key]); }
  include('title', function (v) { return plainTextValue_(v, 'title', { required: true, max: 500 }); });
  ['description', 'descriptionEn', 'descriptionDe'].forEach(function (key) { include(key, function (v) { return safeRichHtmlValue_(v, key, { max: 30000, preserveWhitespace: true }); }); });
  ['titleEn', 'titleDe'].forEach(function (key) { include(key, function (v) { return plainTextValue_(v, key, { max: 500 }); }); });
  include('startDate', function (v) { return dateValue_(v, 'startDate', true); });
  include('endDate', function (v) { return dateValue_(v, 'endDate', false); });
  include('location', function (v) { return plainTextValue_(v, 'location', { max: 1000 }); });
  include('registrationUrl', function (v) { return urlValue_(v, 'registrationUrl'); });
  include('status', statusValue_);
  if (output.startDate && output.endDate && new Date(output.endDate) < new Date(output.startDate)) throw apiError_('INVALID_DATE', 'endDate cannot be before startDate.');
  if (partial && !Object.keys(output).length) throw apiError_('VALIDATION_ERROR', 'At least one event field is required.');
  return output;
}

function validateTeamMember_(input, partial) {
  const value = assertObject_(input, 'payload');
  const allowed = ['name', 'roleEn', 'roleRo', 'roleDe', 'bioEn', 'bioRo', 'bioDe', 'imageUrl', 'driveFileId', 'sortOrder'];
  rejectUnknownFields_(value, allowed);
  const output = {};
  function include(key, fn) { if (!partial || Object.prototype.hasOwnProperty.call(value, key)) output[key] = fn(value[key]); }
  include('name', function (v) { return plainTextValue_(v, 'name', { required: true, max: 300 }); });
  include('roleEn', function (v) { return plainTextValue_(v, 'roleEn', { required: true, max: 500 }); });
  ['roleRo', 'roleDe'].forEach(function (key) { include(key, function (v) { return plainTextValue_(v, key, { max: 500 }); }); });
  include('bioEn', function (v) { return plainTextValue_(v, 'bioEn', { required: true, max: 30000, preserveWhitespace: true }); });
  ['bioRo', 'bioDe'].forEach(function (key) { include(key, function (v) { return plainTextValue_(v, key, { max: 30000, preserveWhitespace: true }); }); });
  include('imageUrl', function (v) { return urlValue_(v, 'imageUrl'); });
  include('driveFileId', function (v) { return plainTextValue_(v, 'driveFileId', { max: 200 }); });
  include('sortOrder', function (v) { return numberValue_(v, 'sortOrder', -100000, 100000); });
  if (partial && !Object.keys(output).length) throw apiError_('VALIDATION_ERROR', 'At least one team member field is required.');
  return output;
}

function validateHomepage_(input) {
  const value = assertObject_(input, 'payload');
  rejectUnknownFields_(value, ['content', 'heroImageUrl', 'heroDriveFileId', 'heroImagePosition']);
  const content = assertObject_(value.content, 'content');
  const sanitizedContent = validateHomepageContentNode_(content, 'content', 0);
  if (Object.prototype.hasOwnProperty.call(sanitizedContent, 'contacts')) {
    sanitizedContent.contacts = validateHomepageContacts_(sanitizedContent.contacts);
  }
  if (Object.prototype.hasOwnProperty.call(sanitizedContent, 'languageSettings')) {
    sanitizedContent.languageSettings = validateLanguageSettings_(sanitizedContent.languageSettings);
  }
  const serialized = JSON.stringify(sanitizedContent);
  if (serialized.length > 200000) throw apiError_('VALIDATION_ERROR', 'content is too large.');
  const position = assertObject_(value.heroImagePosition, 'heroImagePosition');
  rejectUnknownFields_(position, ['x', 'y']);
  return {
    content: serialized,
    heroImageUrl: urlValue_(value.heroImageUrl, 'heroImageUrl'),
    heroDriveFileId: plainTextValue_(value.heroDriveFileId, 'heroDriveFileId', { max: 200 }),
    heroImagePositionX: numberValue_(position.x, 'heroImagePosition.x', 0, 100),
    heroImagePositionY: numberValue_(position.y, 'heroImagePosition.y', 0, 100)
  };
}

function validateLanguageSettings_(input) {
  const value = assertObject_(input, 'content.languageSettings');
  rejectUnknownFields_(value, ['ro', 'de', 'en']);
  if (value.ro !== true) throw apiError_('VALIDATION_ERROR', 'Romanian must remain enabled.');
  if (typeof value.de !== 'boolean' || typeof value.en !== 'boolean') throw apiError_('VALIDATION_ERROR', 'Language settings must be boolean values.');
  return { ro: true, de: value.de, en: value.en };
}

function validateHomepageContacts_(input) {
  const value = assertObject_(input, 'content.contacts');
  rejectUnknownFields_(value, ['email', 'whatsappUrl', 'facebookUrl', 'linkedinUrl', 'zvrNumber']);
  const email = plainTextValue_(value.email, 'content.contacts.email', { max: 320 });
  if (email && !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email)) {
    throw apiError_('VALIDATION_ERROR', 'content.contacts.email must be a valid email address.');
  }
  const whatsappUrl = urlValue_(value.whatsappUrl, 'content.contacts.whatsappUrl');
  const facebookUrl = urlValue_(value.facebookUrl, 'content.contacts.facebookUrl');
  const linkedinUrl = urlValue_(value.linkedinUrl, 'content.contacts.linkedinUrl');
  const zvrNumber = plainTextValue_(value.zvrNumber, 'content.contacts.zvrNumber', { max: 10 });
  if (whatsappUrl && !/^https:\/\/(?:(?:chat\.whatsapp\.com\/[A-Za-z0-9_-]+)|(?:(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]+))(?:[/?#][^\s]*)?$/.test(whatsappUrl)) throw apiError_('INVALID_URL', 'content.contacts.whatsappUrl must be a WhatsApp group or channel URL.');
  if (facebookUrl && !/^https:\/\/(?:www\.)?facebook\.com\/(?:[^\s]+)$/.test(facebookUrl)) throw apiError_('INVALID_URL', 'content.contacts.facebookUrl must be a Facebook URL.');
  if (linkedinUrl && !/^https:\/\/(?:www\.)?linkedin\.com\/(?:[^\s]+)$/.test(linkedinUrl)) throw apiError_('INVALID_URL', 'content.contacts.linkedinUrl must be a LinkedIn URL.');
  if (zvrNumber && !/^[0-9]{1,10}$/.test(zvrNumber)) throw apiError_('VALIDATION_ERROR', 'content.contacts.zvrNumber must contain 1 to 10 digits.');
  return { email: email, whatsappUrl: whatsappUrl, facebookUrl: facebookUrl, linkedinUrl: linkedinUrl, zvrNumber: zvrNumber };
}

function validateHomepageContentNode_(value, name, depth) {
  if (depth > 8) throw apiError_('VALIDATION_ERROR', 'content is nested too deeply.');
  if (typeof value === 'string') return plainTextValue_(value, name, { max: 30000, preserveWhitespace: true });
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!isFinite(value)) throw apiError_('VALIDATION_ERROR', name + ' contains an invalid number.');
    return value;
  }
  if (Array.isArray(value)) return value.map(function (item, index) { return validateHomepageContentNode_(item, name + '[' + index + ']', depth + 1); });
  if (Object.prototype.toString.call(value) !== '[object Object]') throw apiError_('VALIDATION_ERROR', name + ' contains an unsupported value.');
  const output = {};
  Object.keys(value).forEach(function (key) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') throw apiError_('VALIDATION_ERROR', 'content contains an invalid field name.');
    output[key] = validateHomepageContentNode_(value[key], name + '.' + key, depth + 1);
  });
  return output;
}

function safePlainCell_(value) {
  if (typeof value !== 'string') return value;
  return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? "'" + value : value;
}
