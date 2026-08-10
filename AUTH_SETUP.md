# Administrator authentication

Production administrator authentication uses Google Identity Services and the Apps Script `Admins` worksheet.

Apps Script verifies the Google ID token and requires an exact, active administrator match on every protected request. Passwords and password hashes are not stored in Sheets. Real OAuth configuration and administrator identifiers remain outside Git.

See `FRONTEND_BACKENDS.md` and `google-apps-script/README.md` for the current architecture and controlled setup procedure.
