const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Google ID token is held in memory and cleared on logout', async () => {
  let credentialCallback;
  let storageTouched = false;
  const target = { replaceChildren() {}, setAttribute() {} };
  const form = { style: {}, insertAdjacentElement(_position, element) { elements['google-signin-container'] = element; } };
  const elements = { 'login-form': form };
  const document = {
    head: { appendChild(script) { script.onload(); } },
    createElement(tag) {
      if (tag === 'script') return {};
      return { id: '', setAttribute() {}, replaceChildren() {} };
    },
    getElementById(id) { return elements[id] || (id === 'google-signin-container' ? target : null); }
  };
  const window = {
    ZinaConfig: { isGoogle: () => true, get: () => ({ googleOAuthClientId: 'test.apps.googleusercontent.com' }) },
    google: { accounts: { id: {
      initialize(options) { credentialCallback = options.callback; },
      renderButton() {},
      disableAutoSelect() {}
    } } },
    localStorage: new Proxy({}, { get() { storageTouched = true; throw new Error('localStorage accessed'); } }),
    sessionStorage: new Proxy({}, { get() { storageTouched = true; throw new Error('sessionStorage accessed'); } })
  };
  const context = vm.createContext({ window, document, Date, Set, Promise, Error, Object });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'google-auth-provider.js'), 'utf8'), context);

  await window.GoogleAuthProvider.getSession();
  credentialCallback({ credential: 'test-token-kept-only-in-closure' });
  assert.equal(await window.GoogleAuthProvider.getIdToken(), 'test-token-kept-only-in-closure');
  await window.GoogleAuthProvider.signOut();
  await assert.rejects(() => window.GoogleAuthProvider.getIdToken(), /authentication is required/i);
  assert.equal(storageTouched, false);
});
