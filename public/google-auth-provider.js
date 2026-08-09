(function (root) {
  'use strict';

  let idToken = null;
  let acquiredAt = 0;
  let currentUser = null;
  let gisPromise = null;
  const listeners = new Set();
  const MAX_IN_MEMORY_AGE_MS = 50 * 60 * 1000;

  function emit(event) {
    const session = currentUser ? { user: currentUser } : null;
    listeners.forEach(listener => listener(event, session));
  }

  function forget(event = 'SIGNED_OUT') {
    idToken = null;
    acquiredAt = 0;
    currentUser = null;
    if (root.google?.accounts?.id) root.google.accounts.id.disableAutoSelect();
    emit(event);
  }

  function loadGis() {
    if (root.google?.accounts?.id) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.referrerPolicy = 'no-referrer';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Google Sign-In could not be loaded.'));
      document.head.appendChild(script);
    });
    return gisPromise;
  }

  async function mountLogin() {
    if (!root.ZinaConfig?.isGoogle()) return;
    const config = root.ZinaConfig.get();
    if (!config.googleOAuthClientId) throw new Error('Google Sign-In is not configured.');
    const form = document.getElementById('login-form');
    if (!form) return;
    form.style.display = 'none';
    let target = document.getElementById('google-signin-container');
    if (!target) {
      target = document.createElement('div');
      target.id = 'google-signin-container';
      target.setAttribute('aria-label', 'Google administrator sign-in');
      form.insertAdjacentElement('afterend', target);
    }
    await loadGis();
    root.google.accounts.id.initialize({
      client_id: config.googleOAuthClientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback(response) {
        if (!response || typeof response.credential !== 'string') {
          forget('SIGNED_OUT');
          return;
        }
        idToken = response.credential;
        acquiredAt = Date.now();
        currentUser = Object.freeze({ id: 'google-administrator', email: 'Administrator Google' });
        emit('SIGNED_IN');
      }
    });
    target.replaceChildren();
    root.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', text: 'signin_with' });
  }

  root.GoogleAuthProvider = Object.freeze({
    async getSession() {
      await mountLogin();
      if (idToken && Date.now() - acquiredAt >= MAX_IN_MEMORY_AGE_MS) forget('SIGNED_OUT');
      return currentUser ? { user: currentUser } : null;
    },
    async getCurrentUser() {
      return (await this.getSession())?.user || null;
    },
    async signIn() {
      await mountLogin();
      if (!currentUser) throw new Error('Use the Google Sign-In button.');
      return { user: currentUser, session: { user: currentUser } };
    },
    async signOut() {
      forget('SIGNED_OUT');
      await mountLogin();
      return true;
    },
    onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } }, unsubscribe: () => listeners.delete(callback) };
    },
    async getIdToken() {
      await this.getSession();
      if (!idToken) throw new Error('Google authentication is required. Sign in again.');
      return idToken;
    },
    handleRejectedToken() {
      forget('SIGNED_OUT');
      mountLogin().catch(() => {});
    },
    mountLogin
  });
})(window);
