(function (root) {
  'use strict';

  let homepageRequest = null;

  function safeEmail(value) {
    const email = String(value || '').trim();
    return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email) ? email : '';
  }

  function safeProviderUrl(value, allowedHosts) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && allowedHosts.includes(url.hostname.toLowerCase()) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function addLink(container, label, href) {
    if (!href) return;
    const link = root.document.createElement('a');
    link.className = 'footer-contact-link';
    link.textContent = label;
    link.href = href;
    if (!href.startsWith('mailto:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    container.appendChild(link);
  }

  function addText(container, text) {
    if (!text) return;
    const item = root.document.createElement('span');
    item.className = 'footer-contact-text';
    item.textContent = text;
    container.appendChild(item);
  }

  function render(contacts) {
    const footer = root.document.querySelector('.footer .footer-content');
    if (!footer) return;
    let container = footer.querySelector('.footer-contact-links');
    if (!container) {
      container = root.document.createElement('nav');
      container.className = 'footer-contact-links';
      container.setAttribute('aria-label', 'Contact');
      footer.appendChild(container);
    }
    container.replaceChildren();
    const values = contacts || {};
    const email = safeEmail(values.email);
    addLink(container, 'Email', email ? `mailto:${email}` : '');
    addLink(container, 'WhatsApp', safeProviderUrl(values.whatsappUrl, ['chat.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com']));
    addLink(container, 'Facebook', safeProviderUrl(values.facebookUrl, ['facebook.com', 'www.facebook.com']));
    addLink(container, 'LinkedIn', safeProviderUrl(values.linkedinUrl, ['linkedin.com', 'www.linkedin.com']));
    addLink(container, 'YouTube', safeProviderUrl(values.youtubeUrl, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']));
    const zvrNumber = /^[0-9]{1,10}$/.test(String(values.zvrNumber || '')) ? String(values.zvrNumber) : '';
    addText(container, zvrNumber ? `ZVR: ${zvrNumber}` : '');
    container.hidden = !container.children.length;
  }

  function getHomepage() {
    if (!homepageRequest) homepageRequest = root.DataService.getHomepageContent();
    return homepageRequest;
  }

  async function load() {
    try {
      const homepage = await getHomepage();
      if (root.I18n?.setLanguageSettings) root.I18n.setLanguageSettings(homepage?.content?.languageSettings);
      render(homepage?.content?.contacts);
      return homepage;
    } catch (error) {
      console.warn('Datele de contact nu au putut fi încărcate.', error);
      return null;
    }
  }

  root.ZinaFooterContacts = Object.freeze({ render, load, getHomepage });
  load();
})(window);
