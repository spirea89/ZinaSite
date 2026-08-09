(function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    backendProvider: 'supabase',
    publicAppsScriptApiUrl: '',
    protectedAppsScriptApiUrl: '',
    googleOAuthClientId: ''
  });

  function get() {
    const supplied = root.__ZINA_RUNTIME_CONFIG || {};
    const config = { ...DEFAULTS, ...supplied };
    if (config.backendProvider !== 'supabase' && config.backendProvider !== 'google-apps-script') {
      throw new Error('Invalid ZiNa backend provider configuration.');
    }
    return Object.freeze(config);
  }

  root.ZinaConfig = Object.freeze({
    defaults: DEFAULTS,
    get,
    isGoogle: () => get().backendProvider === 'google-apps-script'
  });
})(window);
