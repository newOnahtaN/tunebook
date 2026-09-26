# Tune book roadmap: a menu of projects

Nate's long-running goals for nategrimwood.com/fiddle, written as an à la carte menu. Nate picks an item (or says
"your choice") and a session works on it. Read this before working on the site, and before finishing a session
update the item's status, coverage or open questions, and add a line to the log at the bottom.

**Enrichment is never finished.** Every item in section A can be ordered again at any time and will always find
something to improve: more tunes covered, deeper sources, better recordings, fixed mistakes, fresher local data.
Each one lists how far it has got and the best next step, so any session can pick it up cold.

Sizes: **S** fits in part of a session, **M** is about a session, **L** is several sessions or needs design first.
Feature statuses: `idea` → `designing` → `building` → `shipped`.

### House rules for every item

- **Provenance (Nate, Sep 26 2026):** it must always be obvious what came from Nate's own life (hearings, notes, Drive
  recordings, links he gave, his genre labels) versus research runs versus community data. Nate's own data takes
  visual and UX precedence. Research lives in the `research` table and in `refs` with `origin = 'research'`, shown
  muted and marked "from research". Import it with `POST /fiddle/api/research/import` (see `src/worker.js`).
- **How Nate works:** he mostly uses the site on his phone and asks Claude in chat to change data rather than editing
  on the site. Propose designs before building anything big, and ask him about gaps instead of guessing. Don't
  re-open decisions he has already made.

---

## A. Data enrichment (always open; order any of these again)

### A1. Genres, traditions, types and style tags — S/M per pass (formerly S1)

Every tune has a primary genre plus every tradition where it's commonly played, a tune type and style tags, so
filtering by a broad genre surfaces its relatives without false positives.

- Nate's labels: `tunes.genre` (primary) and `tunes.genres2` (his secondary genres). Research labels:
  `research.genres` (traditions), `research.type`, `research.tags`. The site shows them together as one genre list,
  with research ones marked; filters and search use both unless "Primary only" is checked.
- Genre families: `GENRE_TREE` in `public/fiddle.html` maps parents to children (Celtic → Irish, Scottish, Breton;
  Scottish → Shetland, Orkney, Cape Breton; Canadian → Québécois, Métis, PEI...; American → Old-time → Appalachian
  → Round Peak...). Picking a parent matches all its descendants. Add new traditions to the tree when they appear.
- Tag vocabulary: traditional, modern composition, crooked, cross-tuned, pipe tune, modal, three+ parts, slow air,
  has words, descriptive piece, fast showpiece, session standard, jam standard, contra favorite, square dance,
  Scottish country dance, ceilidh, beginner friendly. Reuse these spellings; add new ones sparingly.
- Tune types have plain-language definitions in `TYPE_INFO` in `public/fiddle.html` (the "Tune types" legend). Add
  a definition whenever a new type is used.
- Be generous with traditions: label every tradition where a tune is commonly played, not only where it came from.
- Coverage: all 129 tunes reviewed twice (Sep 26 2026). Low confidence: the VOM camp compositions, Bea's Waltz, Texas
  Sandy Hill, Roland White's.
- Next best step: verify the low-confidence ones; add "crooked" and "cross-tuned" checks from Slippery-Hill and the
  Traditional Tune Archive; label tunes added since.
- Proposals waiting for Nate: turn "Waltz" and "Camp composition" from genres into types and move those tunes under
  their real traditions; consider making Campbell's Farewell to Red Gap primarily Scottish.

### A2. Everything known about each tune — M per pass (formerly S2)

A full history for every tune: where it came from, who composed it or whose playing it's known from, where it spread,
where it's still played, the recordings and players that made it popular, other names, and good stories.

- Cite sources (The Traditional Tune Archive, The Session, irishtune.info, Slippery-Hill, the Lomax archive, liner
  notes...). Say where sources disagree instead of quietly picking one.
- Stored in `research.summary` (one notable fact) and `research.history` (longer notes and corrections), with `sources`.
- Coverage: all 129 tunes have a one-fact summary with sources (Sep 26 2026); none has a full history yet.
- Next best step: full histories for the most-heard tunes first.

### A3. Recordings for every tune, and a well-chosen top recording — M per pass (formerly S3)

Collect every useful recording of each tune and pick a top recording that best teaches **style**.

Nate's rubric for the top recording:

1. **Gold standard:** a single fiddle, played by a master who demonstrates the genre's defining ornamentation or
   rhythmic bowing clearly and with control. His examples: Sarah Comer's recordings, Hayden Stern's lesson
   recordings, and W.H. Stepp's *Bonaparte's Retreat* (for how Stepp uses double stops).
2. **Source and original recordings:** always include them for their history, but they're usually not the top pick
   unless the playing is also the clearest model of the style. Stepp is the counterexample.
3. **Band recordings:** include them, especially important, well-known or exciting takes. Rarely the top pick
   because the fiddle's style isn't centered.
4. Learning aids (slowed versions, teaching videos) are welcome as extras.

- Each recording records who plays, the year, the link, its category (style / source / band / teaching) and a short
  note on why it's worth hearing. Outside recordings live in `refs` (`origin` mine / research). YouTube links and
  direct audio files play inline like Drive files; anything else opens in a new tab. Any can be the top recording
  (`top_media = 'ref:<id>'`). Auto-pick order: Nate's Drive files, then links he added, then research recordings,
  style models first.
- Coverage: 2 tunes have outside recordings (Bonaparte's Retreat, Willow on the Lake).
- Next best step: one style-model recording per tune, most-heard tunes first.

### A4. Where and when each tune was heard — S whenever Nate reports (formerly S4)

Log every occasion Nate hears a tune (lessons, classes, jams, sessions, camps). This drives prioritization and the
"heard" filters and sorts. Nate reports occasions in chat; log them with `POST /fiddle/api/hearings/import` (upserts
an occasion by `key` and replaces its tune list; payload format in `src/worker.js`). Lessons and classes count
toward times heard (Nate's decision, Sep 26 2026).

- Coverage: 128 of 129 tunes have at least one hearing (Bonaparte's Retreat was added from research).

### A5. Local session data from community tune lists — M per sync (formerly S5)

**Major goal (Nate, Sep 26 2026).** Community members keep spreadsheets of every tune played at Seattle-area sessions.
Keep the tune book in sync with them. This item is the data sync; F4 below is the feature that uses it.

Sources (linked from Nate's "Fiddle Tune Learning" Google Doc, id `1nDN5qlES0aV-cpu9H1R9DhIL8-BpX_8Bl0MMTytl1a4`):

| Sheet | Maintainer | What it has |
|---|---|---|
| Columbia City Jam - Tunes 2022-2026 (old-time), `1u17fwk_FlBi-WLIxICy0MMA76M7j4yhYgZGuS5EqNs4` | Steve Johnston | One row per tune per jam date: date, key, tune, source player, links. Count rows per tune to get times played. |
| PNW Quebecois Tunes, Annotated, `1TYyk_Rh9XSIJ3T1KP6P_Ga8DdJiExfQAXUXQcBwiROo` | Doug Plummer | Tune, meter, key, composer, links, times played, first and last played. |
| Couth Buzzard Irish Tunes (Saturday session), `17PrThLHRKfPzFQ0vrwHWSXugxHbJLsvFBNr8oKJRi9w` | Doug Plummer | Tune, type, key, origin, link, times played, last played. |
| Seattle's Old Time Buddies - Tune Share (Ritz's jam), `1MN3yAbPryeJf_YXJdOBh7T9qSDht_VhD-pfU6tdUDeU` | dzank97 | Tune list with key, artist, recording link, difficulty. No play counts. |

- Nate's rules: local play counts beat broad internet sentiment; every sheet tune should appear in the tune book;
  and it must stay obvious which tunes Nate has actually heard. Community data is a third provenance, distinct from
  both Nate's own data and research.
- Likely shape: a `session_counts` table (tune_id, sheet, times_played, first_played, last_played, synced_at) and a
  marker on tunes created from a sheet, never written into Nate's fields. Match names carefully ("Abbey Reel, The",
  "Andy Dejarlis") with the name/aka matcher plus a manual alias list.
- The sheets are shared with Nate, not with the site's service account, so syncing needs his Drive sign-in or an
  import run from chat.
- Status: not started. Coverage: share of sheet tunes matched, and last sync date per sheet.

### A6. Cleanup: unidentified tunes and data questions — S

Work through "Open data questions" below and the site's Working notes (editor-only).

---

## B. Features (can be finished)

### F1. Sort and filter by hearings — `shipped` (Sep 26 2026) · S

Sorts: most heard, recently heard, first heard. Filter: heard in real life (any, or at a lesson, class, jam,
session or camp) versus not heard yet. Possible extras: a "heard in the last N months" filter.

### F2. Sung songs, tracked separately from tunes — `idea` · M

Nate's notes asked for sung Irish songs to live in the app apart from the fiddle tunes. So far: The Parting Glass,
Safe Home, Health to the Company, The Wild Rover.

### F3. Flashcard-style learning and retention mode — `idea` · L

An Anki-style mode for learning new tunes and keeping learned ones fresh. State management is central. Parts:

1. **Recommendation algorithm:** suggests what to work on next, weighing genre, local popularity (hearings, A5 data,
   commonality) and his prescribed learning path.
2. **Practice log:** every time a tune was served for practice, and what happened.
3. **Active-learning set:** the tunes currently being learned, with a configurable cap.
4. **Staleness survey:** memorized tunes he hasn't touched in a while.
5. **Accompaniment:** backing like Strum Machine (chord-chart playback at adjustable tempo, styles per genre).

Open questions: What is the "prescribed learning path" (a list, per-genre weights, something else)? How should a
practice session be scored (again / hard / good / easy, or just "played it")? Which Strum Machine features matter
most, and where do chord charts come from?

### F4. Popularity overhaul and session-only tunes — `idea` · L (needs A5)

Replace the popularity score with one driven by local play counts (the current `common` score becomes the fallback),
add every sheet tune to the book, and make "not heard by me yet" unmistakable alongside "popular locally".

Open questions: How to weight the sessions against each other and how much recency matters? One overall score, per
genre, or both? Should sheet-only tunes count in the header totals or sit behind a toggle? Does being on the Old Time
Buddies list (no counts) earn a fixed boost? Should session counts be public or editor-only?

### F5. Tune type legend — `shipped` (Sep 26 2026) · S

A "Tune types" popup explaining each type (reel, jig, strathspey...), opened from the Type filter and from a tune's
type.

---

## Open data questions

- Frank's Reel is marked "Not played yet", but Hayden taught it on Sep 22, 2026 and the video is in Drive. Should it change?
- "Bill Harris" from Maura's VOM class is logged as Bill Collins'. That's a guess and needs confirming.
- Still unidentified: Kid and the Bacon (best guess Bacon Rind), Ravelin Wheel (SFSF favourite; guesses in its notes),
  McClellan's Row and November Sun (maybe a new Katie McNally tune). Nate has no more to add; use judgment.

---

## Log

- 2026-09-26: Created this roadmap. Added the hearing log (21 occasions, 146 hearings), merged the three Peg Ryan's
  polka rows, added Andy De Jarlis to the unidentified list, and added Bonaparte's Retreat (W.H. Stepp, 1937).
- 2026-09-26: Unidentified-titles pass. Identified Andy De Jarlis as Andy De Jarlis' Jig (Métis composer, a Cape
  Breton favourite) and moved it to the tunes; tagged Sleeping Giant Two-Step as Métis too.
- 2026-09-26: First broad enrichment run. Added the `research` and `refs` tables and the "From research" block,
  plus inline playback and top-recording picks for outside recordings. Researched type, traditions, region and one
  sourced fact for all 129 tunes. Corrected primary genre (Myra's Jig → Scottish, Return from Helsinki → English,
  Lucy Farr's Polka → Irish), origins (Booth Shot Lincoln, Old Man Gone, Hickory, Kilfenora) and one title
  (Miss Oliver Morris' Reel). Merged "Alabama Walk Around" into Step Around Johnny as an Aug 27 hearing.
- 2026-09-26: Genre labelling pass. Added genre families to the filter, Type and Tags filters, and a `research.tags`
  column (schema 8). Relabelled all 129 tunes with generous traditions and style tags.
- 2026-09-26: Added the local session popularity goal (now A5 + F4).
- 2026-09-26: Reorganized this file as a menu. Merged research traditions into the genre display (marked as research)
  so they read as secondary genres; tapping a genre filters by it. Shipped F1 (hearing sorts and filter) and F5
  (tune type legend).
