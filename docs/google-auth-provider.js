(function (root) {
  'use strict';

  let idToken = null;
  let acquiredAt = 0;
  let currentUser = null;
  let gisPromise = null;
  let authorizationPromise = null;
  const listeners = new Set();
  const MAX_IN_MEMORY_AGE_MS = 50 * 60 * 1000;
  const RECENT_AUTHORIZATION_MS = 60 * 1000;
  const SESSION_TOKEN = 'zina-google-admin-token';
  const SESSION_ACQUIRED_AT = 'zina-google-admin-token-acquired-at';
  const SESSION_AUTHORIZED_AT = 'zina-google-admin-authorized-at';

  function clearStoredSession() {
    try {
      root.sessionStorage?.removeItem(SESSION_TOKEN);
      root.sessionStorage?.removeItem(SESSION_ACQUIRED_AT);
      root.sessionStorage?.removeItem(SESSION_AUTHORIZED_AT);
    } catch (_) {}
  }

  function restoreStoredSession() {
    try {
      const storedToken = root.sessionStorage?.getItem(SESSION_TOKEN);
      const storedAt = Number(root.sessionStorage?.getItem(SESSION_ACQUIRED_AT));
      const authorizedAt = Number(root.sessionStorage?.getItem(SESSION_AUTHORIZED_AT));
      if (typeof storedToken !== 'string' || !storedToken || !Number.isFinite(storedAt) || Date.now() - storedAt >= MAX_IN_MEMORY_AGE_MS) {
        clearStoredSession();
        return;
      }
      idToken = storedToken;
      acquiredAt = storedAt;
      currentUser = Number.isFinite(authorizedAt) && Date.now() - authorizedAt < RECENT_AUTHORIZATION_MS
        ? Object.freeze({ id: 'google-administrator', email: 'Administrator Google' })
        : null;
    } catch (_) {
      clearStoredSession();
    }
  }

  function storeSession() {
    try {
      root.sessionStorage?.setItem(SESSION_TOKEN, idToken);
      root.sessionStorage?.setItem(SESSION_ACQUIRED_AT, String(acquiredAt));
      root.sessionStorage?.setItem(SESSION_AUTHORIZED_AT, String(Date.now()));
    } catch (_) {}
  }

  function showAuthorizationError() {
    const errorBox = document.getElementById('login-error');
    if (!errorBox) return;
    errorBox.textContent = 'Acest cont Google nu este autorizat pentru administrarea ZiNa.';
    errorBox.style.display = 'block';
  }

  async function verifyAdministrator() {
    if (currentUser) return true;
    if (!idToken) return false;
    if (authorizationPromise) return authorizationPromise;
    authorizationPromise = (async () => {
      try {
        const endpoint = root.ZinaConfig.get().protectedAppsScriptApiUrl;
        if (!endpoint) throw new Error('Protected API is not configured.');
        const response = await root.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'listAllArticles', idToken }),
          redirect: 'follow',
          cache: 'no-store',
          referrerPolicy: 'no-referrer'
        });
        const envelope = await response.json();
        if (!envelope || envelope.version !== 'v1' || envelope.ok !== true) throw new Error('Administrator authorization failed.');
        currentUser = Object.freeze({ id: 'google-administrator', email: 'Administrator Google' });
        storeSession();
        return true;
      } catch (_) {
        forget('SIGNED_OUT');
        showAuthorizationError();
        return false;
      } finally {
        authorizationPromise = null;
      }
    })();
    return authorizationPromise;
  }

  function emit(event) {
    const session = currentUser ? { user: currentUser } : null;
    listeners.forEach(listener => listener(event, session));
  }

  function forget(event = 'SIGNED_OUT') {
    idToken = null;
    acquiredAt = 0;
    currentUser = null;
    clearStoredSession();
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
      async callback(response) {
        if (!response || typeof response.credential !== 'string') {
          forget('SIGNED_OUT');
          return;
        }
        idToken = response.credential;
        acquiredAt = Date.now();
        currentUser = null;
        if (await verifyAdministrator()) emit('SIGNED_IN');
      }
    });
    target.replaceChildren();
    root.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', text: 'signin_with' });
  }

  restoreStoredSession();

  root.GoogleAuthProvider = Object.freeze({
    async getSession() {
      await mountLogin();
      if (idToken && Date.now() - acquiredAt >= MAX_IN_MEMORY_AGE_MS) forget('SIGNED_OUT');
      if (idToken && !currentUser) await verifyAdministrator();
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
