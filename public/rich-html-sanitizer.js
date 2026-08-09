(function (root) {
  'use strict';

  const tags = new Set(['P','BR','STRONG','B','EM','I','U','S','OL','UL','LI','BLOCKQUOTE','H1','H2','H3','A','SPAN']);
  const classes = /^(?:ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|size-(?:small|large|huge)))(?:\s+ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|size-(?:small|large|huge)))*$/;

  function sanitize(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const walk = node => {
      Array.from(node.children).forEach(child => {
        if (!tags.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent || ''));
          return;
        }
        Array.from(child.attributes).forEach(attribute => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value;
          const safeClass = name === 'class' && (child.tagName === 'P' || child.tagName === 'SPAN') && classes.test(value);
          const safeHref = name === 'href' && child.tagName === 'A' && /^https:\/\//i.test(value);
          const safeTarget = name === 'target' && child.tagName === 'A' && value === '_blank';
          const safeRel = name === 'rel' && child.tagName === 'A' && /^(?:noopener noreferrer|noreferrer noopener)$/.test(value);
          if (!safeClass && !safeHref && !safeTarget && !safeRel) child.removeAttribute(attribute.name);
        });
        if (child.tagName === 'A' && child.getAttribute('target') === '_blank') child.setAttribute('rel', 'noopener noreferrer');
        walk(child);
      });
    };
    walk(template.content);
    return template.innerHTML;
  }

  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  root.ZinaRichHtml = Object.freeze({ sanitize, escape });
})(window);
