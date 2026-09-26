# Tune book roadmap

Nate's long-running goals for nategrimwood.com/fiddle, written down so any future session can pick them up.
Read this before working on the site. Update it at the end of every session that makes progress:
change a status, add a line to the log at the bottom, and add goals or questions that came up.

There are two kinds of goals:

- **Standing goals** never finish. They describe a standard every tune should keep meeting as tunes get added and
  research improves. Each one has a coverage measure so progress is visible, but coverage is never "done".
- **Features** can be finished. They have a status: `idea` → `designing` → `building` → `shipped`.

**Provenance rule (Nate, Sep 26 2026):** always keep it obvious what came from enrichment runs versus what Nate added from
his own life. His own data (hearings, notes, Drive recordings, links he gave) takes visual and UX precedence. Research lives
in the `research` table and in `refs` with `origin = 'research'`, and it renders in a muted "From research" block at the
bottom of each tune's detail view. Import it with `POST /fiddle/api/research/import` (see `src/worker.js`).

How Nate works: he mostly browses on his phone and asks Claude in chat to change the data, rather than editing on
the site. Propose designs before building anything big, and ask him about gaps instead of guessing.

---

## Standing goals

### S1. Rich genre labels

Every tune has a primary genre plus every secondary genre that honestly applies, so browsing a broad genre surfaces
its close relatives without flooding it with false positives.

- **Genre families (shipped Sep 26 2026):** `GENRE_TREE` in `public/fiddle.html` maps parents to children (Celtic →
  Irish, Scottish, Breton; Scottish → Shetland, Orkney, Cape Breton; Canadian → Québécois, Métis, PEI...; American →
  Old-time → Appalachian → Round Peak...). Picking a parent in the genre filter matches all its descendants. Add new
  traditions to the tree when they show up; anything not in the tree still appears as its own top-level option.
- **Type and Tags filters (shipped Sep 26 2026)** read `research.type` and `research.tags`. Tags vocabulary so far:
  traditional, modern composition, crooked, cross-tuned, pipe tune, modal, three+ parts, slow air, has words,
  descriptive piece, fast showpiece, session standard, jam standard, contra favorite, square dance, Scottish country
  dance, ceilidh, beginner friendly. Reuse these spellings; add new ones sparingly.
- Be generous with traditions: label every tradition where a tune is commonly played, not only where it came from.
- History research (S2) should feed these labels, for example a tune that crossed from Scotland to Cape Breton gets both.
- Research-derived traditions go in `research.genres`, not in Nate's `genres2`. The genre filter includes both unless
  "Primary only" is checked.
- Proposals still to make to Nate: turn "Waltz" and "Camp composition" from genres into types and move those tunes
  under their real traditions (Swedish, Finnish, Old-time, Contra...); consider making Campbell's Farewell to Red Gap
  primarily Scottish.
- Coverage: 129 of 129 tunes had type and traditions reviewed once, and a second generous-traditions and style-tags
  pass (Sep 26 2026). Low-confidence ones: the VOM camp
  compositions, Bea's Waltz, Texas Sandy Hill, Roland White's.

### S2. Everything known about each tune

A full history for every tune: where it came from, who composed it or whose playing it is known from, where it
spread, where it's still played, the recordings and players that made it popular, the regions tied to it, other
names, and any good stories.

- Cite sources (The Traditional Tune Archive, The Session, irishtune.info, Slippery-Hill, the Lomax archive, liner
  notes and so on). Say where sources disagree instead of picking one quietly.
- Needs a place to live on the site: probably a long-form history field shown in the tune's detail view, plus
  structured bits (composer, origin region, dates, source players) that other features can use.
- Stored in `research.summary` (one notable fact) and `research.history` (longer notes and corrections), with `sources`.
- Coverage: 129 tunes have a one-fact summary with sources (Sep 26 2026); none has a full history yet.

### S3. Recordings for every tune, and a well-chosen "top" recording

Collect every useful recording of each tune, and pick a top recording that best teaches **style**.

Nate's rubric for the top recording:

1. **Gold standard:** a single fiddle, played by a master who demonstrates the genre's defining ornamentation or
   rhythmic bowing clearly and with control. His examples: Sarah Comer's recordings (a clear demonstration of style),
   Hayden Stern's lesson recordings, and W.H. Stepp's *Bonaparte's Retreat* (for how Stepp uses double stops).
2. **Source and original recordings:** always include them for their history, but they're usually not the top pick
   unless the playing is also the clearest model of the style. It's a judgment call; Stepp is the counterexample.
3. **Band recordings:** include them, especially ones that were important, well known or exciting takes on the tune.
   They're rarely the top pick because the fiddle's style isn't centered.
4. Learning aids (slowed versions, teaching videos) are welcome as extras.

- Each recording should record who is playing, the year, the source (the Drive file or an external link), its
  category (solo style model, source/historical, band, teaching) and a short note on why it's worth hearing.
- Outside recordings live in `refs` (`kind` recording / sheet / reference, `category` style / source / band / teaching,
  `origin` mine / research). YouTube links and direct audio files play inline, like Drive files; anything else opens in a
  new tab. Any of them can be the top recording (`top_media = 'ref:<id>'`). Auto-pick order: Nate's Drive files, then
  links he added, then research recordings, style models first.
- Coverage: 2 tunes have outside recordings (Bonaparte's Retreat, Willow on the Lake). The main job of the next run.
- Coverage: the share of tunes with at least one style-model recording, and the share with a reviewed top pick.

### S4. Where and when each tune was heard

Keep logging every occasion Nate hears a tune (lessons, classes, jams, sessions, camps). This data drives
prioritization. Nate reports new occasions in chat; log them with `POST /fiddle/api/hearings/import` (upserts an
occasion by `key` and replaces its tune list; the payload format is documented in `src/worker.js`).

### S5. Local session popularity, from community tune lists

**Major goal (Nate, Sep 26 2026).** Community members keep spreadsheets of every tune played at Seattle-area sessions.
Keep the tune book in sync with them and use them as the main measure of how popular a tune is locally.

Sources (linked from Nate's "Fiddle Tune Learning" Google Doc, doc id `1nDN5qlES0aV-cpu9H1R9DhIL8-BpX_8Bl0MMTytl1a4`):

| Sheet | Maintainer | What it has |
|---|---|---|
| Columbia City Jam - Tunes 2022-2026 (old-time), `1u17fwk_FlBi-WLIxICy0MMA76M7j4yhYgZGuS5EqNs4` | Steve Johnston | One row per tune per jam date: date, key, tune, source player, links. Count rows per tune to get times played. |
| PNW Quebecois Tunes, Annotated, `1TYyk_Rh9XSIJ3T1KP6P_Ga8DdJiExfQAXUXQcBwiROo` | Doug Plummer | Tune, meter, key, composer, links, times played, first and last played. |
| Couth Buzzard Irish Tunes (Saturday session), `17PrThLHRKfPzFQ0vrwHWSXugxHbJLsvFBNr8oKJRi9w` | Doug Plummer | Tune, type, key, origin, link, times played, last played. |
| Seattle's Old Time Buddies - Tune Share (Ritz's jam), `1MN3yAbPryeJf_YXJdOBh7T9qSDht_VhD-pfU6tdUDeU` | dzank97 | A shared list of tunes with key, artist, recording link, difficulty. No play counts. |

Nate's rules:

- **Local data beats internet sentiment.** Popularity should come from these play counts first. The current
  `common` score (broad, inferred) is only the fallback for tunes the sheets don't cover.
- **Every tune in these sheets should appear in the tune book**, including ones Nate has never heard.
- **It must stay obvious which tunes Nate has actually heard.** At a glance he should see both "popular at local
  sessions" and "hasn't come up for me yet". This is the provenance rule again, with a third source: community data is
  neither Nate's own life nor AI research, and should look distinct from both. Nate's own hearings keep precedence.

Implementation notes (not yet designed; propose before building):

- Probably a `session_counts` table (tune_id, sheet, times_played, first_played, last_played, synced_at) rather than
  writing into Nate's fields, and a flag or origin on `tunes` for rows created from a sheet (e.g. `origin = 'sheet'`),
  so they can be filtered and are never confused with tunes he logged.
- Match names carefully: sheets use variants ("Abbey Reel, The", "Andy Dejarlis"), so reuse the name/aka matcher and
  keep a manual alias list for misses.
- The sheets live in other people's Drives and are shared with Nate, not with the site's service account. Syncing
  needs either Nate's Drive OAuth token or a periodic import run from chat.
- Coverage: the share of sheet tunes matched to tune book rows, and the date of the last sync per sheet.

---

## Features

### F1. Sort by how often and how recently a tune was heard — `idea`

Sort by times heard, last heard and first heard. The data already exists (`occasions` and `hearings`). Lessons and
classes count toward "times heard" (Nate's decision, Sep 26 2026); each occasion has a kind, so a filter could still
exclude them.

### F2. Sung songs, tracked separately from tunes — `idea`

Nate's notes asked for sung Irish songs to live in the app apart from the fiddle tunes. The ones so far are The
Parting Glass, Safe Home, Health to the Company and The Wild Rover.

### F3. Flashcard-style learning and retention mode — `idea`

An Anki-style mode for learning new tunes and keeping learned ones fresh. This is a big feature, and state
management is central to it. Its parts:

1. **Recommendation algorithm:** suggests which tunes to work on next, weighing Nate's learning priorities. Those
   depend on genre, on how popular a tune is locally (hearing counts from S4 and commonality) and on his
   prescribed learning path.
2. **Practice log:** a memory of every time a tune was served for practice or learning, and what happened.
3. **Active-learning set:** manage the tunes currently being learned, with a configurable cap.
4. **Staleness survey:** show memorized tunes he hasn't touched in a while and that may be going stale.
5. **Accompaniment:** advanced backing like Strum Machine offers (chord-chart playback at adjustable tempo, with
   styles per genre).

Open questions for Nate before designing:

- What is the "prescribed learning path"? Is it a list he sets, weights per genre, or something else?
- How should a practice session be scored (for example again / hard / good / easy, or just "played it")?
- For accompaniment: which Strum Machine features matter most, and where do chord charts come from?

### F4. Popularity overhaul and session-only tunes — `idea`

The feature side of S5. Replace the popularity score with one driven by local play counts, add every sheet tune to
the book, and make "not heard by me yet" unmistakable.

Open questions for Nate before designing:

- How to weight the sessions against each other (for example Columbia City has years of data, Couth Buzzard about two),
  and how much recency should matter.
- Should the score be per genre (popular at the Irish session vs. the old-time jam), overall, or both?
- Should sheet-only tunes count in the header totals, or sit behind a toggle so the main list stays "my tunes"?
- The Old Time Buddies sheet has no play counts. Should being on it count as a fixed popularity boost?
- Public visibility: is it fine to show these session counts on the public site, or should they be editor-only?

---

## Open data questions

- Frank's Reel is marked "Not played yet", but Hayden taught it on Sep 22, 2026 and the video is in Drive. Should it change?
- "Bill Harris" from Maura's VOM class is logged as Bill Collins'. That's a guess and needs confirming.
- Still unidentified: Kid and the Bacon (best guess Bacon Rind), Ravelin Wheel (SFSF favourite; guesses in its notes),
  McClellan's Row and November Sun (maybe a new Katie McNally tune). Nate has no more to add; use judgment.
- More open questions live in the site's Working notes (editor-only).

---

## Log

- 2026-09-26: Created this roadmap. Added the hearing log (21 occasions, 146 hearings), merged the three Peg Ryan's
  polka rows, added Andy De Jarlis to the unidentified list, and added Bonaparte's Retreat (W.H. Stepp, 1937).
- 2026-09-26: Unidentified-titles pass. Identified Andy De Jarlis as Andy De Jarlis' Jig (Métis composer, a Cape Breton favourite) and moved it to the tunes; tagged Sleeping Giant Two-Step as Métis too. Logged leads for the rest under Open data questions.
- 2026-09-26: First broad enrichment run. Added the `research` and `refs` tables and the "From research" block,
  plus inline playback and top-recording picks for outside recordings. Researched type, traditions, region and one
  sourced fact for all 129 tunes. Corrected primary genre (Myra's Jig → Scottish, Return from Helsinki → English,
  Lucy Farr's Polka → Irish), origins (Booth Shot Lincoln, Old Man Gone, Hickory, Kilfenora) and one title
  (Miss Oliver Morris' Reel). Merged "Alabama Walk Around" into Step Around Johnny as an Aug 27 hearing.
- 2026-09-26: Genre labelling pass. Added genre families to the filter (a broad pick like Celtic or Canadian pulls in
  its relatives), Type and Tags filters, and a `research.tags` column (schema 8). Relabelled all 129 tunes with
  generous traditions and style tags (crooked, cross-tuned, pipe tune, session standard...).
- 2026-09-26: Added S5 (local session popularity from community tune lists) and F4 (popularity overhaul and
  session-only tunes), from Nate's request. Nothing built yet.
