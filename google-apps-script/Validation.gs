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
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/.test(result)) throw apiError_('INVALID_URL', name + ' must be a valid HTTPS URL.');
  return result;
}

function dateValue_(value, name, required) {
  const result = stringValue_(value, name, { required: required, max: 40 });
  if (!result) return '';
  const date = new Date(result);
  if (isNaN(date.getTime())) throw apiError_('INVALID_DATE', name + ' must be a valid date.');
  return date.toISOString();
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
  include('title', function (v) { return stringValue_(v, 'title', { required: true, max: 500 }); });
  include('content', function (v) { return stringValue_(v, 'content', { required: true, max: 200000, preserveWhitespace: true }); });
  include('titleEn', function (v) { return stringValue_(v, 'titleEn', { max: 500 }); });
  include('contentEn', function (v) { return stringValue_(v, 'contentEn', { max: 200000, preserveWhitespace: true }); });
  include('titleDe', function (v) { return stringValue_(v, 'titleDe', { max: 500 }); });
  include('contentDe', function (v) { return stringValue_(v, 'contentDe', { max: 200000, preserveWhitespace: true }); });
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
    if (!partial || Object.prototype.hasOwnProperty.call(value, key)) output[key] = stringValue_(value[key], key, { required: true, max: key === 'slug' ? 120 : 300 });
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
  include('title', function (v) { return stringValue_(v, 'title', { required: true, max: 500 }); });
  ['description', 'descriptionEn', 'descriptionDe'].forEach(function (key) { include(key, function (v) { return stringValue_(v, key, { max: 30000, preserveWhitespace: true }); }); });
  ['titleEn', 'titleDe'].forEach(function (key) { include(key, function (v) { return stringValue_(v, key, { max: 500 }); }); });
  include('startDate', function (v) { return dateValue_(v, 'startDate', true); });
  include('endDate', function (v) { return dateValue_(v, 'endDate', false); });
  include('location', function (v) { return stringValue_(v, 'location', { max: 1000 }); });
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
  include('name', function (v) { return stringValue_(v, 'name', { required: true, max: 300 }); });
  include('roleEn', function (v) { return stringValue_(v, 'roleEn', { required: true, max: 500 }); });
  ['roleRo', 'roleDe'].forEach(function (key) { include(key, function (v) { return stringValue_(v, key, { max: 500 }); }); });
  include('bioEn', function (v) { return stringValue_(v, 'bioEn', { required: true, max: 30000, preserveWhitespace: true }); });
  ['bioRo', 'bioDe'].forEach(function (key) { include(key, function (v) { return stringValue_(v, key, { max: 30000, preserveWhitespace: true }); }); });
  include('imageUrl', function (v) { return urlValue_(v, 'imageUrl'); });
  include('driveFileId', function (v) { return stringValue_(v, 'driveFileId', { max: 200 }); });
  include('sortOrder', function (v) { return numberValue_(v, 'sortOrder', -100000, 100000); });
  if (partial && !Object.keys(output).length) throw apiError_('VALIDATION_ERROR', 'At least one team member field is required.');
  return output;
}

function validateHomepage_(input) {
  const value = assertObject_(input, 'payload');
  rejectUnknownFields_(value, ['content', 'heroImageUrl', 'heroDriveFileId', 'heroImagePosition']);
  const content = assertObject_(value.content, 'content');
  const serialized = JSON.stringify(content);
  if (serialized.length > 200000) throw apiError_('VALIDATION_ERROR', 'content is too large.');
  const position = assertObject_(value.heroImagePosition, 'heroImagePosition');
  rejectUnknownFields_(position, ['x', 'y']);
  return {
    content: serialized,
    heroImageUrl: urlValue_(value.heroImageUrl, 'heroImageUrl'),
    heroDriveFileId: stringValue_(value.heroDriveFileId, 'heroDriveFileId', { max: 200 }),
    heroImagePositionX: numberValue_(position.x, 'heroImagePosition.x', 0, 100),
    heroImagePositionY: numberValue_(position.y, 'heroImagePosition.y', 0, 100)
  };
}

function safePlainCell_(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}
