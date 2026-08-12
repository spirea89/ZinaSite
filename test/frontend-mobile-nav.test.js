const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');

test('all public pages load the shared mobile navigation', () => {
  for (const file of ['index.html', 'team.html', 'articles.html', 'events.html', 'article.html', 'event.html', 'resources.html']) {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.match(html, /<script src="mobile-nav\.js"><\/script>/, file);
  }
});

test('mobile navigation exposes accessible toggle and close behavior', () => {
  const source = fs.readFileSync(path.join(publicDir, 'mobile-nav.js'), 'utf8');
  assert.match(source, /aria-controls/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /window\.innerWidth > 768/);
});

test('mobile navigation is collapsed until the burger menu is opened', () => {
  const css = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.navbar \.nav-links\s*{[\s\S]*display:\s*none/);
  assert.match(css, /\.navbar\.menu-open \.nav-links\s*{\s*display:\s*flex/);
  assert.match(css, /\.nav-toggle\s*{[\s\S]*display:\s*inline-flex/);
});

test('homepage mission anchor clears the fixed navigation', () => {
  const css = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
  assert.match(css, /#mission\s*{\s*scroll-margin-top:\s*8\.5rem/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*#mission\s*{\s*scroll-margin-top:\s*6\.25rem/);
});
