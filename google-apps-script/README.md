# ZiNa CMS Google Apps Script bootstrap

This directory contains Phase 1 only: a safe, repeatable setup script for a blank Google spreadsheet named **ZiNa CMS**. It does not deploy an API, authenticate administrators, upload content, migrate data, or change the existing website.

## Install the bootstrap script

1. Open the blank **ZiNa CMS** spreadsheet in Google Sheets.
2. Choose **Extensions → Apps Script**. This creates a script project bound to that spreadsheet.
3. Open the default `Code.gs` file in the Apps Script editor. Replace its placeholder contents with the complete contents of this repository's `google-apps-script/Code.gs`, then save.
4. In Apps Script, open **Project Settings** (the gear icon) and enable **Show "appsscript.json" manifest file in editor**.
5. Open `appsscript.json` in the editor. Replace its contents with the complete contents of this repository's `google-apps-script/appsscript.json`, then save.
6. Select `setupZinaCms` in the function selector and click **Run**.

## Authorization prompts

The first run asks you to authorize the script to:

- edit only the spreadsheet to which the script is bound; and
- inspect the spreadsheet's Google Drive parent folder and create/reuse the ZiNa media folders there.

Google may display an "unverified app" warning because this is your private script rather than a publicly verified application. Confirm that you are authorizing the Apps Script project you just created. Do not continue if the project name or requested access is unexpected.

The Drive permission is broad because Apps Script's built-in `DriveApp` service does not offer a folder-limited OAuth scope. The code uses it only for the bound spreadsheet's parent folder and the ZiNa folders beneath it.

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

## Keep secrets out of source control

Never paste passwords, password hashes, OAuth access or refresh tokens, API keys, client secrets, session values, private spreadsheet links, or deployment credentials into these files or GitHub. The `Admins` worksheet intentionally contains identity and status fields only; it must not contain authentication secrets.

## Deferred phases

API/web-app deployment, Google Sign-In, administrator email configuration, authenticated uploads, data migration, and removal of Supabase are intentionally deferred. The current Supabase implementation remains untouched and operational.
