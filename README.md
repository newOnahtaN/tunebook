# Tune book

Nate's fiddle tune book, served at <https://nategrimwood.com/fiddle>.

- `public/fiddle.html` is the page. Visitors get a read-only view with notes hidden.
- Research references are public. Personal references (`origin = 'mine'`) and Drive recordings are only
  included for signed-in editors; authenticated JSON backups retain all references.
- `public/fiddle/gaps.html` (at `/fiddle/gaps`) is a separate, editor-only-linked page showing what data is missing
  for each tune (no type, no traditions, no region, no recordings, and so on). Gap information is kept off the main
  page on purpose. `public/fiddle/vocab.js` holds the shared genre tree, tune-type definitions and style-tag
  vocabulary used by both pages.
- `public/fiddle/hearings.js` shares the "heard" rule between the main page and Markdown exports: lessons and
  classes are logged, but only non-teaching encounters count as heard. "First encounter"/"From" and the gaps
  page's "No encounter logged" check still include lessons and classes; the JSON export retains the complete log.
- Community-source badges and the **Session lists** filter are separate from personal encounter data.
  A list appearance does not mark a tune heard, played or high interest. Count notes can describe a named
  setting or a shared source row rather than an individual tune's frequency; qualified notes wrap on phones.
  See [ROADMAP A5](ROADMAP.md#a5-local-session-data-from-community-tune-lists--m-per-sync-formerly-s5)
  for source coverage, identity holds and safe resync rules.
- `src/worker.js` is a Cloudflare Worker that serves the page, redirects `/` and `www` to `/fiddle`, and runs a small JSON API under `/fiddle/api/`.
- Data lives in a Cloudflare D1 database (binding `DB`). The Worker creates its tables on first run and fills them from `src/seed.json` once, when the database is empty. After that the database is the source of truth; `seed.json` is never re-applied.
- Editing: sign in with Google or a passkey. Every edit saves immediately and is logged in the `edits` table, which powers "Recent changes" and undo.
  - Google: the page shows a "Sign in with Google" button using the public client ID in `wrangler.jsonc` (`GOOGLE_CLIENT_ID`, Google Cloud project "Tune Book"). The Worker checks Google's signature and only accepts the accounts in `EDITOR_EMAILS` (can edit) and `VIEWER_EMAILS` (invited readers: they see everything the editor sees, including private notes and Drive recordings, but every write route returns 403 for them; removing an address ends its sessions immediately). Passkeys, Drive connection and session management are editor-only. For a viewer to sign in, the Google Cloud OAuth consent screen must be published (or list them as a test user). No client secret is involved.
  - Passkeys: once signed in, "Sign-in and passkeys" (bottom of the page) adds a passkey for this device. Passkeys are stored in the `passkeys` table and checked in `src/auth.js` with WebCrypto (no dependencies).
  - Sessions last 400 days and renew themselves. They're signed with a random key in `meta.session_key`; "Sign out on all other devices" replaces that key.
- Popularity: every tune has a 1–10 score with a basis badge (local + online, local, online, hearsay, no data).
  `public/fiddle/popularity.js` holds the shared scoring, `src/popularity.js` the D1 tables (pop_lists,
  pop_evidence, pop_scores, pop_history), import and recompute. `public/fiddle/popularity.html` (at
  `/fiddle/popularity`) explains the method with live data for auditing. Evidence comes from
  `data/popularity/evidence_pipeline.js` (session sheets, The Session, `public/fiddle/popularity-jamlists.json` and
  `public/fiddle/popularity-hearsay.json`; runbook in `data/popularity/README.md`) and is
  loaded with the editor-only `POST /fiddle/api/popularity/import`; `GET /fiddle/api/popularity` is public.
  Tests: `node --test test/popularity.test.mjs`.
- High interest: signed-in editors can toggle a tune's star independently of its learning status. The
  **High interest only** checkbox combines with the other filters. Marked tunes show a read-only badge to
  visitors, and the flag is included in JSON and Markdown backups. The editor API accepts
  `PATCH /fiddle/api/tunes/:id` with `{ "field": "high_interest", "value": 1 }` (or `0` to clear it);
  creation also accepts `fields.high_interest`. Existing and new tunes default to unmarked.
- Drive recordings: the Worker reads the Drive "Fiddle" folder (`DRIVE_FOLDER_ID`) read-only through a Google service account whose JSON key is the Worker secret `GOOGLE_SERVICE_ACCOUNT` (the folder is shared with that account as Viewer). A scan (daily cron, or "Rescan Drive now") records audio, PDF and video files in the `media` table and links new files to tunes by name (`src/media.js`; tunes' "Also known as" names count too). Links live in `media_links`; unlinking by hand is remembered, so rescans never undo manual choices. Files are streamed through `/fiddle/api/media/<id>/<signed token>/<name>`, which is what lets Android hand them to another app (Open in app / Share).
- Backups: when signed in, the page footer has "Download markdown" and "Download JSON".

Pushing to `main` redeploys automatically through Cloudflare Workers Builds.

**Delivery policy (Nate, Sep 29, 2026):** this is a single-contributor, low-risk personal project. Agents should
normally validate, commit and push completed work directly to `main`, without a PR or another routine approval.
Fetch and merge other sessions' work, resolve ordinary conflicts automatically while preserving both intentions,
and retry non-forced pushes if main advances. Keep working in the session's own worktree. Never force-push,
discard other work, or bypass privacy/data safeguards. See [AGENTS.md](AGENTS.md) for the full workflow.

Git delivery and data imports are separate. A successful main push starts deployment; it is not by itself
proof the deployment finished. Tune and recording additions take effect only after a successful signed-in
editor API import.

The Worker runs on zone routes for `nategrimwood.com/*` and `www.nategrimwood.com/*`, so the zone needs proxied (orange-cloud) DNS records for `@` and `www`. What they point at doesn't matter, because the Worker answers every request.

Tests: `npm test` runs Worker API regression tests using synthetic D1 results, including recording privacy,
high-interest migration, validation, persistence, undo and backup behavior.

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
