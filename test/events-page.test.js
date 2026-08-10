const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

for (const siteDirectory of ['public', 'docs']) {
  test(`${siteDirectory} events page uses one Google read and automatic date groups`, () => {
    const html = fs.readFileSync(path.join(root, siteDirectory, 'events.html'), 'utf8');

    assert.match(html, /DataService\.getEvents\('published'\)/);
    assert.doesNotMatch(html, /getEventsPage\('published'/);
    assert.doesNotMatch(html, /id="calendar"/);
    assert.match(html, /I18n\.t\('upcoming'\)/);
    assert.match(html, /I18n\.t\('past'\)/);
    assert.match(html, /d < today/);
    assert.match(html, /eventsList\.innerHTML = '';\s*eventsList\.style\.display = 'block';/);
  });
}
