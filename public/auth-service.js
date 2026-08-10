(function (root) {
  'use strict';

  function provider() {
    const config = root.ZinaConfig.get();
    if (config.backendProvider !== 'google-apps-script') throw new Error('Google Apps Script is the only supported ZiNa backend.');
    if (!root.GoogleAuthProvider) throw new Error('Google authentication provider is not loaded.');
    return root.GoogleAuthProvider;
  }

  root.AuthService = Object.freeze({
    getSession: () => provider().getSession(),
    getCurrentUser: () => provider().getCurrentUser(),
    signIn: () => provider().signIn(),
    signOut: () => provider().signOut(),
    onAuthStateChange: callback => provider().onAuthStateChange(callback),
    getIdToken: () => provider().getIdToken(),
    handleRejectedToken: () => provider().handleRejectedToken()
  });
})(window);
