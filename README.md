# Tune book

Nate's fiddle tune book, served at <https://nategrimwood.com/fiddle>.

- `public/fiddle.html` is the page. Visitors get a read-only view with notes hidden.
- Research references are public. Personal references (`origin = 'mine'`) and Drive recordings are only
  included for signed-in editors; authenticated JSON backups retain all references.
- `public/fiddle/gaps.html` (at `/fiddle/gaps`) is a separate, editor-only-linked page showing what data is missing
  for each tune (no type, no traditions, no region, no recordings, and so on). Gap information is kept off the main
  page on purpose. `public/fiddle/vocab.js` holds the shared genre tree, tune-type definitions and style-tag
  vocabulary used by both pages.
- `src/worker.js` is a Cloudflare Worker that serves the page, redirects `/` and `www` to `/fiddle`, and runs a small JSON API under `/fiddle/api/`.
- Data lives in a Cloudflare D1 database (binding `DB`). The Worker creates its tables on first run and fills them from `src/seed.json` once, when the database is empty. After that the database is the source of truth; `seed.json` is never re-applied.
- Editing: sign in with Google or a passkey. Every edit saves immediately and is logged in the `edits` table, which powers "Recent changes" and undo.
  - Google: the page shows a "Sign in with Google" button using the public client ID in `wrangler.jsonc` (`GOOGLE_CLIENT_ID`, Google Cloud project "Tune Book"). The Worker checks Google's signature and only accepts the accounts in `EDITOR_EMAILS`. No client secret is involved.
  - Passkeys: once signed in, "Sign-in and passkeys" (bottom of the page) adds a passkey for this device. Passkeys are stored in the `passkeys` table and checked in `src/auth.js` with WebCrypto (no dependencies).
  - Sessions last 400 days and renew themselves. They're signed with a random key in `meta.session_key`; "Sign out on all other devices" replaces that key.
- Drive recordings: the Worker reads the Drive "Fiddle" folder (`DRIVE_FOLDER_ID`) read-only through a Google service account whose JSON key is the Worker secret `GOOGLE_SERVICE_ACCOUNT` (the folder is shared with that account as Viewer). A scan (daily cron, or "Rescan Drive now") records audio, PDF and video files in the `media` table and links new files to tunes by name (`src/media.js`; tunes' "Also known as" names count too). Links live in `media_links`; unlinking by hand is remembered, so rescans never undo manual choices. Files are streamed through `/fiddle/api/media/<id>/<signed token>/<name>`, which is what lets Android hand them to another app (Open in app / Share).
- Backups: when signed in, the page footer has "Download markdown" and "Download JSON".

Pushing to `main` redeploys automatically through Cloudflare Workers Builds.

**Recording-quality delivery status (Sep 29, 2026):** this session pushes directly to the GitHub repository's
`naowen-microsoft-recording-quality` feature branch, **not to `main`**. The curation skill, documentation and
personal-reference privacy fix are pushed there but have not been merged into `main`; the privacy fix is not
deployed. The Angeline the Baker recording additions are already live because they were imported separately
through the signed-in editor API. A feature-branch push is not a production deployment. Update this note when
the branch is merged or its deployment status changes.

The Worker runs on zone routes for `nategrimwood.com/*` and `www.nategrimwood.com/*`, so the zone needs proxied (orange-cloud) DNS records for `@` and `www`. What they point at doesn't matter, because the Worker answers every request.

Tests: `npm test` runs recording-visibility regression tests against the Worker API using synthetic D1
results, including signed-out, signed-in, invalid/expired-session and JSON-backup behavior.

Recording enrichment: use [the recording-curation skill](.github/skills/recording-curation/SKILL.md) alongside
ROADMAP A3. It separates factual verification, evidence-based selection and Nate's listening verdict.

Direct D1 diagnostics on Nate's Windows workstation were authorized on Sep 29, 2026 using Wrangler OAuth
with account/user lookup and D1 permissions, protected by Windows Credential Manager. No token belongs in
the repository or chat. The workstation's Node 20 is too old for current Wrangler, and the pinned 4.139.0
was unavailable when checked; this cached-tool invocation works without replacing the system Node:

```powershell
npx --yes --package=node@22 --package=wrangler@4.136.3 -- wrangler d1 info tunebook
```

This uses the existing workstation login, not a `--profile` flag. Database diagnostics do not deploy the
Worker or import recording data; enrichment writes still use the signed-in editor API.

Local development: `npm install`, then `npm run dev` (it passes `--local-upstream localhost:8787` so the Worker sees `localhost` rather than the real domain, which passkeys need). Real Google sign-in only works on the live site; locally, set `GOOGLE_CERTS_URL` in `.dev.vars` to a test key set and mint your own tokens.
