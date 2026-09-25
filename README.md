# Tune book

Nate's fiddle tune book, served at <https://nategrimwood.com/fiddle>.

- `public/fiddle.html` is the page. Visitors get a read-only view with notes hidden.
- `src/worker.js` is a Cloudflare Worker that serves the page, redirects `/` and `www` to `/fiddle`, and runs a small JSON API under `/fiddle/api/`.
- Data lives in a Cloudflare D1 database (binding `DB`). The Worker creates its tables on first run and fills them from `src/seed.json` once, when the database is empty. After that the database is the source of truth; `seed.json` is never re-applied.
- Editing: sign in on the page with the passphrase stored in the Worker secret `EDIT_PASSPHRASE`. Every edit saves immediately and is logged in the `edits` table, which powers "Recent changes" and undo.
- Backups: when signed in, the page footer has "Download markdown" and "Download JSON".

Pushing to `main` redeploys automatically through Cloudflare Workers Builds.

The Worker runs on zone routes for `nategrimwood.com/*` and `www.nategrimwood.com/*`, so the zone needs proxied (orange-cloud) DNS records for `@` and `www`. What they point at doesn't matter, because the Worker answers every request.

Local development: `npm install`, put `EDIT_PASSPHRASE="something"` in `.dev.vars`, then `npx wrangler dev`.
