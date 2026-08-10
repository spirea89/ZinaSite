const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  const attributes = new Map();
  const classes = new Set();
  return {
    textContent: '', disabled: false, dataset: {}, children: [],
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    getAttribute: name => attributes.get(name),
    replaceChildren() { this.children = []; this.textContent = ''; },
    append(...children) { this.children.push(...children); }
  };
}

function loadAdminUi() {
  const window = {};
  const context = vm.createContext({ window, document: { createElement: element } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'admin-ui.js'), 'utf8'), context);
  return window.AdminUi;
}

test('pending action is disabled and restored after success', async () => {
  const ui = loadAdminUi();
  const button = element();
  button.textContent = 'Salvează';
  let finish;
  const operation = new Promise(resolve => { finish = resolve; });
  const pending = ui.withPending(button, 'Se salvează…', () => operation);

  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(button.classList.contains('is-pending'), true);
  assert.equal(button.children[1].textContent, 'Se salvează…');
  finish('saved');
  assert.equal(await pending, 'saved');
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Salvează');
  assert.equal(button.getAttribute('aria-busy'), undefined);
});

test('pending action is restored after failure', async () => {
  const ui = loadAdminUi();
  const button = element();
  button.textContent = 'Șterge';
  await assert.rejects(ui.withPending(button, 'Se șterge…', async () => { throw new Error('failed'); }), /failed/);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Șterge');
  assert.equal(button.classList.contains('is-pending'), false);
});

test('all production mutation pages load the shared admin UI helper', () => {
  for (const name of ['admin-articles.html', 'admin-events.html', 'admin-homepage.html', 'admin-team.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
    assert.match(html, /<script src="admin-ui\.js"><\/script>/, name);
    assert.match(html, /AdminUi\.withPending/, name);
  }
});
