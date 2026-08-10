(function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    backendProvider: 'google-apps-script',
    publicAppsScriptApiUrl: '',
    protectedAppsScriptApiUrl: '',
    googleOAuthClientId: ''
  });

  const WEB_APP_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const OAUTH_CLIENT_ID = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;

  function get() {
    const supplied = root.__ZINA_RUNTIME_CONFIG || {};
    const config = { ...DEFAULTS, ...supplied };
    if (config.backendProvider !== 'google-apps-script') {
      throw new Error('Invalid ZiNa backend provider configuration.');
    }
    if (!WEB_APP_URL.test(config.publicAppsScriptApiUrl) ||
        !WEB_APP_URL.test(config.protectedAppsScriptApiUrl) ||
        !OAUTH_CLIENT_ID.test(config.googleOAuthClientId)) {
      throw new Error('Required ZiNa Google production configuration is missing or invalid.');
    }
    return Object.freeze(config);
  }

  root.ZinaConfig = Object.freeze({
    defaults: DEFAULTS,
    get,
    isGoogle: () => get().backendProvider === 'google-apps-script'
  });
})(window);
