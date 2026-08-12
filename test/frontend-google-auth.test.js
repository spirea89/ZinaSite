const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Google ID token is stored only for the current tab and cleared on logout', async () => {
  let credentialCallback;
  let localStorageTouched = false;
  const sessionValues = new Map();
  const target = { renderedClasses: [], replaceChildren(child) { if (child?.className) this.renderedClasses.push(child.className); }, setAttribute() {}, removeAttribute() {} };
  const form = { style: {}, insertAdjacentElement(_position, element) { elements['google-signin-container'] = element; } };
  const elements = { 'login-form': form };
  const document = {
    head: { appendChild(script) { script.onload(); } },
    createElement(tag) {
      if (tag === 'script') return {};
      return { id: '', setAttribute() {}, replaceChildren() {}, append() {} };
    },
    getElementById(id) { return elements[id] || (id === 'google-signin-container' ? target : null); }
  };
  const window = {
    ZinaConfig: { isGoogle: () => true, get: () => ({ googleOAuthClientId: 'test.apps.googleusercontent.com', protectedAppsScriptApiUrl: 'https://example.invalid/exec' }) },
    fetch: async () => ({ json: async () => ({ ok: true, data: [], error: null, version: 'v1' }) }),
    google: { accounts: { id: {
      initialize(options) { credentialCallback = options.callback; },
      renderButton() {},
      prompt() {},
      disableAutoSelect() {}
    } } },
    localStorage: new Proxy({}, { get() { localStorageTouched = true; throw new Error('localStorage accessed'); } }),
    sessionStorage: {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); }
    },
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({ window, document, Date, Set, Promise, Error, Object });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'google-auth-provider.js'), 'utf8'), context);

  await window.GoogleAuthProvider.getSession();
  await credentialCallback({ credential: 'test-token-kept-only-in-closure' });
  assert.ok(target.renderedClasses.includes('google-signin-loading'));
  assert.equal(await window.GoogleAuthProvider.getIdToken(), 'test-token-kept-only-in-closure');
  assert.equal(sessionValues.get('zina-google-admin-token'), 'test-token-kept-only-in-closure');
  assert.ok(Number(sessionValues.get('zina-google-admin-token-acquired-at')) > 0);
  assert.ok(Number(sessionValues.get('zina-google-admin-authorized-at')) > 0);
  await window.GoogleAuthProvider.signOut();
  await assert.rejects(() => window.GoogleAuthProvider.getIdToken(), /authentication is required/i);
  assert.equal(sessionValues.size, 0);
  assert.equal(localStorageTouched, false);
});

test('logout revokes the current Google grant so another account can be selected', async () => {
  let credentialCallback;
  let revokedSubject = null;
  let cancelCalled = false;
  const sessionValues = new Map();
  const target = { replaceChildren() {}, setAttribute() {}, removeAttribute() {} };
  const form = { style: {}, insertAdjacentElement(_position, element) { elements['google-signin-container'] = element; } };
  const elements = { 'login-form': form };
  const document = {
    head: { appendChild(script) { script.onload(); } },
    createElement(tag) { return tag === 'script' ? {} : { id: '', setAttribute() {}, replaceChildren() {}, append() {} }; },
    getElementById(id) { return elements[id] || (id === 'google-signin-container' ? target : null); }
  };
  const payload = Buffer.from(JSON.stringify({ sub: 'synthetic-google-subject' })).toString('base64url');
  const token = `header.${payload}.signature`;
  const window = {
    ZinaConfig: { isGoogle: () => true, get: () => ({ googleOAuthClientId: 'test.apps.googleusercontent.com', protectedAppsScriptApiUrl: 'https://example.invalid/exec' }) },
    fetch: async () => ({ json: async () => ({ ok: true, data: [], error: null, version: 'v1' }) }),
    google: { accounts: { id: {
      initialize(options) { credentialCallback = options.callback; },
      renderButton() {},
      disableAutoSelect() {},
      cancel() { cancelCalled = true; },
      revoke(subject, callback) { revokedSubject = subject; callback({ successful: true }); }
    } } },
    atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
    sessionStorage: {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); }
    },
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({ window, document, Date, Set, Promise, Error, Object, Number, JSON });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'google-auth-provider.js'), 'utf8'), context);

  await window.GoogleAuthProvider.getSession();
  await credentialCallback({ credential: token });
  await window.GoogleAuthProvider.signOut();

  assert.equal(revokedSubject, 'synthetic-google-subject');
  assert.equal(cancelCalled, true);
  assert.equal(sessionValues.size, 0);
  assert.equal(await window.GoogleAuthProvider.getSession(), null);
});

test('the current-tab session is restored after admin page navigation', async () => {
  let initializedOptions;
  let promptCalled = false;
  let fetchCalls = 0;
  const sessionValues = new Map([
    ['zina-google-admin-token', 'token-restored-after-navigation'],
    ['zina-google-admin-token-acquired-at', String(Date.now())],
    ['zina-google-admin-authorized-at', String(Date.now())]
  ]);
  const target = { replaceChildren() {}, setAttribute() {}, removeAttribute() {} };
  const form = { style: {}, insertAdjacentElement(_position, element) { elements['google-signin-container'] = element; } };
  const elements = { 'login-form': form };
  const document = {
    head: { appendChild(script) { script.onload(); } },
    createElement(tag) {
      if (tag === 'script') return {};
      return { id: '', setAttribute() {}, replaceChildren() {}, append() {} };
    },
    getElementById(id) { return elements[id] || (id === 'google-signin-container' ? target : null); }
  };
  const window = {
    ZinaConfig: { isGoogle: () => true, get: () => ({ googleOAuthClientId: 'test.apps.googleusercontent.com', protectedAppsScriptApiUrl: 'https://example.invalid/exec' }) },
    fetch: async () => { fetchCalls++; return { json: async () => ({ ok: true, data: [], error: null, version: 'v1' }) }; },
    google: { accounts: { id: {
      initialize(options) { initializedOptions = options; },
      renderButton() {},
      prompt() { promptCalled = true; },
      disableAutoSelect() {}
    } } },
    localStorage: new Proxy({}, { get() { throw new Error('localStorage accessed'); } }),
    sessionStorage: {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); }
    },
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({ window, document, Date, Set, Promise, Error, Object });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'google-auth-provider.js'), 'utf8'), context);

  const session = await window.GoogleAuthProvider.getSession();
  assert.equal(initializedOptions.auto_select, false);
  assert.equal(session.user.id, 'google-administrator');
  assert.equal(await window.GoogleAuthProvider.getIdToken(), 'token-restored-after-navigation');
  assert.equal(promptCalled, false);
  assert.equal(fetchCalls, 0);
});

test('a Google account is not exposed as signed in until the admin allowlist approves it', async () => {
  let credentialCallback;
  const sessionValues = new Map();
  const errorBox = { textContent: '', style: {} };
  const target = { replaceChildren() {}, setAttribute() {}, removeAttribute() {} };
  const form = { style: {}, insertAdjacentElement(_position, element) { elements['google-signin-container'] = element; } };
  const elements = { 'login-form': form, 'login-error': errorBox };
  const document = {
    head: { appendChild(script) { script.onload(); } },
    createElement(tag) { return tag === 'script' ? {} : { id: '', setAttribute() {}, replaceChildren() {}, append() {} }; },
    getElementById(id) { return elements[id] || (id === 'google-signin-container' ? target : null); }
  };
  const window = {
    ZinaConfig: { isGoogle: () => true, get: () => ({ googleOAuthClientId: 'test.apps.googleusercontent.com', protectedAppsScriptApiUrl: 'https://example.invalid/exec' }) },
    fetch: async () => ({ json: async () => ({ ok: false, data: null, error: { code: 'FORBIDDEN', message: 'Forbidden.' }, version: 'v1' }) }),
    google: { accounts: { id: {
      initialize(options) { credentialCallback = options.callback; },
      renderButton() {},
      disableAutoSelect() {}
    } } },
    localStorage: new Proxy({}, { get() { throw new Error('localStorage accessed'); } }),
    sessionStorage: {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); }
    }
  };
  const context = vm.createContext({ window, document, Date, Set, Promise, Error, Object, Number, JSON });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'google-auth-provider.js'), 'utf8'), context);

  let signedIn = false;
  window.GoogleAuthProvider.onAuthStateChange(event => { if (event === 'SIGNED_IN') signedIn = true; });
  await window.GoogleAuthProvider.getSession();
  await credentialCallback({ credential: 'token-for-unlisted-account' });

  assert.equal(signedIn, false);
  assert.equal(await window.GoogleAuthProvider.getSession(), null);
  assert.equal(sessionValues.size, 0);
  assert.equal(errorBox.style.display, 'block');
  assert.match(errorBox.textContent, /nu este autorizat/i);
});

test('an expired current-tab session is discarded', async () => {
  const sessionValues = new Map([
    ['zina-google-admin-token', 'expired-token'],
    ['zina-google-admin-token-acquired-at', String(Date.now() - 51 * 60 * 1000)]
  ]);
  const target = { replaceChildren() {}, setAttribute() {}, removeAttribute() {} };
  const form = { style: {}, insertAdjacentElement(_position, element) { elements['google-signin-container'] = element; } };
  const elements = { 'login-form': form };
  const document = {
    head: { appendChild(script) { script.onload(); } },
    createElement(tag) { return tag === 'script' ? {} : { id: '', setAttribute() {}, replaceChildren() {}, append() {} }; },
    getElementById(id) { return elements[id] || (id === 'google-signin-container' ? target : null); }
  };
  const window = {
    ZinaConfig: { isGoogle: () => true, get: () => ({ googleOAuthClientId: 'test.apps.googleusercontent.com', protectedAppsScriptApiUrl: 'https://example.invalid/exec' }) },
    google: { accounts: { id: { initialize() {}, renderButton() {}, disableAutoSelect() {} } } },
    localStorage: new Proxy({}, { get() { throw new Error('localStorage accessed'); } }),
    sessionStorage: {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); }
    }
  };
  const context = vm.createContext({ window, document, Date, Set, Promise, Error, Object, Number });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'google-auth-provider.js'), 'utf8'), context);

  assert.equal(await window.GoogleAuthProvider.getSession(), null);
  assert.equal(sessionValues.size, 0);
});
