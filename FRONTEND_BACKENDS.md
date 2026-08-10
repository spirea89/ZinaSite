# Frontend backend providers

## Production architecture

ZiNa production uses the `google-apps-script` frontend provider. Google Sheets stores CMS records, the deployed Google Apps Script Web App supplies public and protected API operations, Google Identity Services supplies administrator ID tokens, and Apps Script enforces the exact active `Admins` allowlist on every protected request.

Published media is written by Apps Script to the separate public GitHub media repository and served through GitHub Pages. The browser cannot select the media repository, branch, path, blob SHA, or GitHub credential.

Supabase is not loaded or supported by the production frontend and cannot become active because Google configuration is missing. The remote Supabase project and historical schema files are left untouched only for separate later cleanup; they are not a rollback database and contain no production data.

## Production runtime configuration

The tracked `public/zina-runtime-config.js` is intentionally empty and contains no deployment identifiers. `.github/workflows/deploy-pages.yml` builds the Pages artifact and replaces that file using these GitHub Actions secrets:

- `ZINA_PUBLIC_APPS_SCRIPT_API_URL`
- `ZINA_PROTECTED_APPS_SCRIPT_API_URL`
- `ZINA_GOOGLE_OAUTH_CLIENT_ID`

The workflow always writes `backendProvider: 'google-apps-script'`. It rejects missing or malformed Apps Script URLs and OAuth client IDs before uploading a Pages artifact. `public/zina-config.js` independently validates the same values in the browser. Missing configuration fails with a clear configuration error; it never selects Supabase.

The OAuth client ID and Apps Script URLs are browser-visible configuration, not cryptographic secrets, but real ZiNa values remain outside Git under the project policy. OAuth client secrets, Google tokens, administrator identifiers, spreadsheet IDs, deployment credentials, and GitHub media credentials must never be committed.

## Administrator and write safety

Google Identity Services obtains a Google ID token. It remains in memory/current-tab session handling only and is cleared on logout, expiry, or backend rejection. Apps Script verifies the token and checks the active administrator row on every protected request.

The provider preserves the Apps Script action contract for articles, categories, events, team members, homepage content, and media. Updates and destructive operations use `expectedUpdatedAt`; creates and destructive retries use cryptographic idempotency keys. Conflicts and uncertain write states require review rather than silently overwriting data. Rich HTML is validated by Apps Script and sanitized again before frontend rendering.

## Supabase status

Supabase was used only for development and test data. No content migration, synchronization, reconciliation, or production rollback is required. The Supabase frontend client, server API routes, environment configuration, and package dependencies have been removed. Historical SQL and setup documents remain solely as development history until the remote Supabase project is cleaned up separately.

## Local development

For a production-like local session, run the Express static server with the four Google environment variables from an untracked shell environment. A plain static server will deliberately show a configuration error because it cannot inject production runtime values.

The Express server no longer exposes Supabase `/api` routes. All CMS operations use the selected browser provider; production uses Apps Script.
