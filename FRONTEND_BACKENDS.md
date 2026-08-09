# Frontend backend providers

ZiNa's static frontend supports two CMS providers during migration:

- `supabase` — the default and current production/rollback provider.
- `google-apps-script` — the A4 test provider for the isolated Google Sheet backend.

The tracked `public/zina-runtime-config.js` contains no identifiers and leaves the provider at its safe Supabase default. When the local Express server is used, configuration is supplied at runtime with environment variables:

```text
ZINA_BACKEND_PROVIDER=supabase
ZINA_PUBLIC_APPS_SCRIPT_API_URL=
ZINA_PROTECTED_APPS_SCRIPT_API_URL=
ZINA_GOOGLE_OAUTH_CLIENT_ID=
```

Real OAuth client IDs and Apps Script URLs must remain outside Git. The OAuth client ID is public browser configuration, not a secret, but ZiNa still treats its real deployment value as private configuration. No OAuth client secret is used.

## Google administrator session

Google Identity Services is loaded only when the Google provider is selected. The ID token is held in a JavaScript closure and is never written to local storage, session storage, cookies, URLs, logs, or rendered markup. Logout, expiry, or backend rejection clears it. Navigating between the current standalone admin pages requires another Google sign-in because tokens deliberately do not survive page loads.

## Write safety

The Google provider caches the `updatedAt` value returned by protected reads and supplies it as top-level `expectedUpdatedAt` metadata. Create and delete requests receive cryptographically random idempotency keys. A key is reused only after an uncertain response for the same action, target, and normalized payload.

`CONFLICT` and `WRITE_STATE_UNCERTAIN` reload current server state and raise a review-required error. They are never silently retried with new safety metadata.

## Media limitation

The A5B isolated provider can upload, list, replace, and soft-delete JPEG, PNG, and WebP files through protected Apps Script actions into a separate public GitHub media repository. `admin-media-prototype.html` exposes these controls only when the Google test provider is explicitly selected. Existing Supabase Storage uploads remain unchanged in the default provider.

Real Apps Script URLs and OAuth configuration remain runtime-only. GitHub repository configuration and the write credential are backend-only Script Properties. Published URLs use GitHub Pages and never depend on ZiNaSite repository visibility. Production remains on Supabase until explicit media cutover approval.

## Content security

Google Apps Script validates rich HTML before storage. The frontend additionally sanitizes approved article/event markup before inserting it into the DOM. The Express server sends CSP, referrer, permissions, and MIME-sniffing headers. The CSP still needs `unsafe-inline` because the legacy static pages contain inline scripts and styles; removing that exception requires extracting those blocks in a later dedicated hardening checkpoint.
