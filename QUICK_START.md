# Quick start

ZiNa uses Google Sheets + Google Apps Script in production.

1. Keep the real Apps Script URLs and Google OAuth client ID outside Git.
2. Supply them locally through environment variables documented in `.env.example`, or in production through the three GitHub Actions secrets documented in `FRONTEND_BACKENDS.md`.
3. Run `npm install`, then `npm start`.
4. Run `npm test` and `npm run check:frontend` before publishing.

Supabase is not required.
