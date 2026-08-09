# ZiNa CMS Google Apps Script bootstrap

This directory contains the spreadsheet/Drive bootstrap and the Phase 2 backend API for a Google spreadsheet named **ZiNa CMS**. Phase 2 adds backend code and non-destructive self-tests, but does not deploy the API, connect the website, upload images, migrate data, or change the existing Supabase site.

## Install the bootstrap script

1. Open the blank **ZiNa CMS** spreadsheet in Google Sheets.
2. Choose **Extensions → Apps Script**. This creates a script project bound to that spreadsheet.
3. Open the default `Code.gs` file in the Apps Script editor. Replace its placeholder contents with the complete contents of this repository's `google-apps-script/Code.gs`, then save.
4. In Apps Script, open **Project Settings** (the gear icon) and enable **Show "appsscript.json" manifest file in editor**.
5. Open `appsscript.json` in the editor. Replace its contents with the complete contents of this repository's `google-apps-script/appsscript.json`, then save.
6. Select `setupZinaCms` in the function selector and click **Run**.

For Phase 2, also create Apps Script files named `Api.gs`, `Auth.gs`, `Repository.gs`, `Validation.gs`, and `Tests.gs`. Copy the complete contents of each matching `.gs` file from this directory into the Apps Script editor. Apps Script combines all `.gs` files in the project; their displayed order is not significant.

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

Do not put the client ID in a worksheet or commit it to this repository. The backend fails closed when this property is absent. Administrator email addresses are managed later in the private `Admins` worksheet, not in source files.

## Run the Phase 2 self-tests

Select `runPhase2SelfTests` in the Apps Script function selector and click **Run**. The tests exercise routing, validation, claim checks, authorization decisions, and response redaction using fake claims and placeholder values. They do not change spreadsheet rows or Drive files, do not contact Google, and do not require a real token, client ID, or administrator email.

The function returns a success envelope when all tests pass and throws a summarized error if any test fails.

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

Every protected request must contain a fresh Google ID token. An `origin` value supplied by a browser is not accepted and would not be a security boundary. Verified Google identity plus the active `Admins` allowlist is the authorization boundary.

Responses consistently contain `ok`, `data`, `error`, and `version`. Errors do not expose stack traces, tokens, configuration values, administrator lists, or spreadsheet internals.

## Token-verification limitation

This testing phase verifies tokens through Google's HTTPS `tokeninfo` endpoint. Google primarily documents `tokeninfo` as a development/debugging facility. Verification is isolated in `verifyGoogleIdToken_` so it can be replaced with a production-grade JWT verifier or authenticated proxy before launch.

Do not treat this implementation as the final production verification architecture.

## Keep secrets out of source control

Never paste passwords, password hashes, OAuth access or refresh tokens, ID tokens, API keys, OAuth client IDs, client secrets, administrator email addresses, session values, private spreadsheet links, deployment URLs, or deployment credentials into these files or GitHub. The `Admins` worksheet intentionally contains identity and status fields only; it must not contain authentication secrets.

## Deferred phases

Web-app deployment, website Google Sign-In, administrator email configuration, authenticated media uploads, data migration, production token verification, website integration, and removal of Supabase are intentionally deferred. The current Supabase implementation remains untouched and operational.

When deployment is eventually approved, deployment settings and access level must be reviewed deliberately in Apps Script. Do not deploy the project during Phase 2.
