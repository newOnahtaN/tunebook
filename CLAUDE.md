# Notes for Claude

- Follow `AGENTS.md` for delivery. Nate's standing preference is to validate completed work and push directly
  to `origin/main` without an extra PR or approval step. Fetch and integrate concurrent work, resolve ordinary
  conflicts automatically while preserving both sides' intent, and retry non-forced pushes when main advances.
  Delivery differs by device (Nate's Windows workstation has a checkout and Wrangler; cloud and mobile sessions work
  through the browser): see "Different devices, different workflows" in `AGENTS.md`. On a device with a checkout,
  stay in the session's own worktree and do not edit the shared main checkout.
- Nate's long-running goals for this site live in `ROADMAP.md`, written as a menu of projects. Read it at the start
  of any session on this repo, and update its statuses and log before you finish.
- For recording-focused enrichment, also read `.github/skills/recording-curation/SKILL.md`. For popularity work,
  read `data/popularity/README.md`. Requests Nate has queued are at the top of `ROADMAP.md` ("Up next").
- The site is a Cloudflare Worker (`src/worker.js`) with D1, plus the main page (`public/fiddle.html`), the data gaps
  page (`public/fiddle/gaps.html`, at /fiddle/gaps) and the shared vocabulary (`public/fiddle/vocab.js`: genre
  families, tune type definitions, style tags). Pushes to `main` deploy automatically.
- Delivery reports must name the pushed branch and distinguish pushed, merged, deployed and live data changes.
  A feature-branch push alone is not the default finish line and does not mean changes reached production.
  Keep any delivery-status note in `README.md` current.
- Data changes go through the editor API while signed in: `PATCH /fiddle/api/tunes/:id`, `POST /fiddle/api/tunes`,
  `POST /fiddle/api/hearings/import`, `POST /fiddle/api/research/import`, and so on.
  Public research references (`origin = 'research'`) may be public.
  Nate's own links (`origin = 'mine'`), Drive recordings, working notes, occasion details and hearing notes are
  editor-only; keep them out of anything public. Invited viewers (`VIEWER_EMAILS` in `wrangler.jsonc`) can read
  everything the editor can, but write nothing: new write routes are blocked for viewers by default (`VIEWER_GET`
  in `src/worker.js` lists the few non-data routes they may read), so never add a viewer route without thought.
  Don't put anything in editor-readable data that a viewer shouldn't see.

- **Never play audio or video in the browser pane.** It comes out of Nate's speakers. To check a recording, load
  metadata only (a muted `Audio` with `preload = 'metadata'`, never `.play()`), use YouTube's oEmbed for links, and
  never click Play buttons on the site.

## Every new tune gets fully enriched, in the same turn

Whenever a tune is added (from chat, a hearing import, promoting an unidentified tune, or a session sheet), research
it before finishing the turn, so every filter works for it. Import through `POST /fiddle/api/research/import`:

1. `type`: one of the types in `TYPE_INFO` in `vocab.js`. If it's a new type, add a plain-language definition there.
2. `genres`: every tradition where the tune is commonly played, beyond Nate's primary genre (be generous). Each must
   be in `GENRE_TREE` / `GENRE_ROOTS` in `vocab.js`; add new traditions to the tree under the right parent.
3. `tags`: style tags from `TAGS` in `vocab.js` (traditional or modern composition, crooked, cross-tuned, pipe tune,
   session standard...). Add new tags sparingly.
4. `region`, `summary` (one notable sourced fact), `sources` (URLs) and `confidence`.
5. If a good style-model recording is easy to find, add it to `refs` too (see ROADMAP A3 for the rubric).
   Prefer Nate's reference fiddlers when they cover the tune (list in ROADMAP A3), one from each when several do.
6. For a streaming link, prefer Tidal over Spotify or Apple Music (Tidal tends to embed better and Nate prefers it).
7. Popularity: add an entry for the tune to `public/fiddle/popularity-hearsay.json` (one line: `id`, `score` 1–10,
   `confidence`, `note`, `sources`, and any `recordings` found) from forum, blog and social-media sentiment, unless
   local or online evidence already covers it. Then rerun `data/popularity/evidence_pipeline.js` in a signed-in tab
   and `POST /fiddle/api/popularity/import` (it recomputes). For a hearsay-only change you can post just that tune's
   row. Runbook and the hearsay scoring rubric: `data/popularity/README.md`; the method is explained live at
   /fiddle/popularity.

Then check /fiddle/gaps: the tune should have no "Core research" gaps. That page is the single place that shows
what's missing; don't put gap information on the main tune book.
