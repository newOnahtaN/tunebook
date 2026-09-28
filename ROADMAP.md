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
- **PCC tunes are all from Sarah Comer (Nate, Sep 27 2026):** every tune with `source` starting with "PCC" (a
  Portland Country Dance Community session sheet) was taught by Sarah Comer, a Pacific Northwest old-time fiddler.
  When a PCC-sourced tune's origin comes back low-confidence or unverified, she's a real, askable source — Nate can
  check with her directly rather than the answer staying a guess.

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
- Coverage: 123 of 129 tunes have complete core research (Sep 27 2026). The remaining 6 are all VOM camp
  compositions with no findable source online (Cedar Paths, Same Mistakes, Two Months Too Soon, Dragon Slayer, Game
  of Drones, Pacific Sunrise) — these need Nate's own knowledge of the tune type. Bea's Waltz, Back Home, Habas para
  una Amiga, Roland White's and Texas Sandy Hill now have a research pass on file too, even though several came
  back low-confidence or unidentified rather than a firm answer.
- Next best step: the six VOM camp compositions' keys and types are in the 7.7 MB VOM tune packet in Drive (per
  Working notes) — this session now has a Drive connection that reads as Nate, so try reading the packet directly
  instead of waiting for a smaller exported PDF; add "crooked" and "cross-tuned" checks from Slippery-Hill and the
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
- Coverage (Sep 27 2026, after pass 3): 22 tunes have outside recordings (30 refs), 13 with a style model. Done so
  far: the most-heard old-time tunes (Angeline the Baker, Old Joe Clark, Step Around Johnny, Ducks on the Millpond,
  Fly Around My Pretty Little Miss, Five Miles from Town, Red Haired Boy, Soldier's Joy, Cherokee Shuffle,
  Cumberland Gap, Dry and Dusty, Forked Deer, Little Liza Jane, Spotted Pony, Sandy Boys) and Frank's Reel,
  Cliffs of Moher, La Bastringue, Buntàta 's Sgadan, Mrs. MacLeod of Raasay, Sleep Soond Ida Mornin'.
- Waiting for Nate's ear: Martin Hayes, "Kilfenora Jig" on Under the Moon (1995,
  https://www.youtube.com/watch?v=4Cc9P-mkjLs, second tune in the track). The Traditional Tune Archive says it's The
  Old Favourite, but irishtune.info files it as a slide, so it may be a different tune. Add it once Nate confirms.
- Streaming link preference (Nate, Sep 27 2026): when a track isn't on YouTube or direct audio, link Tidal before
  Spotify or Apple Music. Retrofit the 3 Spotify-only pass-1 links and the Step Around Johnny Apple Music link to
  Tidal equivalents when a future pass touches those tunes.
- Next passes: widen out from old-time — Irish, Scottish and Québécois are thin on outside recordings. Make V7
  (tune identity) a hard stop rather than a judgment call: it was the top failure mode across all three passes
  (Forked Deer, Little Liza Jane, Spotted Pony, Buffalo Gals) and, outside this project, Bea's Waltz.

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
3. **Prefer links that play on the site:** embeddable YouTube or direct audio, then official streams — Tidal before
   Spotify or Apple Music (Nate, Sep 27 2026), then Bandcamp, Folkways pages. Prefer label, archive, artist and
   auto-generated "Topic" uploads over fan uploads; a fan transfer of a 78 is fine when a discography confirms the
   details.
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
- **Pass 3 (Sep 27 2026), 13 refs, 10 tunes.** Two picker agents ran in parallel on old-time standards (Red Haired
  Boy, Soldier's Joy, Cherokee Shuffle, Cumberland Gap, Buffalo Gals / Dry and Dusty, Forked Deer, Little Liza Jane,
  Spotted Pony, Sandy Boys), then an independent audit of all 14 proposed refs. The audit rejected 1 of 14 outright
  (a Skillet Lickers "Soldier's Joy" whose cited OKeh catalog number actually belongs to a different band and tune —
  the real Skillet Lickers recording is a 1939 Bluebird side, not the 1927 one claimed) and fixed 5 more: an invented
  "earliest commercial 78" claim (Red Haired Boy), a wrong record label (Cherokee Shuffle: Dot, not Decca), a wrong
  year (Cumberland Gap/Jarrell: 1970, not 1971), an unsupported composer credit (Dry and Dusty: authorship is
  actually disputed per Traditional Tune Archive), and an under-disclosed detail (the Eck Robertson Dry and Dusty
  track was untitled on its original LP, catalogued as a variant rather than self-titled). Buffalo Gals got all 3
  slots left empty: every candidate either turned out to be a different regional tune sharing the name, or lacked a
  verifiable link. Both pickers erred toward empty slots over forced picks on ambiguous titles (Forked Deer, Little
  Liza Jane, Spotted Pony all have multiple unrelated tunes sharing their name in the old-time repertoire) — the
  audit independently confirmed each disambiguation rather than trusting the picker's own confidence. One picked ref
  (Dry and Dusty, source) had no Tidal equivalent despite a search, so it stayed on Spotify; noted for Nate rather
  than silently overridden. DAHR (adp.library.ucsb.edu) blocked automated fetches all pass (403), same as the
  access limits hit in pass 2.
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

**Progress (Sep 27 2026):** the Google Drive connection does unblock this — all sources below were read directly as
Nate, no manual export needed. Pass 1 pulled each sheet's "top" tunes and diffed them against the 129-tune book; the
candidate lists (tunes worth adding) are saved at `data/session-tunes/candidates_pass1.json` rather than inlined here.

Sources (the first four linked from Nate's "Fiddle Tune Learning" Google Doc, id
`1nDN5qlES0aV-cpu9H1R9DhIL8-BpX_8Bl0MMTytl1a4`; NWSF added Sep 27 2026 at Nate's request):

| Sheet | Maintainer | What it has | "Top" means (Nate, Sep 27 2026: be thoughtful per-source, cap at 25) |
|---|---|---|---|
| Columbia City Jam - Tunes 2022-2026 (old-time), `1u17fwk_FlBi-WLIxICy0MMA76M7j4yhYgZGuS5EqNs4` | Steve Johnston | One row per tune per jam date: date, key, tune, source player, links. Six tabs total; the sheet actually has a separate "All, by Date" tab (A1:H3085, the true full 2022-2026 log) — "Most Recent"/"Less Recent" are partial views of it, and "G/D/A xA/C Tunes" are key-filtered slices of the same data, not new tunes. | **Resolved Sep 28 2026:** the earlier "41-row fragment" problem was `download_file_content` only ever exporting the sheet's default tab ("Most Recent"). Pulled the full "All, by Date" tab directly via its gviz CSV export (614,436 chars, verified byte-exact, 3084 data rows, 701 distinct tune titles after normalization) and counted real per-tune frequency across the whole 3/31/2022-8/14/2026 span. Top 25 by raw play count — only 2 of 25 (Cumberland Gap, Bound to Have a Little Fun) already in the book, both with 1 hearing already, so no "not yet heard" cases from this source. |
| PNW Quebecois Tunes, Annotated, `1TYyk_Rh9XSIJ3T1KP6P_Ga8DdJiExfQAXUXQcBwiROo` | Doug Plummer | Tune, meter, key, composer, links, times played, first and last played (388 tunes). | The sheet's own "Times Played" column, top 25. Real play counts, so this is a direct measure. Only 1 of the top 25 (La fée des dents) is already in the book. |
| Couth Buzzard Irish Tunes (Saturday session), `17PrThLHRKfPzFQ0vrwHWSXugxHbJLsvFBNr8oKJRi9w` | Doug Plummer | Tune, type, key, origin, link, times played, last played (527 tunes on the main "Session tunes" tab). | Same: "Times Played" column, top 25. 2 of the top 25 (Cliffs of Moher, Father Kelly's) already in the book. The sheet also has a second tab, "Copy of Session tunes" (517 rows, adds a 1-2 "interest tier" column, called "Some Interesting"). **Resolved Sep 28 2026:** confirmed via a full per-tab read that it's a stale duplicate of "Session tunes" — same tune identities, but its play counts occasionally lag the main tab (e.g. Black Rogue 6 vs 7, Banish Misfortune 22 vs 23), meaning it was copied at an earlier point and never kept in sync. "Session tunes" is canonical for ranking; "Copy of Session tunes", the empty "Temp" tab, and "Scale modes" (a music-theory reference table, not tune data) are all excluded from any future sync. |
| Seattle's Old Time Buddies - Tune Share (Ritz's jam), `1MN3yAbPryeJf_YXJdOBh7T9qSDht_VhD-pfU6tdUDeU` | dzank97 | Tune list with key, artist, recording link, difficulty (~30 tunes). No play counts. | No ranking signal exists, so the whole list counts as "top" — it's already a short, hand-picked share list, not a full log. Diffed Sep 28 2026: only 2 of 30 (Red Haired Boy, Cherokee Shuffle) already in the book — both matter for F3 tier 4 (Ritz jam tunes not yet memorized/played). The other 28 are in `candidates_pass1.json`. |
| NW Scottish Fiddlers - TOP-FIDDLE-TUNES.docx (Nate, Sep 27 2026) | NWSF club | The club's own curated "top tunes for sessions" reference, revised 2024, ~64 tunes across waltzes/airs/marches/jigs/strathspeys/reels, marked whether it's in their own library. Not a session Nate attends — it's a standing repertoire list. | The club already curated this as "top," so the whole list counts, same reasoning as Old Time Buddies. 12 of 64 are already in the book (all already heard at least once); 52 are new candidates. |

- Nate's rules: local play counts beat broad internet sentiment; every sheet tune should appear in the tune book;
  and it must stay obvious which tunes Nate has actually heard. Community data is a third provenance, distinct from
  both Nate's own data and research. He only wants the top 25 per session at most, and "top" should be defined
  per-source rather than forced into one formula (see table above).
- **New tunes added from this data need a clear "local favorite, not yet heard" marker** (Nate, Sep 27 2026): when a
  candidate from this list gets imported as a real tune record, set its `notes` to say it's a local favorite from
  session X that Nate hasn't heard live yet (with the play count / rank), rather than inventing a new tag — the tag
  vocabulary in `vocab.js` is for a tune's own character, not Nate's relationship to it. Status should start as
  "Not played yet." None of pass 1's matches against the existing book needed this (every match already had at least
  one hearing), but most of the candidates in `candidates_pass1.json` are brand new to the book and should get it
  when they're imported.
- Likely shape: a `session_counts` table (tune_id, sheet, times_played, first_played, last_played, synced_at) and a
  marker on tunes created from a sheet, never written into Nate's fields. Match names carefully ("Abbey Reel, The",
  "Andy Dejarlis") with the name/aka matcher plus a manual alias list. Pass 1's matching (strip accents, drop
  parentheticals, move a trailing ", La/Le/Les/The" to the front) found only 3 of ~72 top-25 candidates already in the
  book — most of what's "popular locally" isn't in Nate's book at all yet, which matters more than the sync
  mechanism itself right now.
- The sheets are shared with Nate, not with the site's service account, but the Google Drive connection in this
  session reads them fine as Nate — confirmed working, no manual export needed.
- Status: candidate lists gathered and fully resolved for all 5 sources (pass 1-3, Sep 27-28 2026) — 152 candidates
  total across the 5 sheets. The site now has a feature for this (Sep 28 2026, before any import): a `session_sources`
  table, a `POST /session-sources/import` endpoint, and on the front end a `srcbadge` on each card (e.g. "Columbia
  City Jam #4"), a session-list detail block, and a `Session lists` filter — alongside a full parchment/candlelight
  visual reskin (daytime journal / pub-at-night dark mode). All 152 candidates were imported via the new endpoint;
  3 matched existing tune records (Cumberland Gap, and two others) and now show their badge live — the other 149
  stay unmatched and tracked in `data/session-tunes/candidates_pass1.json` until each gets the full enrichment pass
  (CLAUDE.md's checklist) and becomes a real tune record, which is a bigger job than gathering the list. Next: (1)
  start importing candidates as full tune records in small batches with full research + the "not yet heard" note
  (now auto-derived from hearings data rather than hand-written) — Red Haired Boy and Cherokee Shuffle are already
  in the book and match F3 tier 4, so they're a natural first pair to fully research and prioritize, (2) design the
  actual `session_counts` sync once enough candidates exist to make it worth automating.

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

An Anki-style mode for learning new tunes and keeping learned ones fresh. State management is central.

1. **Recommendation algorithm**, in priority order (Nate, Sep 27 2026):
   1. Tunes from Hayden not yet memorized.
   2. Tunes from Sarah / PCC not yet memorized.
   3. Tunes with a note flagging special importance (e.g. "this tune is important to Heidi") — needs a way to mark
      a note as this kind of callout, distinct from an ordinary free-text note (see open questions).
   4. Tunes heard at Ritz's old-time jam not yet memorized or played.
   5. Tunes broadly popular across all local sessions (old-time, Québécois, Scottish, Irish) — uses F4's popularity
      overhaul, so needs A5 (session data) and F4 built first.
   Separately: already-memorized tunes need their own way to stay in rotation so they don't go stale while this
   list keeps attention on new material — see the staleness survey below; the two may end up as one system.
2. **Practice log:** a lightweight per-session record — "played it", free-text notes for that session, and a
   recording of that session (reusing the Drive/media pipeline). No again/hard/good/easy scoring for now (Nate,
   Sep 27 2026).
3. **Active-learning set:** the tunes currently being learned, with a configurable cap.
4. **Staleness survey:** memorized tunes he hasn't touched in a while.
5. **Accompaniment:** backing like Strum Machine (chord-chart playback at adjustable tempo, styles per genre).
   **Punted, low priority for now (Nate, Sep 27 2026)** — still wanted eventually, just not designed yet.

Open questions: how a "callout" note should be flagged and stored (a boolean, a tag, a free-text convention?); how
much weight the staleness survey gets relative to new-tune priority; where chord charts would come from if/when
accompaniment happens. Needs F4 + A5 for priority tier 5, and F9 (a "learned from" field) to drive tiers 1-2
without text-matching on `source`.

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
link each tune to its card on the main page; include session-sheet tunes once A5 lands; flag a tune that has a
lesson hearing but is still marked "Not played yet" (how Frank's Reel went stale, Sep 27 2026).

### F8. Nate's verdict on recordings — `idea` · S

A quick way for Nate to mark a recording after listening (keeper / not useful, maybe a one-line reason), shown on
the ref and counted on the gaps page. It's the one check Claude can't do, and the verdicts would show which picking
habits work.

### F9. "Learned from" field — `idea` · S (new, Sep 27 2026)

A dedicated teacher/source-person field on each tune, separate from `source` (the occasion/session name). Right now
telling "taught by Hayden" from "taught by Sarah" needs text-matching on `source` or reading notes by hand — that's
why it took Nate explicitly saying so to learn all PCC tunes are Sarah's. A real field would:

- Make F3's Hayden/Sarah priority tiers a filter instead of a guess.
- Let A3's recording rubric auto-prefer a teacher's own recording as the top pick when one exists (the rubric
  already names Sarah's and Hayden's recordings as gold-standard examples).

Open question: should it backfill automatically from what's inferable (PCC → Sarah, `source` starting with "Fiddle
  lesson" → Hayden) and then stay editable, or only fill in from what Nate confirms tune-by-tune? Auto-backfill is
  faster but risks another wrong-until-corrected guess like Bea's Waltz's composer credit — ask Nate before building.

### F10. A single "Needs Nate" queue — `idea` · S (new, Sep 27 2026)

Questions only Nate can answer currently live in three separate places: ROADMAP's "Open data questions", the site's
Working notes, and low-confidence `research.summary` text. That spread is itself a source of staleness (see the
Sep 27 sweep in the log). A single list on the gaps page — grouped by what kind of answer it needs (listen and
confirm by ear; ask Sarah or Hayden directly; check a file or notation he has) — would put everything in one place
he can clear from his phone, instead of it living in notes he'd have to already know to look for.

### F7. Scheduled enrichment runs — `idea` · M

A weekly scheduled session that checks /fiddle/gaps and fills core gaps without Nate asking. Needs a way for an
unattended run to write research without the browser sign-in (e.g. a dedicated API key). Nate chose to skip this
for now (Sep 26 2026).

---

## Open data questions

- "Bill Harris" from Maura's VOM class is logged as Bill Collins'. That's a guess and needs confirming.
- Still unidentified: Kid and the Bacon (best guess Bacon Rind), Ravelin Wheel (SFSF favourite; guesses in its notes),
  McClellan's Row and November Sun (maybe a new Katie McNally tune). Nate has no more to add; use judgment.

---

## Log

- 2026-09-28: Production authentication check: **unblocked**. The initial push failed because the app's work
  account is an Enterprise Managed User, which cannot collaborate on this personal repository. Nate made the
  repository private and authorized `newOnahtaN` for project-local access. On this workstation, `git personal`
  runs Git commands and `git gh` runs GitHub CLI commands using an isolated CLI configuration and the Windows
  keyring; other projects and work-account defaults are unchanged. These aliases and credential settings are
  local, not committed credentials. Changed the main page's browser/bookmark title to "Nate's Fiddle Tune Book"
  as a small deployment smoke test, without changing the API or tune data.

- 2026-09-28: Built the community-session-lists site feature before importing any candidates, per request — a
  `session_sources` D1 table, a `POST /session-sources/import` endpoint (name-matching, mirrors `importResearch`),
  and on the front end a `srcbadge` per card (shows sheet name + rank only when both rank and a play-count stat
  exist, so curated non-ranked lists like NW Scottish Fiddlers just show the name), a `.sblock` detail panel, and a
  `Session lists` multiSelect filter. "Local favorite, not yet heard" is derived at render time from existing
  hearings data rather than a hand-written note. Also reskinned the whole site as an aged-parchment journal, with a
  genuinely different "pub at night" dark mode (dim wood-dark room, stronger candlelight) rather than just a dimmed
  daytime palette. Then imported all 152 pass-1–3 candidates through the new endpoint: 3 matched existing tune
  records and now show live badges; the other 149 stay tracked in candidates_pass1.json pending full research.

- 2026-09-28: A5 pass 3. Resolved both open A5 data-quality issues. Columbia City Jam: found via a per-tab Drive
  read that the sheet has six tabs, not one — the true full history lives in "All, by Date" (3085 rows), while the
  CSV export Nate's link pointed at only ever returned the default "Most Recent" tab. Pulled the full tab's data via
  its gviz CSV endpoint in the browser (614,436 chars, verified length-exact against the fetch, 3084 data rows),
  computed real per-tune play counts across the full 3/31/2022-8/14/2026 span, and added a top-25 `columbia_city_jam`
  source to `candidates_pass1.json` (152 candidates total now across 5 sources). Couth Buzzard: confirmed "Copy of
  Session tunes" is a stale, occasionally-lagging duplicate of the canonical "Session tunes" tab and should be
  excluded from any sync, along with the empty "Temp" tab and the non-tune "Scale modes" reference tab.
- 2026-09-28: A5 pass 2. Diffed Old Time Buddies (Ritz's jam) against the book: only Red Haired Boy and Cherokee
  Shuffle already there, both relevant to F3 tier 4. Added its other 28 tunes to `candidates_pass1.json` (now 127
  candidates across all 5 sources). Columbia City Jam's full history and the Couth Buzzard duplicate tab are still
  open.
- 2026-09-28: While diffing Old Time Buddies, found Red Haired Boy was missing a hearing at the Ritz jam occasion
  (`ritz-2026-08-27`) even though it's on that jam's own tune-share sheet — it only had a hearing from Fiddle Tunes
  camp. Added the missing hearing via `/hearings/import`. Cherokee Shuffle already had its Ritz jam hearing correctly
  recorded.
- 2026-09-27: A5 pass 1. Confirmed the Drive connection reads the community sheets as Nate. Pulled top-25-by-plays
  from the Quebecois and Couth Buzzard sheets, the whole (small, uncounted) Old Time Buddies list, and — new source,
  Nate's request — NW Scottish Fiddlers' own curated top-tunes reference. Diffed all of it against the 129-tune book:
  only 3 tunes overlapped, saved the rest (~99 candidates) to `data/session-tunes/candidates_pass1.json` for future
  import passes. Flagged that Columbia City Jam's CSV export only returns a two-date fragment, not its full
  2022-2026 history, and that Couth Buzzard's "Copy of Session tunes" tab looks like a stale duplicate. Designed the
  "local favorite, not yet heard" marking (a `notes` line, not a new tag) for when these candidates get imported.
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
- 2026-09-27: Nate asked to prefer Tidal over Spotify/Apple Music for streaming links going forward; added to the
  CLAUDE.md checklist and the A3 method (step 3). Existing Spotify/Apple Music refs flagged for retrofit.
- 2026-09-27: Bea's Waltz research: first pass wrongly converged on 'Benny and Bea's Waltz' (Brenda Wallace-Kuehner);
  Nate confirmed by ear it's a different tune, so that attribution and its 3 recording refs were removed. A second
  pass found nothing new (origin back to unknown, low confidence) — PCC's own newsletter archive, the likeliest
  primary source, was rate-limited and untried. Learned Nate's PCC-sourced tunes are all taught by Sarah Comer, a
  PNW old-time fiddler; added that as a house rule so future low-confidence PCC tunes (Texas Sandy Hill, and the
  Riro's House tuning discrepancy) know who to ask.
- 2026-09-27: Stale-data sweep: fixed Frank's Reel, stuck on "Not played yet" despite 3 hearings including a Sep 22
  Hayden lesson (now "Played, still learning"); checked every other "Not played yet" tune against lesson-specific
  hearings and found no other instances of the bug (an ordinary session/jam hearing doesn't imply he's tried playing
  it, so those weren't stale). Corrected the A1 coverage count above, which had gone stale after later research
  passes.
- 2026-09-27: Recordings pass 3: 13 refs for 10 old-time standards, picked by two parallel agents and audited
  before import (audit rejected 1 of 14 outright, fixed 5 more). 22 tunes now have outside recordings (30 refs), 13
  with a style model.
- 2026-09-27: Roadmap review. Added F9 (a "learned from" field, to stop guessing who taught a tune) and F10 (a
  single "Needs Nate" queue on the gaps page, replacing questions scattered across this file, Working notes and
  research summaries). Filled in F3 with Nate's actual priority order (Hayden > Sarah/PCC > callout-flagged tunes >
  Ritz jam tunes > broadly popular) and practice-log shape (played it + notes + a recording, no scoring); punted
  accompaniment. Noted next steps for A1 (read the VOM packet via Drive), A3 (widen past old-time, harden V7) and A5
  (try the sync now that a Drive connection is available).
