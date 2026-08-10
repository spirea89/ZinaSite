const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

test('valid production runtime selects the Google Apps Script provider', () => {
  const window = { __ZINA_RUNTIME_CONFIG: {
    backendProvider: 'google-apps-script',
    publicAppsScriptApiUrl: 'https://script.google.com/macros/s/test-public/exec',
    protectedAppsScriptApiUrl: 'https://script.google.com/macros/s/test-protected/exec',
    googleOAuthClientId: '123456-test.apps.googleusercontent.com'
  } };
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'zina-config.js'), 'utf8'), vm.createContext({ window }));
  assert.equal(window.ZinaConfig.get().backendProvider, 'google-apps-script');
  assert.equal(window.ZinaConfig.isGoogle(), true);
});

test('data and authentication facades expose only the Google production providers', async () => {
  const calls = [];
  const googleData = new Proxy({}, { get: (_target, name) => (...args) => { calls.push([name, args]); return Promise.resolve(name === 'uploadMedia' ? { publicUrl: 'https://media.test/image.webp' } : name); } });
  const googleAuth = new Proxy({}, { get: (_target, name) => (...args) => { calls.push([name, args]); return name; } });
  const window = {
    location: { pathname: '/admin-homepage.html' },
    ZinaConfig: { get: () => ({ backendProvider: 'google-apps-script' }) },
    GoogleAppsScriptProvider: googleData,
    GoogleAuthProvider: googleAuth
  };
  const context = vm.createContext({ window });
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'data-service.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'auth-service.js'), 'utf8'), context);
  assert.equal(await window.DataService.getHomepageContent(), 'getHomepageContent');
  assert.equal(await window.DataService.uploadHomepageImage({ name: 'hero.png' }), 'https://media.test/image.webp');
  assert.equal(window.AuthService.signIn(), 'signIn');
  assert.deepEqual(calls[0], ['getHomepageContent', [true]]);
  assert.equal(calls.some(([name]) => name === 'uploadMedia'), true);
});

test('active production frontend and server contain no Supabase integration', () => {
  const activeFiles = [
    'server.js', 'package.json', '.env.example',
    ...fs.readdirSync(PUBLIC).filter(name => /\.(?:js|html)$/.test(name)).map(name => `public/${name}`)
  ];
  for (const file of activeFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /supabase/i, file);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'supabase.js')), false);
});

test('Pages build injects and validates secret-backed Google runtime configuration', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  assert.match(workflow, /backendProvider: 'google-apps-script'/);
  assert.match(workflow, /secrets\.ZINA_PUBLIC_APPS_SCRIPT_API_URL/);
  assert.match(workflow, /secrets\.ZINA_PROTECTED_APPS_SCRIPT_API_URL/);
  assert.match(workflow, /secrets\.ZINA_GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(workflow, /Required ZiNa production configuration is missing or invalid/);
});
