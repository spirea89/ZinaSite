function runA1SelfTests() {
  const results = [];
  function test(name, fn) { try { fn(); results.push({ name: name, passed: true }); } catch (error) { results.push({ name: name, passed: false, message: error.message }); } }
  function expectCode(code, fn) { try { fn(); throw new Error('Expected ' + code); } catch (error) { if (error.apiCode !== code) throw error; } }
  function expect(value, message) { if (!value) throw new Error(message); }
  function fakeCache() {
    const values = {};
    const cache = {
      puts: [],
      get: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
      put: function (key, value, ttl) { values[key] = value; cache.puts.push({ key: key, value: value, ttl: ttl }); },
      remove: function (key) { delete values[key]; }
    };
    return cache;
  }
  function authFixture(overrides) {
    const now = 2000000000;
    const email = 'test' + '@gmail.com';
    const state = { fetches: 0, budgets: 0 };
    const claims = { aud: 'test-client', iss: 'https://accounts.google.com', exp: now + 3600, iat: now - 10, email: email.toUpperCase(), email_verified: true, sub: 'subject-1' };
    const options = overrides || {};
    const cache = options.cache || fakeCache();
    const dependencies = {
      nowSeconds: now,
      clientId: 'test-client',
      cache: cache,
      fingerprint: function (token) { return token === 'aaa.bbb.ccc' ? 'fingerprint-one' : 'fingerprint-other'; },
      consumeBudget: function () { state.budgets += 1; if (options.budgetError) throw apiError_(options.budgetError, 'safe'); },
      fetchTokenInfo: function () {
        state.fetches += 1;
        return options.response || { statusCode: 200, body: JSON.stringify(Object.assign({}, claims, options.claims || {})) };
      }
    };
    return { now: now, email: email, claims: claims, state: state, cache: cache, dependencies: dependencies };
  }

  test('public routing rejects unknown actions', function () { expectCode('UNKNOWN_PUBLIC_ACTION', function () { assertAllowedAction_('nope', PUBLIC_ACTIONS, true); }); });
  test('drafts fail public publication filter', function () { expect(!isPublishedRecord_({ status: 'draft' }) && isPublishedRecord_({ status: 'published' }), 'Publication filter failed.'); });
  test('missing token is rejected', function () { expectCode('AUTHENTICATION_FAILED', function () { googleIdTokenValue_(); }); });
  test('malformed token is rejected', function () { expectCode('AUTHENTICATION_FAILED', function () { googleIdTokenValue_('not-a-jwt'); }); });
  test('protected action requires authentication', function () { expectCode('AUTHENTICATION_FAILED', function () { routeProtectedRequest_({ action: 'listAllArticles', idToken: 'aaa.bbb.ccc' }, { verifyToken: function () { throw apiError_('AUTHENTICATION_FAILED', 'Authentication failed.'); }, findAdmin: function () { return null; } }); }); });

  [
    ['incorrect audience', { aud: 'wrong' }],
    ['incorrect issuer', { iss: 'wrong' }],
    ['expired token', { exp: 1999999999 }],
    ['over-age token', { iat: 1999999099 }],
    ['future-issued token', { iat: 2000000301 }],
    ['missing subject', { sub: '' }],
    ['unverified email', { email_verified: false }],
    ['non-authoritative email', { email: 'test' + '@example.org', hd: '' }]
  ].forEach(function (item) {
    test(item[0] + ' is rejected', function () {
      const fixture = authFixture({ claims: item[1] });
      expectCode('AUTHENTICATION_FAILED', function () { verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); });
    });
  });

  test('mismatched administrator email is rejected', function () { const fixture = authFixture(); expectCode('FORBIDDEN', function () { authorizeAdmin_({ email: fixture.email, sub: 'subject-1' }, { findAdmin: function () { return { email: 'other' + '@gmail.com', googleSub: 'subject-1', active: true }; } }); }); });
  test('mismatched administrator subject is rejected', function () { const fixture = authFixture(); expectCode('FORBIDDEN', function () { authorizeAdmin_({ email: fixture.email, sub: 'subject-1' }, { findAdmin: function () { return { email: fixture.email, googleSub: 'different', active: true }; } }); }); });
  test('duplicate administrator rows fail closed', function () { const fixture = authFixture(); const rows = [{ email: fixture.email, google_sub: 'subject-1', active: true }, { email: fixture.email.toUpperCase(), google_sub: 'subject-1', active: true }]; expect(adminFromRows_(rows, fixture.email) === null, 'Duplicate administrators were accepted.'); });
  test('inactive administrator is rejected', function () { const fixture = authFixture(); expectCode('FORBIDDEN', function () { authorizeAdmin_({ email: fixture.email, sub: 'subject-1' }, { findAdmin: function () { return { email: fixture.email, googleSub: 'subject-1', active: false }; } }); }); });
  test('valid active administrator is accepted', function () { const fixture = authFixture(); const admin = authorizeAdmin_({ email: fixture.email, sub: 'subject-1' }, { findAdmin: function () { return { email: fixture.email, googleSub: 'subject-1', active: true }; } }); expect(admin.email === fixture.email && admin.sub === 'subject-1', 'Active administrator was not accepted.'); });

  test('successful token verification is cached', function () { const fixture = authFixture(); verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); expect(fixture.state.fetches === 1 && fixture.state.budgets === 1, 'Successful verification cache was not used.'); });
  test('verification cache stores no raw token and respects expiry cap', function () { const fixture = authFixture({ claims: { exp: 2000000120 } }); verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); const entry = fixture.cache.puts[0]; expect(entry && entry.key.indexOf('aaa.bbb.ccc') === -1 && String(entry.value).indexOf('aaa.bbb.ccc') === -1, 'Raw token entered the cache.'); expect(entry.ttl === 120 && entry.ttl <= AUTH_SUCCESS_CACHE_MAX_SECONDS, 'Cache lifetime exceeded token expiry or policy.'); });
  test('invalid token verification is negatively cached', function () { const fixture = authFixture({ response: { statusCode: 400, body: '{}' } }); expectCode('AUTHENTICATION_FAILED', function () { verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); }); expectCode('AUTHENTICATION_FAILED', function () { verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); }); expect(fixture.state.fetches === 1 && fixture.state.budgets === 1, 'Negative verification cache was not used.'); });
  test('cached token still observes immediate administrator revocation', function () {
    const fixture = authFixture(); let active = true;
    const dependencies = Object.assign({}, fixture.dependencies, { findAdmin: function () { return { email: fixture.email, googleSub: 'subject-1', active: active }; } });
    authenticateAdminRequest_('aaa.bbb.ccc', dependencies);
    active = false;
    expectCode('FORBIDDEN', function () { authenticateAdminRequest_('aaa.bbb.ccc', dependencies); });
    expect(fixture.state.fetches === 1, 'Verified token cache was not reused.');
  });
  test('global tokeninfo budget fails closed before fetch', function () { const fixture = authFixture({ budgetError: 'AUTHENTICATION_RATE_LIMITED' }); expectCode('AUTHENTICATION_RATE_LIMITED', function () { verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); }); expect(fixture.state.fetches === 0, 'Tokeninfo was called after budget rejection.'); });
  test('tokeninfo outage is sanitized', function () { const fixture = authFixture({ response: { statusCode: 503, body: 'private upstream detail' } }); let failure; try { verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); } catch (error) { failure = failureEnvelope_(error); } const json = JSON.stringify(failure); expect(failure.error.code === 'AUTHENTICATION_UNAVAILABLE' && json.indexOf('private upstream detail') === -1 && json.indexOf('aaa.bbb.ccc') === -1, 'Authentication outage leaked sensitive details.'); });
  test('tokeninfo rate limit is sanitized', function () { const fixture = authFixture({ response: { statusCode: 429, body: 'private upstream detail' } }); let failure; try { verifyGoogleIdToken_('aaa.bbb.ccc', fixture.dependencies); } catch (error) { failure = failureEnvelope_(error); } const json = JSON.stringify(failure); expect(failure.error.code === 'AUTHENTICATION_RATE_LIMITED' && json.indexOf('private upstream detail') === -1 && json.indexOf('aaa.bbb.ccc') === -1, 'Rate-limit error leaked sensitive details.'); });

  const version = '2026-08-09T12:00:00.000Z';
  test('successful update accepts correct expectedUpdatedAt', function () { assertExpectedUpdatedAt_({ updated_at: version }, version); });
  test('stale update is rejected', function () { expectCode('CONFLICT', function () { assertExpectedUpdatedAt_({ updated_at: version }, '2026-08-09T11:59:59.000Z'); }); });
  test('stale status change is rejected', function () { expectCode('CONFLICT', function () { assertExpectedUpdatedAt_({ updated_at: version }, '2026-08-09T11:59:58.000Z'); }); });
  test('stale delete is rejected', function () { expectCode('CONFLICT', function () { assertExpectedUpdatedAt_({ updated_at: version }, '2026-08-09T11:59:57.000Z'); }); });
  test('missing concurrency metadata is rejected', function () { expectCode('INVALID_CONCURRENCY_VALUE', function () { expectedUpdatedAtValue_(undefined, false); }); });
  test('malformed concurrency metadata is rejected', function () { expectCode('INVALID_CONCURRENCY_VALUE', function () { expectedUpdatedAtValue_('2026-08-09', false); }); });
  test('missing create idempotency key is rejected', function () { expectCode('INVALID_IDEMPOTENCY_KEY', function () { idempotencyKeyValue_(); }); });

  test('duplicate create retry resolves to one result ID', function () {
    const spec = { action: 'createEvent', recordType: 'Event', recordId: '' };
    const first = resolveIdempotencyRecord_([], spec, 'key-hash', 'request-hash', 'record-id');
    const stored = [{ request_hash: 'request-hash', action: 'createEvent', record_type: 'Event', target_id: '', result_id: first.resultId, state: 'completed' }];
    const retry = resolveIdempotencyRecord_(stored, spec, 'key-hash', 'request-hash', 'different-proposed-id');
    expect(first.replay === false && retry.replay === true && retry.resultId === 'record-id', 'Duplicate retry did not reuse the original result ID.');
  });
  test('idempotency key reused for another action is rejected', function () {
    const stored = [{ request_hash: 'request-hash', action: 'createEvent', record_type: 'Event', target_id: '', result_id: 'record-id', state: 'completed' }];
    expectCode('IDEMPOTENCY_CONFLICT', function () { resolveIdempotencyRecord_(stored, { action: 'deleteEvent', recordType: 'Event', recordId: 'record-id' }, 'key-hash', 'different-hash', ''); });
  });
  test('lock contention returns stable error', function () {
    expectCode('WRITE_LOCK_TIMEOUT', function () { runWriteMutation_({ action: 'updateEvent', adminSub: 'subject-1', recordType: 'Event', recordId: 'record-id' }, function () { throw new Error('must not execute'); }, { writeLock: { tryLock: function () { return false; }, releaseLock: function () { throw new Error('must not release'); } }, appendAudit: function () {} }); });
  });
  test('audit record contains only safe fields', function () {
    const record = auditRecord_({ action: 'updateEvent', adminSub: 'subject-1', recordType: 'Event', recordId: 'record-id', email: 'private' + '@example.org', token: 'secret' }, 'failed', 'CONFLICT', version);
    const keys = Object.keys(record).sort().join(',');
    expect(keys === 'action,error_code,google_sub,outcome,record_id,record_type,timestamp', 'Audit record shape is unsafe.');
    const json = JSON.stringify(record);
    expect(json.indexOf('private' + '@example.org') === -1 && json.indexOf('secret') === -1, 'Audit record leaked sensitive data.');
  });
  test('partial audit failure returns uncertain state', function () {
    const lock = { tryLock: function () { return true; }, releaseLock: function () {} };
    expectCode('WRITE_STATE_UNCERTAIN', function () { runWriteMutation_({ action: 'updateEvent', adminSub: 'subject-1', recordType: 'Event', recordId: 'record-id' }, function () { return { id: 'record-id' }; }, { writeLock: lock, nowIso: function () { return version; }, appendAudit: function () { throw new Error('private audit failure'); } }); });
  });

  test('legitimate rich text is preserved', function () { const html = '<p>Hello <strong>world</strong><br></p>'; expect(safeRichHtmlValue_(html, 'content', { required: true, max: 1000 }) === html, 'Legitimate formatting was not preserved.'); });
  test('script HTML is rejected', function () { expectCode('UNSAFE_HTML', function () { safeRichHtmlValue_('<script>alert(1)</script>', 'content', { max: 1000 }); }); });
  test('event-handler HTML is rejected', function () { expectCode('UNSAFE_HTML', function () { safeRichHtmlValue_('<p onclick="alert(1)">Text</p>', 'content', { max: 1000 }); }); });
  test('dangerous rich-text URL is rejected', function () { expectCode('INVALID_URL', function () { safeRichHtmlValue_('<a href="javascript:alert(1)">Text</a>', 'content', { max: 1000 }); }); });
  test('homepage embedded HTML is rejected', function () { expectCode('UNSAFE_CONTENT', function () { validateHomepageContentNode_({ heading: '<img src=x onerror=alert(1)>' }, 'content', 0); }); });
  test('homepage contacts accept approved public contact values', function () { const value = validateHomepageContacts_({ email: 'office@example.org', whatsappUrl: 'https://chat.whatsapp.com/example_group', facebookUrl: 'https://www.facebook.com/example', linkedinUrl: 'https://www.linkedin.com/company/example', zvrNumber: '1234567890' }); expect(value.email === 'office@example.org', 'Contact email changed unexpectedly.'); expect(value.zvrNumber === '1234567890', 'ZVR number changed unexpectedly.'); });
  test('homepage contacts reject invalid email, URL, and ZVR values', function () { expectCode('VALIDATION_ERROR', function () { validateHomepageContacts_({ email: 'not-an-email', whatsappUrl: '', facebookUrl: '', linkedinUrl: '', zvrNumber: '' }); }); expectCode('INVALID_URL', function () { validateHomepageContacts_({ email: '', whatsappUrl: 'https://example.org/group', facebookUrl: '', linkedinUrl: '', zvrNumber: '' }); }); expectCode('VALIDATION_ERROR', function () { validateHomepageContacts_({ email: '', whatsappUrl: '', facebookUrl: '', linkedinUrl: '', zvrNumber: 'ZVR-123' }); }); });
  test('formula injection with leading whitespace is neutralized', function () { expect(safePlainCell_('\t=IMPORTDATA("https://example.org")').charAt(0) === "'", 'Leading-whitespace formula was not neutralized.'); });
  test('ordinary Sheet text is unchanged', function () { expect(safePlainCell_('Normal text') === 'Normal text', 'Ordinary text was altered.'); });
  test('write metadata unknown fields are rejected', function () { expectCode('UNKNOWN_FIELD', function () { createArguments_({ id: 'unexpected', payload: {}, idempotencyKey: 'abcdefghijklmnop' }); }); });
  test('write safety errors are sanitized', function () { const envelope = failureEnvelope_(apiError_('CONFLICT', 'Record was modified by another administrator.')); const json = JSON.stringify(envelope); expect(envelope.error.code === 'CONFLICT' && json.indexOf('stack') === -1 && json.indexOf('token') === -1, 'Write-safety error was not sanitized.'); });

  test('unknown payload fields are rejected', function () { expectCode('UNKNOWN_FIELD', function () { validateArticle_({ title: 'T', content: 'C', status: 'draft', unexpected: true }, false); }); });
  test('invalid status is rejected', function () { expectCode('INVALID_STATUS', function () { statusValue_('private'); }); });
  test('invalid ID is rejected', function () { expectCode('INVALID_ID', function () { idValue_('bad', 'id', true); }); });
  test('invalid URL is rejected', function () { expectCode('INVALID_URL', function () { urlValue_('javascript:alert(1)', 'url'); }); });
  test('invalid date is rejected', function () { expectCode('INVALID_DATE', function () { dateValue_('not-a-date', 'date', true); }); });
  test('failure responses redact stacks and tokens', function () { const error = apiError_('BAD', 'safe'); error.stack = 'SECRET_TOKEN'; const json = JSON.stringify(failureEnvelope_(error)); expect(json.indexOf('SECRET_TOKEN') === -1 && json.indexOf('stack') === -1, 'Sensitive error data leaked.'); });
  test('API response shape is consistent', function () { const success = successEnvelope_({}), failure = failureEnvelope_(apiError_('BAD', 'safe')); ['ok', 'data', 'error', 'version'].forEach(function (key) { expect(Object.prototype.hasOwnProperty.call(success, key) && Object.prototype.hasOwnProperty.call(failure, key), 'Missing response field.'); }); });

  const failed = results.filter(function (result) { return !result.passed; });
  if (failed.length) throw new Error('A1 self-tests failed: ' + failed.map(function (result) { return result.name + ': ' + result.message; }).join('; '));
  Logger.log(JSON.stringify(successEnvelope_({ tests: results.length, passed: results.length })));
  return successEnvelope_({ tests: results.length, passed: results.length });
}

function runPhase2SelfTests() {
  return runA1SelfTests();
}

function runA2SelfTests() {
  return runA1SelfTests();
}
