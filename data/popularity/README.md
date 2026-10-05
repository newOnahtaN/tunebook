# Popularity: how to run, extend and audit it

Every tune in the book has a 1–10 popularity score and a basis badge. The method is explained, with live data, at
https://nategrimwood.com/fiddle/popularity (built from the same code that computes the scores). ROADMAP F4 has the
history and open questions. This file is the runbook: everything a new session needs to refresh, extend or check
the system without the conversation it was built in.

## The pieces

| File | What it does |
|---|---|
| `public/fiddle/popularity.js` | The scoring: sources, tunable constants, `computePopularity`. Shared by the Worker and the explainer page, so a score is computed in one place only. |
| `src/popularity.js` | D1 tables (`pop_lists`, `pop_evidence`, `pop_scores`, `pop_history`), import, recompute, API payloads. |
| `public/fiddle/popularity.html` | The explainer and audit page at `/fiddle/popularity`: live constants, every tune's evidence, a recompute-mismatch flag and change history. |
| `data/popularity/evidence_pipeline.js` | Browser script that gathers evidence for every tune and builds the import payload. |
| `public/fiddle/popularity-hearsay.json` | Hearsay research, one entry per line (rubric below). Public, because it's served to the pipeline. |
| `public/fiddle/popularity-jamlists.json` | The five published jam lists, transcribed. Public for the same reason. |
| `test/popularity.test.mjs` | Scoring tests (`node --test test/popularity.test.mjs`). |

API: `GET /fiddle/api/popularity` (public, everything the explainer needs); `POST /fiddle/api/popularity/import`
and `POST /fiddle/api/popularity/recompute` (editor only, same-origin). `/fiddle/api/data` embeds the scores as
`popularity` (`{score, basis, curated, n}` per tune id; `n` is the evidence-row count, and the gaps page's "No
popularity research" check flags `n = 0`).

## Decisions Nate made (Oct 2-4, 2026; don't re-open them)

- Local play counts beat internet sentiment. Internet sentiment is the fallback, so a tune he learned from a teacher
  that never comes up at local jams is still on the same scale as a session favorite.
- Five badges: "local + online", "local", "online", "hearsay" and "no data". He especially likes the first three.
- The distribution should be flat, with real 10s and no generic floors. (An early 6.5 floor for Old Time Buddies
  tunes was thrown out.) Each local list's three busiest tunes are 10s.
- NW Scottish Fiddlers top tunes and the Old Time Buddies list get an explicit bump: they land between 7 and 10,
  placed in that range by online strength. Nate wants to become a Scottish fiddler. The green highlighting in the
  NWSF document no longer means anything special.
- Hearsay research (forums, blogs, social media, videos) is expected whenever there is no better data, and it is a
  good source of recordings too.
- The old hand-set `common` score is retired. It is still in the database but nothing uses it.

## Inputs

| Source | Kind | Where it comes from |
|---|---|---|
| Columbia City Jam | local | Google Sheet, full "All, by Date" log (gviz CSV). Strength: half all-time nights, half nights in the last two years, log scale vs the busiest title family. |
| PNW Québécois, Couth Buzzard | local | Google Sheets play counts (gviz CSV), log scale vs the busiest tune. |
| NW Scottish Fiddlers, Old Time Buddies | curated | Membership from the A5 session-source links in D1 (`session_sources`); OTB also matches by title. |
| The Session | online | adactio/TheSession-data CSVs on GitHub (tunebook counts). Log scale vs a per-tradition ceiling; old-time capped because The Session undercounts it. |
| Published jam lists | online | `public/fiddle/popularity-jamlists.json`; only counted for old-time, bluegrass, Western swing and waltz tunes. |
| Hearsay | online | `public/fiddle/popularity-hearsay.json`. |

The constants (curve, caps, ceilings, the 7–10 curated range) are in `CONSTANTS` in `public/fiddle/popularity.js`
and printed on the explainer page.

## Adding or changing a tune

New tunes need popularity evidence in the same turn (CLAUDE.md, step 7).

1. Research hearsay unless the tune already has solid local or online evidence. Add one line to
   `public/fiddle/popularity-hearsay.json`, keeping the file ordered by id:
   `{"id":284,"score":6,"confidence":"medium","note":"...","sources":["https://..."],"recordings":[{"title":"...","url":"https://..."}]}`
2. Deliver the file (it must be deployed before the pipeline can read it).
3. Either rerun the whole pipeline (below; it also picks up The Session and jam-list matches for the new tune), or,
   for a hearsay-only change, post just that row. Evidence for a (tune, source) pair replaces what was stored for
   that pair, and the import recomputes everything:
   `{"reason":"Hearsay for <tune>","evidence":[{"tune_id":284,"source":"hearsay","value":6,"extra":{"confidence":"medium","sources":[...],"recordings":[...]},"note":"...","url":"<first source>","as_of":"YYYY-MM-DD"}]}`
4. Check the tune on `/fiddle/popularity` and that the gaps page shows no "No popularity research" gap.

`recordings` are leads, not refs. Verify them with the recording-curation skill before importing any as `refs`.

## Hearsay scoring rubric

Judge how widely the tune is played now, from what turns up in a few minutes of searching: forums (Fiddle Hangout,
Banjo Hangout, Mandolin Cafe, The Session's discussions), teaching sites (Peghead Nation, fiddlevideo), jam and
camp tune lists, the Traditional Tune Archive, the North Atlantic Tune List, cbfiddle.com, Bandcamp and YouTube.
Score within the tune's own tradition, and calibrate against the existing file:

| Score | Means | Examples in the file |
|---|---|---|
| 9-10 | Iconic standard: many lessons and performances, on beginner jam lists, many forum threads | Forked Deer, Sally Goodin |
| 8 | Widely played standard in its genre | Clinch Mountain Backstep, Maiden's Prayer, Duke of Gordon's Birthday |
| 7 | Common jam tune, widely taught | Susanna Gal, Valley Forge, East Tennessee Blues |
| 6 | Well known among regular players: several recordings or videos, a forum thread, a tunebook | Five Miles from Town, Roscoe's Gone, Old Beech Leaves |
| 5 | Known in its niche or region: a few recordings, a lesson, local popularity | Sadie at the Back Door, Sam and Elzie's |
| 4 | Niche: a source recording or album plus a thread or tune-list entry | Hound Chase, Bacon Rind |
| 3 | Rare: an archive entry and maybe one video | Joe Drody's Jig, White Buffalo |
| 2 | Barely documented: a single collection or recording, no current players | Baby Ben, Dandy Lusk |
| 1 | Searched and found no public trace (gives the "no data" badge, not a score) | Valley of the Moon class tunes |

Confidence: `high` when many independent sources agree, `medium` for a few, `low` when evidence is thin or the
tune's identity is uncertain. Notes say what was found, in one sentence, with no superlatives the sources don't
support. A score of 1 is still worth recording: it marks the tune as researched.

## Rerunning the pipeline (refreshing all evidence)

Run it when the session sheets have moved on, after editing the hearsay or jam-list files, or after adding tunes.

1. Open `https://nategrimwood.com/fiddle/popularity` in a browser tab signed in as the editor. The script reads the
   Google Sheets gviz CSVs and raw.githubusercontent.com cross-origin, which works from that origin.
2. Get the script's text (for example from `https://github.com/newOnahtaN/tunebook/raw/refs/heads/main/data/popularity/evidence_pipeline.js`
   in a github.com tab, carried over in `window.name` across a same-tab navigation) and `eval` it in the site tab.
   It finishes asynchronously: wait for `window.__done` to be `'ok'` (or `'ERR ...'`).
3. Read `window.__report`: per-source match counts, `curatedNoOnline` (curated tunes with no online evidence, which
   need hearsay) and `weak` (thin evidence, hearsay candidates). Compare the counts with the previous import on the
   explainer page. A source that drops sharply means an input broke (a renamed sheet tab, a changed CSV header).
   The script refuses to run if the jam lists or hearsay file are missing, because the import replaces every
   source wholesale and would otherwise wipe that evidence.
4. Post it: `fetch('/fiddle/api/popularity/import', {method:'POST', headers:{'Content-Type':'application/json'},
   body: JSON.stringify(window.__payload)})`. The response lists `problems`, the evidence count and how many
   scores changed. Changes are logged in `pop_history` with the payload's `reason`.
5. Check `/fiddle/popularity`: the banner should say every stored score matches a fresh recompute. Spot-check the
   top of the "most popular first" sort on the main page and the gaps page.

After changing `CONSTANTS` (deployed), `POST /fiddle/api/popularity/recompute` rescores everything from stored
evidence without re-gathering it. Update `test/popularity.test.mjs` with any constant change.

## Matching quirks

- Titles are normalized (accents, articles, "reel"/"jig" words, punctuation) and every slash alternative and `aka`
  is tried. Columbia City counts are grouped by title family, with one-letter misspellings and source-player
  qualifiers ("(Collins setting)") handled; see A5 in ROADMAP for why mixed-setting counts matter.
- The Session match prefers the same tune type; `SESSION_OVERRIDE` and `SESSION_BLOCK` in the pipeline fix known
  wrong matches (Red Haired Boy is The Little Beggarman there; Huckleberry Hornpipe and Duke of Gordon's Birthday
  matched the wrong tunes). Add to them when a match is wrong rather than special-casing the scoring.
- A tune with a local list rank of 1-3 is a 10 even when other evidence is weak; that is intentional.

## Adding a source

- Another jam list: add its titles to `popularity-jamlists.json`, its label, weight and URL to `PANEL_META` in the
  pipeline and to the guard's key list, and decide whether `jamListMax` should change.
- Another local session (the Wedgwood Alehouse jam list, about 800 tunes from 2013-15, is a candidate): add it to
  `SOURCES` (kind `local`) and `rowStrength` in `public/fiddle/popularity.js`, a section in the pipeline that emits
  rows with `extra.rank`, its list stats, and a test. The explainer page picks it up from `SOURCES`.
