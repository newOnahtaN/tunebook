# Tune book

Nate's fiddle tune book, served at <https://nategrimwood.com/fiddle>.

- `public/fiddle.html` is the page. Visitors get a read-only view with notes hidden.
- `public/fiddle/gaps.html` (at `/fiddle/gaps`) is a separate, editor-only-linked page showing what data is missing
  for each tune (no type, no traditions, no region, no recordings, and so on). Gap information is kept off the main
  page on purpose. `public/fiddle/vocab.js` holds the shared genre tree, tune-type definitions and style-tag
  vocabulary used by both pages.
- `public/fiddle/hearings.js` shares the "heard" rule between the main page and Markdown exports: lessons and
  classes are logged, but only non-teaching encounters count as heard. "First encounter"/"From" and the gaps
  page's "No encounter logged" check still include lessons and classes; the JSON export retains the complete log.
- `src/worker.js` is a Cloudflare Worker that serves the page, redirects `/` and `www` to `/fiddle`, and runs a small JSON API under `/fiddle/api/`.
- Data lives in a Cloudflare D1 database (binding `DB`). The Worker creates its tables on first run and fills them from `src/seed.json` once, when the database is empty. After that the database is the source of truth; `seed.json` is never re-applied.
- Editing: sign in with Google or a passkey. Every edit saves immediately and is logged in the `edits` table, which powers "Recent changes" and undo.
  - Google: the page shows a "Sign in with Google" button using the public client ID in `wrangler.jsonc` (`GOOGLE_CLIENT_ID`, Google Cloud project "Tune Book"). The Worker checks Google's signature and only accepts the accounts in `EDITOR_EMAILS`. No client secret is involved.
  - Passkeys: once signed in, "Sign-in and passkeys" (bottom of the page) adds a passkey for this device. Passkeys are stored in the `passkeys` table and checked in `src/auth.js` with WebCrypto (no dependencies).
  - Sessions last 400 days and renew themselves. They're signed with a random key in `meta.session_key`; "Sign out on all other devices" replaces that key.
- Drive recordings: the Worker reads the Drive "Fiddle" folder (`DRIVE_FOLDER_ID`) read-only through a Google service account whose JSON key is the Worker secret `GOOGLE_SERVICE_ACCOUNT` (the folder is shared with that account as Viewer). A scan (daily cron, or "Rescan Drive now") records audio, PDF and video files in the `media` table and links new files to tunes by name (`src/media.js`; tunes' "Also known as" names count too). Links live in `media_links`; unlinking by hand is remembered, so rescans never undo manual choices. Files are streamed through `/fiddle/api/media/<id>/<signed token>/<name>`, which is what lets Android hand them to another app (Open in app / Share).
- Backups: when signed in, the page footer has "Download markdown" and "Download JSON".

Pushing to `main` redeploys automatically through Cloudflare Workers Builds.

The Worker runs on zone routes for `nategrimwood.com/*` and `www.nategrimwood.com/*`, so the zone needs proxied (orange-cloud) DNS records for `@` and `www`. What they point at doesn't matter, because the Worker answers every request.

Tests: `npm test` runs the unit tests for Google token and passkey checks.

Local development: `npm install`, then `npm run dev` (it passes `--local-upstream localhost:8787` so the Worker sees `localhost` rather than the real domain, which passkeys need). Real Google sign-in only works on the live site; locally, set `GOOGLE_CERTS_URL` in `.dev.vars` to a test key set and mint your own tokens.
