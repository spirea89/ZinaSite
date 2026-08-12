const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');

test('resources page presents Language Roulette as a family game', () => {
  const html = fs.readFileSync(path.join(publicDir, 'resources.html'), 'utf8');
  assert.match(html, /data-i18n="familyGames"/);
  assert.match(html, /data-i18n="languageRoulette"/);
  assert.match(html, /href="language-roulette\.html"/);
  assert.doesNotMatch(html, /target="_blank"/);
});

test('Language Roulette opens inside a ZiNa-hosted wrapper', () => {
  const html = fs.readFileSync(path.join(publicDir, 'language-roulette.html'), 'utf8');
  assert.match(html, /<iframe[\s\S]*https:\/\/spirea89\.github\.io\/RoataNoroculuiDE\//);
  assert.match(html, /href="resources\.html"/);
  assert.match(html, /title="Language Roulette"/);
});

test('all public navigation menus include Resources', () => {
  for (const file of ['index.html', 'team.html', 'articles.html', 'events.html', 'article.html', 'event.html', 'resources.html']) {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.match(html, /href="resources\.html"[^>]*data-i18n="resources"/, file);
  }
});

test('Resources content has Romanian, English, and German translations', () => {
  const source = fs.readFileSync(path.join(publicDir, 'i18n.js'), 'utf8');
  assert.equal((source.match(/resourcesTitle:/g) || []).length, 3);
  assert.equal((source.match(/familyGames:/g) || []).length, 3);
  assert.equal((source.match(/languageRouletteDescription:/g) || []).length, 3);
});
