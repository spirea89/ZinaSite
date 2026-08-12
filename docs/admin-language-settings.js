(function (root) {
  'use strict';

  const defaults = Object.freeze({ ro: true, de: true, en: false });
  let current = { ...defaults };

  function normalize(value) {
    return {
      ro: true,
      de: value?.de !== false,
      en: value?.en === true
    };
  }

  function apply(settings) {
    current = normalize(settings);
    root.document.querySelectorAll('[data-language]').forEach(element => {
      const active = current[element.dataset.language] === true;
      element.hidden = !active;
      element.querySelectorAll?.('[data-required-when-enabled]').forEach(input => { input.required = active; });
    });
    return { ...current };
  }

  async function load() {
    try {
      const homepage = await root.DataService.getHomepageContent();
      return apply(homepage?.content?.languageSettings);
    } catch (error) {
      console.warn('Setările de limbă nu au putut fi încărcate; se folosesc valorile implicite.', error);
      return apply(defaults);
    }
  }

  function isEnabled(language) { return current[language] === true; }
  function get() { return { ...current }; }

  root.ZinaLanguageSettings = Object.freeze({ apply, load, isEnabled, get, defaults });
  root.document.addEventListener('DOMContentLoaded', () => apply(defaults));
})(window);
