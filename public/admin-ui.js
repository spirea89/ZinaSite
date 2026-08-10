(function (root) {
  'use strict';

  function setPending(button, pending, label) {
    if (!button) return;
    if (pending) {
      if (button.dataset.adminPending === 'true') return;
      button.dataset.adminPending = 'true';
      button.dataset.adminOriginalText = button.textContent;
      button.dataset.adminWasDisabled = button.disabled ? 'true' : 'false';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.classList.add('is-pending');
      button.replaceChildren();
      const spinner = document.createElement('span');
      spinner.className = 'admin-action-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.textContent = label || 'Se salvează…';
      button.append(spinner, text);
      return;
    }
    if (button.dataset.adminPending !== 'true') return;
    button.textContent = button.dataset.adminOriginalText || '';
    button.disabled = button.dataset.adminWasDisabled === 'true';
    button.removeAttribute('aria-busy');
    button.classList.remove('is-pending');
    delete button.dataset.adminPending;
    delete button.dataset.adminOriginalText;
    delete button.dataset.adminWasDisabled;
  }

  async function withPending(button, label, operation) {
    setPending(button, true, label);
    try { return await operation(); }
    finally { setPending(button, false); }
  }

  root.AdminUi = Object.freeze({ setPending, withPending });
})(window);
