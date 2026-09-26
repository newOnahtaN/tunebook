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

- A broad pick should pull in its relatives: **Scottish** should bring up Shetland and Cape Breton, **Celtic** should
  cover Irish, Scottish, Shetland and Cape Breton, and **Québécois** should bring up Gaspé. Likely design: a genre
  family map (parent → children, plus "related" links) that the filter expands, kept separate from each tune's own
  labels. This has not been decided yet; propose it to Nate first.
- Go beyond regions: add tune type (reel, jig, strathspey, march, waltz, polka, hornpipe, schottische), crooked vs.
  square, and any dance or style tradition it belongs to.
- History research (S2) should feed these labels, for example a tune that crossed from Scotland to Cape Breton gets both.
- Research-derived traditions go in `research.genres`, not in Nate's `genres2`. The genre filter includes both unless
  "Primary only" is checked.
- Proposals still to make to Nate: turn "Waltz" and "Camp composition" from genres into types and move those tunes
  under their real traditions (Swedish, Finnish, Old-time, Contra...); consider making Campbell's Farewell to Red Gap
  primarily Scottish; the genre family map.
- Coverage: 129 of 129 tunes had type and traditions reviewed once (Sep 26 2026). Low-confidence ones: the VOM camp
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
