(function () {
  'use strict';

  const navbar = document.querySelector('.navbar');
  const container = navbar?.querySelector('.nav-container');
  const links = navbar?.querySelector('.nav-links');
  if (!navbar || !container || !links) return;

  links.id = links.id || 'site-navigation';
  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', links.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Deschide meniul');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  container.insertBefore(toggle, links);

  function closeMenu() {
    navbar.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Deschide meniul');
  }

  toggle.addEventListener('click', () => {
    const opening = !navbar.classList.contains('menu-open');
    navbar.classList.toggle('menu-open', opening);
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.setAttribute('aria-label', opening ? 'Închide meniul' : 'Deschide meniul');
  });

  links.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!navbar.contains(event.target)) closeMenu();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMenu();
  });
})();
