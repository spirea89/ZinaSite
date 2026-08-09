const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const context = vm.createContext({
  console,
  Utilities: {
    base64Decode: value => [...Buffer.from(value, 'base64')].map(byte => byte > 127 ? byte - 256 : byte),
    computeDigest: (_algorithm, bytes) => [...crypto.createHash('sha256').update(Buffer.from(bytes.map(byte => byte < 0 ? byte + 256 : byte))).digest()].map(byte => byte > 127 ? byte - 256 : byte),
    DigestAlgorithm: { SHA_256: 'SHA_256' }
  }
});
for (const file of ['Validation.gs', 'Media.gs']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'google-apps-script', file), 'utf8'), context, { filename: file });

const jpeg = Buffer.from([0xff,0xd8,0xff,0xe0,0,0,0xff,0xd9]);
const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]);
const webp = Buffer.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x58]);

function payload(bytes, name, type, extra = {}) { return { usage:'team', entityType:'team', entityId:'', originalFilename:name, declaredMimeType:type, base64Data:bytes.toString('base64'), altTextRo:'Test', altTextEn:'', altTextDe:'', ...extra }; }
function expectCode(code, fn) { assert.throws(fn, error => error.apiCode === code); }

test('valid JPEG, PNG, and WebP signatures are accepted', () => {
  assert.equal(context.validateMediaUpload_(payload(jpeg, 'a.jpg', 'image/jpeg')).mimeType, 'image/jpeg');
  assert.equal(context.validateMediaUpload_(payload(png, 'a.png', 'image/png')).mimeType, 'image/png');
  assert.equal(context.validateMediaUpload_(payload(webp, 'a.webp', 'image/webp')).mimeType, 'image/webp');
});

test('SVG, malformed data, mismatched MIME, and mismatched extension are rejected', () => {
  expectCode('UNSUPPORTED_MEDIA_TYPE', () => context.validateMediaUpload_(payload(Buffer.from('<svg/>'), 'a.svg', 'image/svg+xml')));
  expectCode('MALFORMED_MEDIA', () => context.validateMediaUpload_({ ...payload(png, 'a.png', 'image/png'), base64Data:'not base64' }));
  expectCode('MEDIA_TYPE_MISMATCH', () => context.validateMediaUpload_(payload(png, 'a.png', 'image/jpeg')));
  expectCode('MEDIA_TYPE_MISMATCH', () => context.validateMediaUpload_(payload(png, 'a.jpg', 'image/png')));
});

test('oversized images and client path components are rejected', () => {
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1); oversized.set(png.subarray(0, 8)); oversized.set(png.subarray(-12), oversized.length - 12);
  expectCode('MEDIA_TOO_LARGE', () => context.validateMediaUpload_(payload(oversized, 'large.png', 'image/png')));
  expectCode('INVALID_FILENAME', () => context.validateMediaUpload_(payload(png, '../a.png', 'image/png')));
});

test('arbitrary usage and unsafe metadata fail closed', () => {
  expectCode('INVALID_MEDIA_USAGE', () => context.validateMediaUpload_(payload(png, 'a.png', 'image/png', { usage:'external' })));
  expectCode('UNSAFE_CONTENT', () => context.validateMediaUpload_(payload(png, 'a.png', 'image/png', { altTextRo:'<script>' })));
  expectCode('UNKNOWN_FIELD', () => context.validateMediaUpload_({ ...payload(png, 'a.png', 'image/png'), repository:'attacker-repository' }));
});

test('repository paths are server generated and prefix constrained', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(context.repositoryPath_('team', id, 'image/png'), `media/team/${id}.png`);
  context.assertApprovedRepositoryPath_(`media/team/${id}.png`, 'team');
  expectCode('MEDIA_PATH_NOT_OWNED', () => context.assertApprovedRepositoryPath_(`media/homepage/${id}.png`, 'team'));
  expectCode('MEDIA_PATH_NOT_OWNED', () => context.assertApprovedRepositoryPath_('../private/file.png', 'team'));
  expectCode('MEDIA_PATH_NOT_OWNED', () => context.assertApprovedRepositoryPath_(`media/team/not-a-uuid.png`, 'team'));
});

test('GitHub API authorization failures are sanitized', () => {
  const config = { owner:'test-owner', repository:'test-media', branch:'main', token:'private-token', publicBaseUrl:'https://example.test/test-media' };
  const response = { getResponseCode: () => 403, getContentText: () => JSON.stringify({ message:'token private-token denied for test-owner/private-repository' }) };
  expectCode('MEDIA_STORAGE_AUTHORIZATION', () => context.githubRequest_(config, 'put', 'media/team/file.png', { content:'AA==' }, { githubFetch: () => response }));
  try { context.githubRequest_(config, 'put', 'media/team/file.png', { content:'AA==' }, { githubFetch: () => response }); } catch (error) {
    assert.equal(/private-token|private-repository/.test(error.message), false);
  }
});

test('GitHub runtime never accepts client repository configuration', () => {
  expectCode('UNKNOWN_FIELD', () => context.validateMediaUpload_({ ...payload(png, 'a.png', 'image/png'), branch:'attacker', path:'other/file.png', sha:'attacker' }));
});
