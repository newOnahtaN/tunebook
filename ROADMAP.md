# Tune book roadmap: a menu of projects

Nate's long-running goals for nategrimwood.com/fiddle, written as an à la carte menu. Nate picks an item (or says
"your choice") and a session works on it. Read this before working on the site, and before finishing a session
update the item's status, coverage or open questions, and add a line to the log at the bottom.

**Enrichment is never finished.** Every item in section A can be ordered again at any time and will always find
something to improve: more tunes covered, deeper sources, better recordings, fixed mistakes, fresher local data.
Each one lists how far it has got and the best next step, so any session can pick it up cold.

**Where the gaps are:** nategrimwood.com/fiddle/gaps lists every tune's missing data (core research, tune basics,
deeper enrichment) and the unidentified tunes. Start any enrichment session there. Gap information lives only on that
page, never on the main tune book (Nate, Sep 26 2026).

**New tunes are enriched when they're added** (Nate, Sep 26 2026): see the checklist in `CLAUDE.md`.

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
- Genre families: `GENRE_TREE` in `public/fiddle/vocab.js` maps parents to children (Celtic → Irish, Scottish, Breton;
  Scottish → Shetland, Orkney, Cape Breton; Canadian → Québécois, Métis, PEI...; American → Old-time → Appalachian
  → Round Peak...). Picking a parent matches all its descendants. Add new traditions to the tree when they appear.
- Tag vocabulary: traditional, modern composition, crooked, cross-tuned, pipe tune, modal, three+ parts, slow air,
  has words, descriptive piece, fast showpiece, session standard, jam standard, contra favorite, square dance,
  Scottish country dance, ceilidh, beginner friendly. Reuse these spellings; add new ones sparingly.
- Tune types have plain-language definitions in `TYPE_INFO` in `public/fiddle/vocab.js` (the "Tune types" legend).
  Add a definition whenever a new type is used. The tag vocabulary is `TAGS` in the same file.
- Be generous with traditions: label every tradition where a tune is commonly played, not only where it came from.
- Tunes that belong to just one tradition store that tradition in `research.genres` (e.g. Dancing Bear → Contra) so
  the gaps page knows they were reviewed. "Pacific Northwest" (Seattle composers like the Canotes and Hank Bradley)
  and "Alabama" were added under Old-time.
- Coverage: 118 of 129 tunes have complete core research (gaps page, Sep 26 2026). The other 11 need Nate: tune
  types for the six VOM camp compositions (Cedar Paths, Same Mistakes, Two Months Too Soon, Dragon Slayer, Game of
  Drones, Pacific Sunrise), plus Bea's Waltz, Back Home, Habas para una Amiga, Roland White's and Texas Sandy Hill,
  where no source could be found online.
- Next best step: ask Nate the rhythm of each camp composition; add "crooked" and "cross-tuned" checks from
  Slippery-Hill and the Traditional Tune Archive; label tunes added since.
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
- Coverage (Sep 27 2026, after pass 2): 14 tunes have outside recordings (18 refs), 7 with a style model. Done so
  far: the most-heard old-time tunes (Angeline the Baker, Old Joe Clark, Step Around Johnny, Ducks on the Millpond,
  Fly Around My Pretty Little Miss, Five Miles from Town) and Frank's Reel, Cliffs of Moher, La Bastringue,
  Buntàta 's Sgadan, Mrs. MacLeod of Raasay, Sleep Soond Ida Mornin'.
- Waiting for Nate's ear: Martin Hayes, "Kilfenora Jig" on Under the Moon (1995,
  https://www.youtube.com/watch?v=4Cc9P-mkjLs, second tune in the track). The Traditional Tune Archive says it's The
  Old Favourite, but irishtune.info files it as a slide, so it may be a different tune. Add it once Nate confirms.

#### How to pick recordings (method v1, Sep 27 2026)

1. **Start from authority, not search rank.** Web search mostly surfaces lessons and amateur covers. Pick the
   performer from a discography or archive first, then search only to find that specific track:
   irishtune.info (dated discography, earliest first), The Session's recordings tab, Traditional Tune Archive
   annotations, Slippery-Hill (field recordings as direct MP3s that play inline), Smithsonian Folkways, Discogs, and
   for modern tunes the composer's own recording.
2. **Fill slots per tune:** source (composer's own, the earliest important recording, or the source player's field
   recording), style (a master fiddler in the tune's own tradition, fiddle-led), band (only if influential),
   teaching (optional). A slot can stay empty; an obscure recording picked because it was easy to link is worse
   than none.
3. **Prefer links that play on the site:** embeddable YouTube or direct audio, then official streams (Spotify,
   Bandcamp, Folkways pages). Prefer label, archive, artist and auto-generated "Topic" uploads over fan uploads; a
   fan transfer of a 78 is fine when a discography confirms the details.
4. **Verify every ref before import:**
   - V1 link works: YouTube oEmbed returns 200 (401 means embedding is off, so it won't play here); direct audio
     loads on nategrimwood.com with a sensible duration.
   - V2 right tune: the title or track list names the tune or a known alias; for medleys, say where it falls.
   - V3 performer: who played it, not who composed it, confirmed by a discography or archive, never only by the
     upload's title or channel name.
   - V4 year: the original recording year (Discogs, label, archive), not a streaming reissue date. Write "date
     unknown" rather than leaving it blank.
   - V5 note: every claim traces to a source. No inferred superlatives ("first", "official").
   - V6 instrument and lineup: check who plays what on that track (a famous fiddler may be on banjo).
   - V7 tune identity: when a title is ambiguous (numbered variants like "Kilfenora Jig (1)–(4)", or references
     disagree on the type), hold the pick for Nate to confirm by ear instead of importing it.
5. **Independent audit before import:** a separate agent re-checks each new ref against sources without seeing the
   picker's reasoning, and gives OK / FIX / REJECT. Apply the fixes, then import.
6. **Nate's ear is the last check.** Claude can't hear the playing, so "style model" quality is inferred from
   reputation. A top pick is only truly reviewed once Nate has listened (see F8).

#### Pass log

- **Pass 1 (pilot, Sep 27 2026), 7 refs, 6 tunes.** The audit found problems in 5 of 7 before import: streaming
  dates that were reissue years (Carignan 1975 → 1960), "source" stretched to mean "old" (a 1961 folk-revival track
  swapped for La Bolduc's 1930 78), invented claims ("first solo album", "official label upload"), a Topic channel
  crediting the wrong accompanist, and one convenience pick (an obscure 1966 Galax band, replaced by Fiddlin'
  Powers & Family, Victor 1924). What worked: authority-first found landmark recordings quickly; Slippery-Hill gives
  field recordings that play inline; the oEmbed and audio-duration checks make link checks mechanical. What's weak:
  3 of 7 are Spotify-only; no old-time style models; about 15–20 lookups per tune, so about 6–8 tunes per session
  with the audit. Follow-ups: Hollow Rock String Band (1968) for Angeline the Baker; Red Mountain White Trash
  (1999) for Step Around Johnny; old-time style models (e.g. Tommy Jarrell); Scottish, Shetland and Cape Breton.
- **Pass 2 (Sep 27 2026), 9 refs, 12 tunes.** Two picker agents ran in parallel (old-time; Scottish, Shetland and
  Irish), then an independent audit. The audit again found problems in 6 of 10: Samantha Bumgarner's 1924 side is
  banjo, not fiddle; release years used instead of recording years (Silver Bow 1976 → 1975; a Spotify placeholder
  2003 → 2002); "source" used for a studio LP; embellished notes ("spread the tune", "the key tradition bearer");
  and one tune-identity doubt (held above). Dropped a stand-in style model from outside the tune's tradition
  (Alasdair Fraser for a Shetland tune): an empty slot beats a wrong one. Premises can be wrong too: the Hollow Rock
  String Band never recorded Angeline the Baker. No findable recording by a master for Spootiskerry (composer Ian
  Burns never recorded it) or the Step Around Johnny style slot. Access limits: The Session and Tobar an Dualchais
  refuse automated fetches (403) and the Traditional Tune Archive rate-limits (429), so pace those. Leads to follow:
  Tommy Jarrell's Ducks on the Millpond (Field Recorders' Collective FRC 211; check that it's fiddle, not banjo);
  Shetland Fiddlers (Leader LED 2052, 1973) for Sleep Soond; Tobar an Dualchais sets for Mrs. MacLeod.
- Courtesy: Slippery-Hill MP3s play straight from their server (a donation-supported site). The volume is tiny, but
  keep the page credited in each note.

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

### F6. Data gaps page — `shipped` (Sep 26 2026) · S

/fiddle/gaps, linked from the main page's footer when signed in. Shows how many tunes have complete core research
and a tappable count for each check (no type, no traditions, no tags, labels missing from `vocab.js`, no region,
fact or sources, low confidence, unconfirmed key or form, no hearing, no recordings, no history). Possible extras:
link each tune to its card on the main page; include session-sheet tunes once A5 lands.

### F8. Nate's verdict on recordings — `idea` · S

A quick way for Nate to mark a recording after listening (keeper / not useful, maybe a one-line reason), shown on
the ref and counted on the gaps page. It's the one check Claude can't do, and the verdicts would show which picking
habits work.

### F7. Scheduled enrichment runs — `idea` · M

A weekly scheduled session that checks /fiddle/gaps and fills core gaps without Nate asking. Needs a way for an
unattended run to write research without the browser sign-in (e.g. a dedicated API key). Nate chose to skip this
for now (Sep 26 2026).

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
- 2026-09-26: Added the data gaps page (F6) and the "every new tune gets enriched" checklist in `CLAUDE.md`. Moved
  the genre families, type definitions and tag vocabulary into `public/fiddle/vocab.js`, shared by both pages.
- 2026-09-26: Core-gap pass (A1): filled region for 82 tunes and traditions for 15, and a tag for Stumptown Stomp.
  Core research complete went from 40 to 118 of 129; the remaining 11 need Nate's knowledge.
- 2026-09-27: Recordings method v1 and pass 1 (pilot): 7 refs for 6 tunes, audited by a separate agent before
  import (5 of 7 needed fixes). Method, checks and critique are in A3; added F8 (Nate's verdict on recordings).
- 2026-09-27: Recordings pass 2: 9 refs for 12 of the most-heard tunes (old-time, Scottish, Shetland), picked by
  two parallel agents and audited before import. Added checks V6 (instrument) and V7 (tune identity) to the method.
