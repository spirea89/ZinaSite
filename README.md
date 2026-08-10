# ZinaSite

Website and administration interface for ZusammenInAustria (ZiNa), a nonprofit connecting Romanian families and expats in Vienna.

## Production

The static website is deployed with GitHub Pages. Production content and administrator operations use Google Sheets and Google Apps Script. Administrator login uses Google Identity Services, and published media is written by Apps Script to the separate public `zina-media` repository for GitHub Pages delivery.

Real Apps Script URLs, the Google OAuth client ID, spreadsheet identifiers, administrator identities, and write credentials are not stored in this repository. The Pages deployment workflow receives the required browser configuration from GitHub Actions secrets and fails before deployment if it is missing or malformed.

See [FRONTEND_BACKENDS.md](FRONTEND_BACKENDS.md) for the production architecture, runtime configuration, security behavior, and rollback procedure. See [google-apps-script/README.md](google-apps-script/README.md) for backend setup and schema details.

## Local server

Install dependencies and supply runtime configuration through the shell or an untracked `.env` file:

```text
ZINA_BACKEND_PROVIDER=google-apps-script
ZINA_PUBLIC_APPS_SCRIPT_API_URL=<public /exec URL>
ZINA_PROTECTED_APPS_SCRIPT_API_URL=<protected /exec URL>
ZINA_GOOGLE_OAUTH_CLIENT_ID=<OAuth web client ID>
```

Then run:

```bash
npm install
npm start
```

The server serves static frontend assets and a generated runtime configuration file. It does not host a CMS API.

## Supabase status

Supabase contained development/test data only. Its frontend integration, server routes, configuration, and dependencies are removed; no migration or production rollback is required. Historical SQL files remain for reference, and no remote Supabase tables, storage, project resources, or credentials are deleted by this repository cutover.

## Validation

```bash
npm test
npm run check:frontend
```
