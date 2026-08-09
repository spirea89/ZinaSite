# ZiNa Cloud Run protected API

Checkpoint C2 adds local-only authentication and authorization scaffolding. It exposes `GET /health` and an authenticated `POST /v1/admin` route with five read actions backed only by empty or test-supplied in-memory repositories. Google Sheets, Cloud Storage, writes, optimistic concurrency, and deployments remain deferred.

## Local commands

```bash
pnpm install
pnpm typecheck
pnpm test:run
pnpm build
pnpm start
```

Copy `.env.example` to `.env` only for local configuration. `.env` files are ignored. Supply `GOOGLE_OAUTH_CLIENT_ID` and a comma-separated `ALLOWED_ADMIN_ORIGINS` at runtime. Never store real OAuth values, administrator identities, spreadsheet IDs, deployment URLs, credentials, or tokens in this directory.

## C2 boundaries

- Bearer tokens are verified through an isolated `google-auth-library` adapter.
- The default Admins directory is empty, so authorization fails closed.
- Only `listAllArticles`, `listArticleCategories`, `listAllEvents`, `listTeamMembers`, and `getHomepageContent` are registered.
- The in-memory repository is read-only and contains no real ZiNa data.
- Tests use fake verifier identities rather than real Google tokens or network calls.
- Later checkpoints will replace mock directories/repositories with Google Sheets access and add optimistic concurrency before writes.
