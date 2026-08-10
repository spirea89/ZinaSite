# GitHub Pages deployment

ZiNa production is deployed by `.github/workflows/deploy-pages.yml`.

The workflow copies `public/` into the Pages artifact, injects validated Google Apps Script runtime configuration from GitHub Actions secrets, and stops before upload if any required value is absent or malformed. Supabase is not part of the Pages build or runtime.

See `FRONTEND_BACKENDS.md` for required configuration and security constraints.
