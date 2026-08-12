const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('language settings default to Romanian and German with English disabled', async () => {
  const elements = [
    { dataset: { language: 'de' }, hidden: true, querySelectorAll: () => [] },
    { dataset: { language: 'en' }, hidden: false, querySelectorAll: () => [] }
  ];
  const document = {
    addEventListener() {},
    querySelectorAll(selector) { return selector === '[data-language]' ? elements : []; }
  };
  const window = { document, DataService: { async getHomepageContent() { return { content: {} }; } } };
  const source = fs.readFileSync(path.join(root, 'public', 'admin-language-settings.js'), 'utf8');
  vm.runInContext(source, vm.createContext({ window, console }));

  const settings = await window.ZinaLanguageSettings.load();
  assert.deepEqual(JSON.parse(JSON.stringify(settings)), { ro: true, de: true, en: false });
  assert.equal(elements[0].hidden, false);
  assert.equal(elements[1].hidden, true);
});

test('saved language settings can re-enable English without disabling Romanian', async () => {
  const document = { addEventListener() {}, querySelectorAll() { return []; } };
  const window = { document, DataService: { async getHomepageContent() { return { content: { languageSettings: { ro: true, de: false, en: true } } }; } } };
  const source = fs.readFileSync(path.join(root, 'public', 'admin-language-settings.js'), 'utf8');
  vm.runInContext(source, vm.createContext({ window, console }));

  assert.deepEqual(JSON.parse(JSON.stringify(await window.ZinaLanguageSettings.load())), { ro: true, de: false, en: true });
});

test('visible article terminology is renamed to projects without changing internal URLs or APIs', () => {
  const i18n = fs.readFileSync(path.join(root, 'public', 'i18n.js'), 'utf8');
  assert.match(i18n, /articles: 'Proiecte'/);
  assert.match(i18n, /articles: 'Projekte'/);
  assert.match(i18n, /articles: 'Projects'/);
  const articlesPage = fs.readFileSync(path.join(root, 'public', 'articles.html'), 'utf8');
  assert.match(articlesPage, /<h1 data-i18n="articlesTitle">Proiecte<\/h1>/);
  assert.match(articlesPage, /article\.html\?id=/);
  const provider = fs.readFileSync(path.join(root, 'public', 'google-apps-script-provider.js'), 'utf8');
  assert.match(provider, /listPublishedArticles/);
  assert.match(i18n, /normalizeHomepageContent/);
  assert.match(i18n, /\['Articole', 'Proiecte'\]/);
});

test('admin editors use Romanian as primary and retain hidden English fields', () => {
  for (const name of ['admin-articles.html', 'admin-events.html', 'admin-team.html']) {
    const html = fs.readFileSync(path.join(root, 'public', name), 'utf8');
    assert.match(html, /Română — principală/, name);
    assert.match(html, /data-language="en"/, name);
    assert.match(html, /admin-language-settings\.js/, name);
  }
});

test('changed pages contain syntactically valid inline scripts and unique element IDs', () => {
  for (const name of ['index.html', 'articles.html', 'article.html', 'admin-homepage.html', 'admin-articles.html', 'admin-events.html', 'admin-team.html']) {
    const html = fs.readFileSync(path.join(root, 'public', name), 'utf8');
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    scripts.forEach((match, index) => assert.doesNotThrow(() => new vm.Script(match[1]), `${name} inline script ${index + 1}`));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name} contains duplicate IDs`);
  }
});
