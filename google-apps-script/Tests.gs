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
