# ZiNa CMS Google Apps Script bootstrap

This directory contains the spreadsheet/Drive bootstrap and the Apps Script backend API for a Google spreadsheet named **ZiNa CMS**. Authentication hardening A1 adds stricter Google ID-token and administrator checks, but does not deploy the API, connect the website, upload images, migrate data, or change the existing Supabase site.

## Install the bootstrap script

1. Open the blank **ZiNa CMS** spreadsheet in Google Sheets.
2. Choose **Extensions → Apps Script**. This creates a script project bound to that spreadsheet.
3. Open the default `Code.gs` file in the Apps Script editor. Replace its placeholder contents with the complete contents of this repository's `google-apps-script/Code.gs`, then save.
4. In Apps Script, open **Project Settings** (the gear icon) and enable **Show "appsscript.json" manifest file in editor**.
5. Open `appsscript.json` in the editor. Replace its contents with the complete contents of this repository's `google-apps-script/appsscript.json`, then save.
6. Select `setupZinaCms` in the function selector and click **Run**.

Also create Apps Script files named `Api.gs`, `Auth.gs`, `Repository.gs`, `Validation.gs`, `WriteSafety.gs`, and `Tests.gs`. Copy the complete contents of each matching `.gs` file from this directory into the Apps Script editor. Apps Script combines all `.gs` files in the project; their displayed order is not significant.

## Authorization prompts

The first run asks you to authorize the script to:

- edit only the spreadsheet to which the script is bound; and
- inspect the spreadsheet's Google Drive parent folder and create/reuse the ZiNa media folders there.

Google may display an "unverified app" warning because this is your private script rather than a publicly verified application. Confirm that you are authorizing the Apps Script project you just created. Do not continue if the project name or requested access is unexpected.

The Drive permission is broad because Apps Script's built-in `DriveApp` service does not offer a folder-limited OAuth scope. The code uses it only for the bound spreadsheet's parent folder and the ZiNa folders beneath it.

Phase 2 also requests permission to contact an external HTTPS service. It is used only to send Google ID tokens to Google's `tokeninfo` endpoint for verification.

## Verify the result

After a successful run, verify that the spreadsheet contains these worksheets:

- `Articles`
- `ArticleCategories`
- `Events`
- `Admins`
- `TeamMembers`
- `HomepageContent`
- `Media`
- `Settings`
- `AuditLog`
- `Idempotency`

Each worksheet should have a formatted, frozen header row. Status columns should offer `draft` and `published`; the Admins `active` column should contain checkboxes.

In the same Google Drive parent folder as the spreadsheet, verify this folder structure:

```text
ZiNa CMS Media/
├── Homepage/
├── Team/
└── Articles/
```

The `Settings` worksheet records the Drive IDs for these four folders. The script does not make a folder public or publicly editable.

## Running setup again

It is safe to run `setupZinaCms()` repeatedly. It reuses correctly named worksheets and uniquely named Drive folders, validates existing headers, and appends newly required columns only at the end. It never deletes worksheets or content rows and never silently reorders columns.

If it finds duplicate folders, duplicate/conflicting headers, an existing folder setting that points somewhere else, or no unambiguous writable parent for the spreadsheet, it stops with a clear error. Correct the ambiguity manually before trying again.

## Configure Google authentication for later API testing

Create an OAuth 2.0 **Web application** client in the appropriate Google Cloud project. Copy only its client ID; the client secret is never used by this Apps Script backend.

In Apps Script:

1. Open **Project Settings**.
2. Under **Script properties**, add a property named `GOOGLE_OAUTH_CLIENT_ID`.
3. Paste the web client ID as its value and save it.

Do not put the client ID in a worksheet or commit it to this repository. The backend fails closed when this property is absent. Administrator identities are managed in the private `Admins` worksheet, not in source files. Every administrator row must have both the normalized Google email and the immutable Google account subject (`google_sub`), plus an explicit `active` checkbox. The backend never discovers or writes these values automatically. Duplicate email rows fail closed.

Before using A1 against an existing spreadsheet, add the `google_sub` header to `Admins` and populate each approved row manually from a controlled identity-verification procedure. Do not activate an administrator until both identity fields have been independently checked. Running `setupZinaCms()` appends the missing header without deleting rows, but production schema changes remain a deliberate later step.

## A2 schema migration (not yet approved for production)

A2 adds `updated_at` to `ArticleCategories` and adds two private worksheets:

- `AuditLog`: `timestamp`, `action`, `google_sub`, `record_type`, `record_id`, `outcome`, `error_code`
- `Idempotency`: `id`, `request_hash`, `action`, `record_type`, `target_id`, `result_id`, `state`, `created_at`, `updated_at`

Do not create these production structures until A2 is reviewed. At the approved migration checkpoint, first make a restricted backup or named Sheet version, keep all administrators inactive, copy `WriteSafety.gs` and the other reviewed A2 files into Apps Script, run `setupZinaCms()`, and verify the exact headers before creating a deployment version. Setup appends `ArticleCategories.updated_at` at the far right and creates the two missing worksheets; it does not reorder or delete existing rows. Existing category rows may initially have blank `updated_at`; the API exposes and compares `created_at` as their initial concurrency version, and the first successful category update writes `updated_at`.

`AuditLog` and `Idempotency` must remain private with the CMS spreadsheet. Neither sheet stores email addresses, tokens, OAuth client IDs, request bodies, content payloads, deployment URLs, or credentials. Idempotency keys and normalized request state are stored only as SHA-256 fingerprints plus minimal action/target/result state.

## Run the A1 self-tests

Select `runA1SelfTests` in the Apps Script function selector and click **Run**. (`runPhase2SelfTests` remains as a compatibility alias.) The tests exercise routing, validation, token shape, audience, issuer, expiry, issuance age, verified and Google-authoritative email, subject matching, duplicate/inactive administrators, verification caches, immediate administrator revocation, verification budget enforcement, and response redaction using fake claims and placeholder values. They do not change spreadsheet rows or Drive files, do not contact Google, and do not require a real token, client ID, or administrator email.

The function returns a success envelope when all tests pass and throws a summarized error if any test fails.

For A2, `runA2SelfTests()` and the compatibility `runPhase2SelfTests()` execute the expanded local-only suite. The suite uses synthetic identities, timestamps, locks, fingerprints, and payloads; it performs no Sheet mutation and no external request.

## API request format

Public reads use `doGet` with an explicit action, for example `?action=listPublishedArticles&page=1&limit=20`. Only published records are returned by public content actions.

Protected writes use `doPost`. The future static website can send JSON as `text/plain;charset=utf-8` to avoid an unnecessary browser CORS preflight:

```json
{
  "action": "setArticleStatus",
  "idToken": "fresh Google ID token",
  "id": "record UUID",
  "payload": { "status": "published" }
}
```

A2 changes the protected mutation contract. Safety metadata is top-level, not inside `payload`:

- Create actions require `idempotencyKey` and reject `expectedUpdatedAt`.
- Update, status, sort-order, and homepage actions require `expectedUpdatedAt` and reject `idempotencyKey`.
- Delete actions require both `expectedUpdatedAt` and `idempotencyKey`.
- For an existing homepage row, `expectedUpdatedAt` is its returned `updatedAt`. A first-ever homepage creation uses an explicitly present `expectedUpdatedAt: null`.
- `expectedUpdatedAt` must exactly match the returned UTC ISO timestamp. Clients must reload after `CONFLICT` or `WRITE_STATE_UNCERTAIN`.

Example update metadata:

```json
{
  "action": "setEventStatus",
  "idToken": "fresh Google ID token",
  "id": "record UUID",
  "expectedUpdatedAt": "2026-08-09T12:00:00.000Z",
  "payload": { "status": "published" }
}
```

Example delete metadata:

```json
{
  "action": "deleteEvent",
  "idToken": "fresh Google ID token",
  "id": "record UUID",
  "expectedUpdatedAt": "2026-08-09T12:00:00.000Z",
  "idempotencyKey": "fresh-random-url-safe-value"
}
```

The examples contain placeholders only. Never copy a real token, administrator identifier, URL, or record into documentation or source control.

All mutations authenticate and authorize before attempting the script write lock. Under the lock, the backend rereads and compares the target version before changing it. A stale version returns `CONFLICT`. Lock contention returns `WRITE_LOCK_TIMEOUT`. Reusing an idempotency key for different normalized input returns `IDEMPOTENCY_CONFLICT`. If the data mutation succeeds but the audit append fails, the backend returns `WRITE_STATE_UNCERTAIN`; reload before deciding whether to retry.

Hard deletion remains available because changing to archive semantics would alter the public CMS behavior. It is restricted by exact target ID, current version, a fresh idempotency key, active administrator authorization, a write lock, and an audit entry.

## A2 content-safety policy

Article content and event descriptions may contain only the allowlisted formatting elements `p`, `br`, `strong`, `b`, `em`, `i`, `u`, `s`, `ol`, `ul`, `li`, `blockquote`, `h1`, `h2`, `h3`, `a`, and `span`. Only restricted Quill formatting classes are accepted. Links must use HTTPS; link targets and relationships are tightly constrained. Scripts, embedded content, images, styles, event handlers, comments, doctypes, malformed nesting, unknown attributes, and dangerous URLs are rejected.

Titles, category labels, event locations, team fields, Drive identifiers, and homepage JSON strings are plain text and reject markup/control characters. Homepage JSON is depth- and key-constrained. Formula-injection neutralization covers leading whitespace and control characters before `=`, `+`, `-`, or `@`, and every written cell is set to text format before its value is assigned. Frontend output encoding remains necessary defense in depth when frontend integration begins.

Every protected request must contain a fresh Google ID token. An `origin` value supplied by a browser is not accepted and would not be a security boundary. Verified Google identity plus the active `Admins` allowlist is the authorization boundary.

Responses consistently contain `ok`, `data`, `error`, and `version`. Errors do not expose stack traces, tokens, configuration values, administrator lists, or spreadsheet internals.

## Token verification and operational limits

The approved zero-billing design verifies tokens through Google's HTTPS `tokeninfo` endpoint. This is a pragmatic exception for a low-volume, approximately three-administrator nonprofit CMS; Google presents `tokeninfo` as a debugging endpoint rather than a production verification library, so it remains an external availability and quota dependency.

The backend compensates by failing closed; requiring exact audience and issuer, future expiry, verified and Google-authoritative email, non-empty subject, and a maximum token age of 15 minutes; caching only successful claims under a SHA-256 token fingerprint for at most five minutes and never beyond expiry; negatively caching rejected fingerprints briefly; and enforcing a global daily tokeninfo-call budget. Raw tokens are never cache keys or persistent values. An `Admins` lookup and exact email + `google_sub` + `active` decision still occurs on every protected request, so administrator deactivation takes effect immediately even when token verification is cached.

If tokeninfo is unavailable, rate-limited, malformed, or the local verification budget is exhausted, protected requests are denied with sanitized authentication errors. The verification function remains isolated so a supported verifier can replace it later without changing the action API. Per-subject throttling is intentionally deferred until it can be implemented without retaining identity data or weakening immediate revocation.

## Keep secrets out of source control

Never paste passwords, password hashes, OAuth access or refresh tokens, ID tokens, API keys, OAuth client IDs, client secrets, administrator email addresses, session values, private spreadsheet links, deployment URLs, or deployment credentials into these files or GitHub. The `Admins` worksheet intentionally contains identity and status fields only; it must not contain authentication secrets.

## Deferred phases

Web-app deployment changes, website Google Sign-In integration, production administrator configuration, write-specific hardening, authenticated media uploads, data migration, website integration, and removal of Supabase are intentionally deferred. The current Supabase implementation remains untouched and operational.

When deployment is eventually approved, deployment settings and access level must be reviewed deliberately in Apps Script. Do not deploy the project during Phase 2.
