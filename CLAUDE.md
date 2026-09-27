# Notes for Claude

- Nate's long-running goals for this site live in `ROADMAP.md`, written as a menu of projects. Read it at the start
  of any session on this repo, and update its statuses and log before you finish.
- The site is a Cloudflare Worker (`src/worker.js`) with D1, plus the main page (`public/fiddle.html`), the data gaps
  page (`public/fiddle/gaps.html`, at /fiddle/gaps) and the shared vocabulary (`public/fiddle/vocab.js`: genre
  families, tune type definitions, style tags). Pushes to `main` deploy automatically.
- Data changes go through the editor API while signed in: `PATCH /fiddle/api/tunes/:id`, `POST /fiddle/api/tunes`,
  `POST /fiddle/api/hearings/import`, `POST /fiddle/api/research/import`, and so on. Recordings, working notes,
  occasion details and hearing notes are editor-only; keep them out of anything public.

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
6. For a streaming link, prefer Tidal over Spotify or Apple Music (Tidal tends to embed better and Nate prefers it).

Then check /fiddle/gaps: the tune should have no "Core research" gaps. That page is the single place that shows
what's missing; don't put gap information on the main tune book.
