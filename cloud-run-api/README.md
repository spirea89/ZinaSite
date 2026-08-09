# ZiNa Cloud Run protected API

Checkpoint C1 is a local-only TypeScript skeleton. It exposes only `GET /health`. Authentication, Google Sheets, Cloud Storage, CORS, administrator actions, optimistic concurrency, and deployments are deliberately deferred.

## Local commands

```bash
pnpm install
pnpm typecheck
pnpm test:run
pnpm build
pnpm start
```

Copy `.env.example` to `.env` only for local non-sensitive overrides. `.env` files are ignored. Never store OAuth values, administrator identities, spreadsheet IDs, deployment URLs, credentials, or tokens in this directory.

## C1 boundaries

- The action dispatcher is internal and has no HTTP route yet.
- The in-memory repository is read-only and contains no real ZiNa data.
- Only the health route is registered.
- Later checkpoints will add authentication and authorization before exposing protected actions.
