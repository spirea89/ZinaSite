const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

function runtimeConfig() {
  const provider = process.env.ZINA_BACKEND_PROVIDER || 'google-apps-script';
  return {
    backendProvider: provider,
    publicAppsScriptApiUrl: process.env.ZINA_PUBLIC_APPS_SCRIPT_API_URL || '',
    protectedAppsScriptApiUrl: process.env.ZINA_PROTECTED_APPS_SCRIPT_API_URL || '',
    googleOAuthClientId: process.env.ZINA_GOOGLE_OAUTH_CLIENT_ID || ''
  };
}

app.get('/zina-runtime-config.js', (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-store').send(
    `window.__ZINA_RUNTIME_CONFIG = Object.freeze(${JSON.stringify(runtimeConfig()).replace(/</g, '\\u003c')});`
  );
});

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.quilljs.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://cdn.quilljs.com https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "frame-src https://accounts.google.com https://www.youtube.com https://player.vimeo.com",
      "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://accounts.google.com https://oauth2.googleapis.com"
    ].join('; ')
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`ZiNa frontend server listening on port ${PORT}`);
});
