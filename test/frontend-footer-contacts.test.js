const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'footer-contacts.js'), 'utf8');

test('footer contacts render safe links and share one homepage request', async () => {
  let requestCount = 0;
  let contactContainer = null;
  const footer = {
    appendChild(element) { contactContainer = element; },
    querySelector() { return contactContainer; }
  };
  const document = {
    querySelector(selector) { return selector === '.footer .footer-content' ? footer : null; },
    createElement() {
      return {
        children: [], hidden: false,
        appendChild(child) { this.children.push(child); },
        replaceChildren() { this.children = []; },
        setAttribute(name, value) { this[name] = value; }
      };
    }
  };
  const window = {
    document,
    DataService: {
      async getHomepageContent() {
        requestCount += 1;
        return { content: { contacts: {
          email: 'office@example.org',
          whatsappUrl: 'https://chat.whatsapp.com/example_group',
          facebookUrl: 'https://www.facebook.com/example',
          linkedinUrl: 'https://www.linkedin.com/company/example',
          zvrNumber: '1234567890'
        } } };
      }
    }
  };
  vm.runInContext(source, vm.createContext({ window, console, URL }));

  await window.ZinaFooterContacts.load();
  assert.equal(requestCount, 1);
  assert.deepEqual(contactContainer.children.map(link => link.textContent), ['Email', 'WhatsApp', 'Facebook', 'LinkedIn', 'ZVR: 1234567890']);
  assert.equal(contactContainer.children[0].href, 'mailto:office@example.org');
  assert.equal(contactContainer.children[1].rel, 'noopener noreferrer');
  assert.equal(contactContainer.hidden, false);

  window.ZinaFooterContacts.render({ email: 'bad address', whatsappUrl: 'javascript:alert(1)', facebookUrl: 'https://example.org', linkedinUrl: 'http://linkedin.com/company/example' });
  assert.equal(contactContainer.children.length, 0);
  assert.equal(contactContainer.hidden, true);
});

test('all public pages load the shared contact footer', () => {
  for (const name of ['index.html', 'team.html', 'articles.html', 'events.html', 'article.html', 'event.html', 'resources.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
    assert.match(html, /<script src="footer-contacts\.js"><\/script>/, name);
  }
});
