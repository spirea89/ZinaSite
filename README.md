# ZinaSite

Basic website and admin tool for ZusammenInAustria (Zina), a non-profit connecting Romanian expats in Vienna.

## Getting started

```bash
npm install
npm start
```

The site will be available at http://localhost:3000. Use `/admin.html` to create, edit, save drafts, and publish articles.

## Netlify Identity & Decap CMS

- The admin UI is available at `/admin/` (Decap CMS) and requires Netlify Identity login for invited users (no GitHub accounts needed).
- Content is stored as Markdown in `data/articles/` with frontmatter fields for title, date, author, summary, lang, status, and body.
- Media uploads are saved to `public/uploads/` (exposed at `/uploads`).
- Deploy with Netlify using `netlify.toml` (build: `npm run build:pages`, publish: `docs`). Redirects protect `/admin/` so only authenticated users with the `admin` role can access.

## GitHub Pages workflow

- `public/` is the single source of truth for all frontend assets (HTML, CSS, logos, static JSON). Do not edit `docs/` directly.
- Build the GitHub Pages output with:
  ```bash
  npm run build:pages
  ```
  This command clears `docs/` and copies the contents of `public/` into it while preserving the folder structure for relative asset paths.
- A GitHub Actions workflow (`.github/workflows/pages.yml`) runs on every push to `main`, installs dependencies, builds `docs/`, and deploys the generated artifact to GitHub Pages.
