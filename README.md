# ZinaSite

Basic website and admin tool for ZusammenInAustria (Zina), a non-profit connecting Romanian expats in Vienna.

## Getting started

```bash
npm install
npm start
```

The site will be available at http://localhost:3000. Use `/admin.html` to create, edit, save drafts, and publish articles.

## GitHub Pages workflow

- `public/` is the single source of truth for all frontend assets (HTML, CSS, logos, static JSON). Do not edit `docs/` directly.
- Build the GitHub Pages output with:
  ```bash
  npm run build:pages
  ```
  This command clears `docs/` and copies the contents of `public/` into it while preserving the folder structure for relative asset paths.
- A GitHub Actions workflow (`.github/workflows/pages.yml`) runs on every push to `main`, installs dependencies, builds `docs/`, and deploys the generated artifact to GitHub Pages.
