# Notes for Claude

- Nate's long-running goals for this site live in `ROADMAP.md`. Read it at the start of any session on this repo,
  and update its statuses and log before you finish.
- The site is a Cloudflare Worker (`src/worker.js`) with D1, plus one page (`public/fiddle.html`). Pushes to `main`
  deploy automatically.
- Data changes go through the editor API while signed in: `PATCH /fiddle/api/tunes/:id`, `POST /fiddle/api/tunes`,
  `POST /fiddle/api/hearings/import`, and so on. Recordings, working notes, occasion details and hearing notes are
  editor-only; keep them out of anything public.
