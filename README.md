# ZinaSite

Basic website and admin tool for ZusammenInAustria (Zina), a non-profit connecting Romanian expats in Vienna.

## Getting started

```bash
npm install
npm start
```

The site will be available at http://localhost:3000. Use `/admin.html` to create, edit, save drafts, and publish articles.

## Supabase setup

You can connect the API to Supabase for persistent article storage. Create a Supabase project, add an `articles` table, and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a local `.env` file. Detailed steps live in [`SUPABASE.md`](SUPABASE.md).

## Admin experience

- The admin UI is available at `/admin.html` and talks to Supabase (or the local JSON fallback) via the Express API.
- Media uploads are saved to `public/uploads/` (exposed at `/uploads`).

## GitHub Pages workflow

- `public/` is the single source of truth for all frontend assets (HTML, CSS, logos, static JSON). Do not edit `docs/` directly.
- Build the GitHub Pages output with:
  ```bash
  npm run build:pages
  ```
  This command clears `docs/` and copies the contents of `public/` into it while preserving the folder structure for relative asset paths.
- A GitHub Actions workflow (`.github/workflows/pages.yml`) runs on every push to `main`, installs dependencies, builds `docs/`, and deploys the generated artifact to GitHub Pages.
