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
- Coverage: 269 of 280 tunes have complete core research (live data and deployed gaps checks, Sep 30 2026).
  All 148 entries added in the session-list pass have complete core research. The same eleven older tunes have
  low-confidence research; overlapping gaps include 6 missing types, 2 missing sources, 1 missing traditions and
  1 missing tags. The six missing types are the VOM camp compositions (Cedar Paths, Same Mistakes, Two Months Too
  Soon, Dragon Slayer, Game of Drones, Pacific Sunrise), which need Nate's own knowledge or the tune packet.
  Bea's Waltz, Back Home, Habas para una Amiga, Roland White's and Texas Sandy Hill have a research pass on file
  too, even though several came back low-confidence or unidentified rather than a firm answer.
- The Sep 30 pass added Acadian, Midwestern, Western swing and Jazz vocabulary, plus definitions for slip jig,
  triple hornpipe and quadrille. Source-player versions, alternate meters and uncertain composer attributions
  are stated explicitly rather than forced into a single unsupported claim.
- Next best step: the six VOM camp compositions' keys and types are in the 7.7 MB VOM tune packet in Drive (per
  Working notes). An earlier run had an authorized Drive connection; check current access and try reading the
  packet directly rather than assuming that connection persists. Add "crooked" and "cross-tuned" checks from Slippery-Hill and the
  Traditional Tune Archive; label tunes added since.
- Proposals waiting for Nate: turn "Waltz" and "Camp composition" from genres into types and move those tunes under
  their real traditions; consider making Campbell's Farewell to Red Gap primarily Scottish.

### A2. Everything known about each tune — M per pass (formerly S2)

A full history for every tune: where it came from, who composed it or whose playing it's known from, where it spread,
where it's still played, the recordings and players that made it popular, other names, and good stories.

- Cite sources (The Traditional Tune Archive, The Session, irishtune.info, Slippery-Hill, the Lomax archive, liner
  notes...). Say where sources disagree instead of quietly picking one.
- Stored in `research.summary` (one notable fact) and `research.history` (longer notes and corrections), with `sources`.
- Coverage: all 280 tunes have a one-fact summary, 278 have source URLs, and 35 have history text
  (live data, Sep 30 2026). Having text is not a separate check of its factual quality. Some new community-only
  composer credits remain explicitly attributed to the source sheet, with medium confidence.
- Next best step: full histories for the most-heard tunes first.

### A3. Recordings for every tune, and a well-chosen top recording — M per pass (formerly S3)

Collect every useful recording of each tune and pick a top recording that best teaches **style**.

**Current method:** use [the recording-curation skill](.github/skills/recording-curation/SKILL.md)
(updated Sep 29, 2026) for future runs. It adds comparison-based selection, track-level evidence, explicit
listening unknowns, and a hard hold when an audit's evidence does not satisfy tune identity. Nate's listening
feedback now makes accomplished-musician YouTube performances an explicit search priority. Method v1 below
remains the historical checklist.

Nate's rubric for the top recording:

1. **Gold standard:** a single fiddle, played by a master who demonstrates the genre's defining ornamentation or
   rhythmic bowing clearly and with control. His examples: Sarah Comer's recordings, Hayden Stern's lesson
   recordings, and W.H. Stepp's *Bonaparte's Retreat* (for how Stepp uses double stops).
2. **Source and original recordings:** always include them for their history, but they're usually not the top pick
   unless the playing is also the clearest model of the style. Stepp is the counterexample.
3. **Band recordings:** include them, especially important, well-known or exciting takes. They can be less
   useful for isolating fiddle technique, but do not automatically rank them lower as listening recommendations.
   Nate preferred George Jackson's full-band YouTube performance in the Angeline pilot (Sep 29, 2026).
4. Learning aids (slowed versions, teaching videos) are welcome as extras.

- **Listening preference (Nate, Sep 29, 2026):** an accomplished musician playing the tune on YouTube is often
  something he is interested in. Search that route deliberately alongside archives and sources, rather than
  making solo fiddle a gate. For Angeline the Baker, George Jackson's
  https://www.youtube.com/watch?v=9bnD-scYPyc was his favorite; the other selections were good too. Keep the
  complementary picks and accurate category labels. No specific reason for the preference was given.
- Each recording records who plays, the year, the link, its category (style / source / band / teaching) and a short
  note on why it's worth hearing. Outside recordings live in `refs` (`origin` mine / research). YouTube links and
  direct audio files play inline like Drive files; anything else opens in a new tab. Any can be the top recording
  (`top_media = 'ref:<id>'`). Auto-pick order: Nate's Drive files, then links he added, then research recordings,
  style models first.
- Coverage (Sep 30 2026, after the session-list pass; research-origin recordings only): 29 tunes have outside
  recordings (42 refs), 15 with a style-model candidate. Including personal refs, the editor-visible totals
  are 43 recordings across 29 tunes, 16 with a style model. Done so
  far: the most-heard old-time tunes (Angeline the Baker, Old Joe Clark, Step Around Johnny, Ducks on the Millpond,
  Fly Around My Pretty Little Miss, Five Miles from Town, Red Haired Boy, Soldier's Joy, Cherokee Shuffle,
  Cumberland Gap, Dry and Dusty, Forked Deer, Little Liza Jane, Spotted Pony, Sandy Boys) and Frank's Reel,
  Cliffs of Moher, La Bastringue, Buntàta 's Sgadan, Mrs. MacLeod of Raasay, Sleep Soond Ida Mornin',
  Bonaparte's Retreat, Music for a Found Harmonium, Le Coin du balcon, Salt Spring, Itzbin Reel, Hartford's Real
  and Cache tes fesses.
- Waiting for Nate's ear: Martin Hayes, "Kilfenora Jig" on Under the Moon (1995,
  https://www.youtube.com/watch?v=4Cc9P-mkjLs, second tune in the track). The Traditional Tune Archive says it's The
  Old Favourite, but irishtune.info files it as a slide, so it may be a different tune. Add it once Nate confirms.
- Bonaparte Crossing the Alps / Rhine (Sep 29): the class settings still need identifying before outside
  recordings are attached. Reviewed Ramona Jones and Clyde Blair for Alps, and the Cooper/Haas performance,
  Fuzzy Mountain String Band and Alfred Bailey for Rhine; all remain held rather than matched by title or key
  alone. The existing teacher recordings stay linked and preferred. Evidence and candidate URLs are retained
  privately in the Bonaparte session's `four-tune-curation.json`.
- Streaming link preference (Nate, Sep 27 2026): when a track isn't on YouTube or direct audio, link Tidal before
  Spotify or Apple Music. Retrofit the 3 Spotify-only pass-1 links and the Step Around Johnny Apple Music link to
  Tidal equivalents when a future pass touches those tunes.
- Next passes: widen out from old-time — Irish, Scottish and Québécois are thin on outside recordings. Make V7
  (tune identity) a hard stop rather than a judgment call: it was the top failure mode across all three passes
  (Forked Deer, Little Liza Jane, Spotted Pony, Buffalo Gals) and, outside this project, Bea's Waltz.
- **One-tune quality pilot (Sep 28-29, 2026): imported and verified.** Angeline the Baker (commonness 10)
  now has four research recordings. Added Brad Leftwich with Brett Riggs
  (1990, provisional old-time style candidate, not solo); George Jackson's Old Time 100 overhead-camera
  performance (a five-piece band and explicitly Pyeatt-derived variant); and Casey Willis's public performance/
  lesson excerpt (teaching, not the full paid course). Corrected Edmonds's unsupported recording year and
  removed the stale Hollow Rock attribution. An independent audit checked the shortlist, but its
  unresolved Franklin George tune-identity/linkage caveat overrode its overall OK: that lead stays held.
  No verified unaccompanied-master pick; Nate subsequently preferred Jackson and liked the other selections
  too. After owner sign-in, imported
  through the editor API (new refs 35-37, existing ref 4 corrected); authenticated read-back and independent
  D1 reads confirmed the intended records, with personal data, core research and top selection unchanged.
  The gaps page has no core or outside/style-recording gaps for this tune. No audio/video was played.
  The reviewed payload, before/after snapshots and evidence ledger remain in the Recording quality session.
- **Visibility clarified (Nate, Sep 28, 2026):** research refs may be public; Nate's personal refs and Drive
  recordings remain editor-only. The Worker fix filters signed-out refs by `origin = 'research'`, while
  retaining all refs for editors and authenticated JSON backups. Shipped Sep 29 in main commit `5f0deb0`:
  Workers Builds succeeded, the live public API returned only the 33 research refs, and the personal ref
  remains stored in D1.
- **Four-tune follow-up (Sep 29, 2026): imported and verified.** Used the recording-curation skill and an
  independent V1-V7 audit for the three Bonaparte tunes and Music for a Found Harmonium. Added Andy Reiner's
  artist-identified Stepp version to Retreat, and Celtic Fiddle Festival's 2014 concert, Penguin Cafe
  Orchestra's original album take in its 2008 remaster, and Patrick Street's Irish Times arrangement to
  Harmonium (new research refs 39-42). No unverified solo/style designation or recording date was invented.
  Jeffes' authorship is sourced independently of the PCO upload's erroneous "Traditional" credit. Six leads
  remain held: the five crossing-tune candidates above and Molsky's two unnamed Retreat versions.
  Exact field read-back confirmed the four imports; personal refs, teacher links, existing research, learning
  status and manual top selections were unchanged. Stepp remains Retreat's editor-side top recording.
  All four tunes have no core research gaps. No audio/video was played; direct-audio checks loaded metadata
  only. The evidence ledger, independent audit and import receipt remain in session artifacts.
- **Session-list follow-up (Sep 30, 2026): five references imported and verified.** Added André Brunet's
  Le Coin du balcon with documented fiddle/feet and guitar as a provisional style candidate; the
  Reischman/Hargreaves/Tuttle Salt Spring band recording; Reischman's Itzbin Reel with Chris Thile and
  Mike Barnett; Bush/Grisman's Hartford's Real with its original liner-note personnel; and Brunet's
  publisher-described Cache tes fesses lesson. The independent V1-V7 audit returned four OK and one FIX:
  the verified 2017 release year was added to Le Coin's note, without claiming a recording-session date.
  Its composer attribution remains qualified as the community sheet's claim. New refs are 43-47, all
  research-origin. Existing refs, private data and manual top selections were unchanged. No playback occurred.

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

- **Quality pilot (Sep 28-29, 2026), one tune, three additions and one correction.** Focused on Angeline the Baker rather than
  increasing coverage. The useful improvement was to evaluate actual takes: search synthesis supplied
  mismatched video URLs/channel credits; an overhead fiddle camera concealed a full-band lineup; original
  sleeve credits resolved track instrumentation that album-level credits could not. An audit's OK still
  contained a V7 uncertainty, so that recording was held. Found the prior Hollow Rock correction had never
  reached the stored Edmonds note. Saved the reusable method in the skill linked above. Completed the
  signed-in editor-API import on Sep 29 and confirmed persistence independently through D1. Nate's subsequent
  listening verdict favored Jackson while approving the other selections too; personal recordings and the
  top selection were not replaced.
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
an occasion by `key` and replaces its tune list; payload format in `src/worker.js`). "Heard" excludes lessons
and classes; the main page and Markdown export share that rule in `public/fiddle/hearings.js` (Sep 28 2026).
All encounters remain in the database and JSON export. "First encounter"/"From"
and the gaps page's "No encounter logged" check include lessons and classes.

- Coverage (live data, Sep 30 2026): 125 of 280 tunes have any hearing logged; 92 have a hearing outside lessons
  and classes. The community imports added no personal encounters or learning progress.

### A5. Local session data from community tune lists — M per sync (formerly S5)

**Major goal (Nate, Sep 26 2026).** Community members keep spreadsheets of every tune played at Seattle-area sessions.
Keep the tune book in sync with them. This item is the data sync; F4 below is the feature that uses it.

**Progress (Sep 30 2026): populated, with three explicit identity holds.** Imported 148 new tune/settings records
through the signed-in editor API, bringing the book from 132 to 280. Reconciled 28 existing-book matches,
adding 25 previously missing memberships. There are now 176 linked tune records across the five sources.
All 148 additions have complete core research, start as "Not played yet," and have no invented hearing.
`data/session-tunes/candidates_pass1.json` is now a **historical snapshot**, not a pending queue or a safe
re-import payload.

Sources (the first four linked from Nate's "Fiddle Tune Learning" Google Doc, id
`1nDN5qlES0aV-cpu9H1R9DhIL8-BpX_8Bl0MMTytl1a4`; NWSF added Sep 27 2026 at Nate's request):

| Sheet | Maintainer | What it has | "Top" means (Nate, Sep 27 2026: be thoughtful per-source, cap at 25) |
|---|---|---|---|
| Columbia City Jam - Tunes 2022-2026 (old-time), `1u17fwk_FlBi-WLIxICy0MMA76M7j4yhYgZGuS5EqNs4` | Steve Johnston | Seven tabs; the complete "All, by Date" log has 3,084 data rows. Recent and key-specific tabs are overlapping views, not additional plays. | The previously selected 25-tune cohort is retained. Its old global ranks were withdrawn after discovering that title normalization combined distinct source-player settings. Displayed counts now state their scope; this is not a newly proven global top 25. |
| PNW Quebecois Tunes, Annotated, `1TYyk_Rh9XSIJ3T1KP6P_Ga8DdJiExfQAXUXQcBwiROo` | Doug Plummer | Tune, meter, key, composer/source credit, links, play count and dates; 388 rows in the Sep 30 snapshot. | Top 25 rows by the sheet's "Times Played" column, with stable sheet order for ties. White Buffalo / Cut Knife Hill names two different melodies, so that row maps to two records; its 38 plays are explicitly a shared-row total, not two individual play counts. |
| Couth Buzzard Irish Tunes, `17PrThLHRKfPzFQ0vrwHWSXugxHbJLsvFBNr8oKJRi9w` | Doug Plummer | Tune, type, key, origin, link and counts; 528 rows on the canonical "Session tunes" tab in the Sep 30 snapshot. | Top 25 by "Times Played." The previously audited "Copy of Session tunes" is a stale duplicate, while "Temp" and "Scale modes" are not ranking sources. |
| Seattle's Old Time Buddies - Tune Share, `1MN3yAbPryeJf_YXJdOBh7T9qSDht_VhD-pfU6tdUDeU` | dzank97 | Curated 30-tune share list, with keys and recording suggestions but no frequency signal. | Entire curated list; no invented play counts or numerical ranking. Membership does not establish that Nate heard or played a tune there. |
| [NW Scottish Fiddlers - TOP-FIDDLE-TUNES.docx](https://www.nwscottishfiddlers.org/wp-content/uploads/2024/09/TOP-FIDDLE-TUNES.docx) | NWSF club | The 2024 curated reference has 64 main entries plus nine distinct additional selections in its set notes. Not a session Nate attends. | Entire curated document: 73 tunes, not just the earlier 64-name extraction. Duplicate set mentions count once, and translated/abbreviated existing-book matches are reused. |

- Nate's rules: local play counts beat broad internet sentiment; every sheet tune should appear in the tune book;
  and it must stay obvious which tunes Nate has actually heard. Community data is a third provenance, distinct from
  both Nate's own data and research. He only wants the top 25 per session at most, and "top" should be defined
  per-source rather than forced into one formula (see table above).
- **Provenance and status:** the existing UI derives "Local favorite, not yet heard" from community membership
  and counted hearings. Do not handwrite that statement into personal notes, invent a style tag for it, or turn
  a sheet appearance into a personal hearing. New records start at "Not played yet"; existing learning status,
  interest flags, personal references, private notes and manual top selections remain unchanged.

**Live coverage, Sep 30 2026**

| Source | Selected source rows | Resolved rows | Linked tune records |
|---|---:|---:|---:|
| Columbia City Jam cohort | 25 | 25 | 25 |
| PNW Québécois | 25 | 25 | 26 |
| Couth Buzzard Irish | 25 | 24 | 24 |
| Old Time Buddies | 30 | 28 | 28 |
| NW Scottish Fiddlers | 73 | 73 | 73 |
| **Total** | **178** | **175** | **176** |

The extra record is the White Buffalo / Cut Knife Hill split. There are 148 new records and 28 reused existing
records, not 176 newly created tunes. Examples of recovered existing matches include Josephine/Josefin's Waltz,
Kerfuntin/Kerfunten, My Kindly Sweetheart/My Gentle Milkmaid, Barrowburn, Stan Chapman, Reconciliation and
Chattanooga (Old)/Old Chattanooga.

**Held, not imported or silently matched**

| Source entry | Identified source | Remaining question |
|---|---|---|
| Kilfenora Jig, Couth Buzzard D setting | [Perrine's D-jig performance](https://www.youtube.com/watch?v=6CK3Wofgx-o) | Distinguish this setting from the existing G/A Old Favourite and the other D-major Kilfenora jigs. Nate was asked to compare; no confirmation was available. |
| Cold Frosty Morning, Old Time Buddies | [The Wayfarers, Fire on the Hillside](https://www.youtube.com/watch?v=Ep3oLlP_PE0) | Confirm the melody/source family; do not substitute the common Henry Reed setting solely from the title. |
| Lost Indian, Old Time Buddies | [Michael Cleveland, Flame Keeper](https://www.youtube.com/watch?v=MF3tF_5YSQs) | Establish the particular Lost Indian setting; do not guess an Eck Robertson or Cherokee Shuffle relationship. |

**Count and ingestion corrections**

- Source-player qualifiers matter. The Collins Sail Away Ladies count is 27, not the old 73-title-bucket total;
  Marion Reece's Liza Jane has 18 exact source-title rows, not 23 mixed entries; the selected Cowboy Waltz has
  14 Pyeatt-attributed rows, not the old 20 mixed settings. Cumberland Gap's 38 rows are explicitly a mixed-setting
  title-family total, not a count for Nate's A setting. Columbia City's numeric ranks remain withdrawn until a
  defensible, variant-aware global ranking is rebuilt; its selected cohort was not silently changed.
- Read the full Columbia City "All, by Date" tab, not the default recent view. Set `headers=1` for gviz exports:
  automatic header inference swallowed the first several Old Time Buddies tunes. XLSX hyperlink targets also
  recovered links whose CSV cells contained only display text, such as O'Sullivan's March.
- The Sep 30 source snapshots were readable through the published CSV/XLSX/document URLs. Do not assume that
  an earlier session's Drive connection or browser sign-in is available now. All writes still require the
  signed-in editor API; no direct D1 enrichment writes were used.
- `POST /fiddle/api/session-sources/import` replaces each supplied sheet wholesale. Send the full intended
  membership set using verified tune IDs; an `unmatched` response does not persist pending candidates.
  Preserve version qualifiers and a reviewed raw-source-to-tune map rather than stripping them during matching.
- The source tables do not turn community play counts into personal hearings, global commonness scores or
  high-interest marks. The future numeric `session_counts` sync and F4 weighting design remain separate work.

The private **Session tune imports** artifacts (session `091259e3-f796-443d-a5e4-45855bbc71b4`) contain the
source snapshots, reviewed manifest, resolved source map, three holds, independent recording audit, import
receipts and before/after editor snapshots. `verification-report.json` checks every expected field and source
membership, runs the deployed gaps-page core checks, and confirms preservation of the original 132 tunes and
their research, all previous refs, personal notes, hearings, media links and top choices. Public responses still
exclude private data. No audio or video was played.

**Next:** resolve the three held identities without guessing; then design a repeatable source-aware sync using
this completed mapping. Deeper histories and recordings remain open enrichment work, not blockers to the
148 imported records' complete core research.

### A6. Cleanup: unidentified tunes and data questions — S

Work through "Open data questions" below and the site's Working notes (editor-only).

---

## B. Features (can be finished)

### F1. Sort and filter by hearings — `shipped` (Sep 26 2026) · S

Sorts: most heard, recently heard, first heard. Filter: heard in real life (any, or at a jam, session, camp or
other counted occasion) versus not heard yet. Lessons and classes are excluded from this view as of Sep 28 2026.
Possible extras: a "heard in the last N months" filter.

### F2. Sung songs, tracked separately from tunes — `idea` · M

Nate's notes asked for sung Irish songs to live in the app apart from the fiddle tunes. So far: The Parting Glass,
Safe Home, Health to the Company, The Wild Rover.

### F3. Flashcard-style learning and retention mode — `idea` · L

An Anki-style mode for learning new tunes and keeping learned ones fresh. State management is central.

1. **Recommendation algorithm**, in priority order (Nate, Sep 27 and Sep 29 2026):
   1. Tunes from Hayden not yet memorized.
   2. Tunes from Sarah / PCC not yet memorized.
   3. High-interest tunes not yet memorized, using the explicit `tunes.high_interest` flag (F11). These rank
      immediately behind tunes being learned from Hayden and Sarah / PCC, ahead of jam/session popularity.
      Use the flag for personally important tunes; a free-text note alone does not set this priority.
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

Open questions: how much weight the staleness survey gets relative to new-tune priority; where chord charts would come from if/when
accompaniment happens. Needs F4 + A5 for priority tier 5, and F9 (a "learned from" field) to drive tiers 1-2
without text-matching on `source`.

### F11. High-interest tunes — `shipped` (Sep 29 2026) · S

An explicit star on each tune, independent of learning status, with a "High interest only" filter that combines
with the existing search and filters. Saved through the editor API, included in edit history/undo and backups,
and shown read-only to visitors. Existing tunes default to unmarked. This supplies F3's third priority tier;
the practicing/learning/flashcard recommendation system itself remains a future feature.
Bonaparte's Retreat and Music for a Found Harmonium are marked high interest; both remain "Not played yet."

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

First explicit feedback example (Sep 29, 2026): George Jackson was Nate's favorite among the Angeline pilot
recordings, and the other selections were good too. Preserve listener preference separately from research
provenance, category and the manual top-recording setting; this feedback did not request a top-setting change.

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
  Bacon Rind now has a separate community-sourced entry; that does not confirm or transfer the unidentified
  Kid and the Bacon hearing.

---

## Log

- 2026-10-03: Reworked the search and filter area. A large sticky search bar has a "Within filters / Everything" scope switch
  (Everything ignores every filter; a no-result search within filters offers a one-click "Search every tune instead"); the
  filters sit in labeled rows (My playing, The tune, Where from) with Sort in the last row; a chips row shows every active
  filter with an x, plus Clear all, Default view and an "N of M tunes" count. This replaces the earlier rule that search
  ignored only the default status filter. The default view is now Memorized + Played, still learning only (the new
  "Played, not maintaining" tunes are hidden by default), because the default is what visitors see of what Nate knows.
  Queued by Nate for later: add Noon Lasses with full research, find Hayden's YouTube recording with "Nobody's Business"
  plus other recordings, and mark it high interest.
- 2026-10-03: Added a fourth learning status, "Played, not maintaining" (stored as 3, so existing 0/1/2 rows and backups are
  unchanged; the page shows it between "still learning" and "not played yet"). Moved seven tunes into it through the editor
  API: Back Home, Cedar Paths, Same Mistakes, Two Months Too Soon, Dragon Slayer, Game of Drones and Pacific Sunrise. Still
  "Played, still learning": the Bonaparte tunes, Trip to Skye, La Bastringue, Reel St-Antoine, Earl of Dalhousie's Happy
  Return, Myra's Jig, Harris Dance and the two Habas. The default view now shows all played tunes ("All played").
- 2026-10-03: Searching now looks across every status when the status filter is still the default (Memorized + Played), with a
  note saying so, so tunes hidden by the default never look missing; a status chosen on purpose still applies. The status
  button reads "Memorized + Playing" instead of "Status: 2 selected". Session-list badges and the detail panel now show a
  five-bar popularity meter within each list (play count as a share of that list's busiest tune; Columbia City Jam uses
  its title-family counts; NW Scottish Fiddlers and Old Time Buddies have no counts so show only a name), plus a "Sort:
  most played in session lists" option that respects the Session lists filter.
- 2026-10-03: Added a read-only viewer role. `VIEWER_EMAILS` (wrangler.jsonc) lists Google accounts that sign in and read everything
  the editor can (private notes, personal links, hearings, working notes, Drive recordings) but can't change anything: the
  API gate refuses every non-GET and every route outside a small read allowlist with 403, passkeys/Drive admin/sessions
  stay editor-only, and the page shows a read-only view with "Signed in as ... (view only)". Roles are rechecked each
  request, so removing an email revokes access at once. First viewer: johnswatson.music@gmail.com. Verified in a mock-D1
  test harness (44 checks); the Google sign-in screen and Drive share are set up outside the repo.
- 2026-10-03: Defaulted the main page's status filter to Memorized and Played, still learning, so the 225
  "Not played yet" tunes (mostly community-list imports) no longer crowd the view; the Status filter's "Clear" shows
  everything, and adding a tune still clears it so the new tune is visible. Documented in `AGENTS.md` and
  `CLAUDE.md` that the Windows workstation (git checkout, Wrangler/D1 read access) and cloud/mobile sessions (browser
  only: GitHub web editor plus the signed-in editor API) follow different delivery workflows. Audited the Sep 28-30
  changes from a cloud session: no conflicts with the original session-list, redesign or heard-rule intent; the
  three A5 identity holds and the low-confidence research on Nate's own tunes are still open. Delivered from a cloud
  session through GitHub's web editor, straight to `main`; no audio or video played.

- 2026-09-30: Populated the five A5 source lists with 148 new, core-enriched tune/settings records and
  25 missing memberships on existing records: 280 tunes in the book, 176 linked records, 175 of 178 source
  rows resolved. Recovered nine Scottish set-note selections omitted from the old 64-name extraction;
  split White Buffalo and Cut Knife Hill with explicit shared-count scope. Withdrew misleading Columbia
  City ranks and corrected mixed-setting counts. Three identities remain held: the Couth Buzzard D Kilfenora,
  the Wayfarers' Cold Frosty Morning and Cleveland's Lost Indian. Added five independently audited
  recording refs (43-47), preserving release/recording-date distinctions and all manual top selections.
  Original personal data and all 132 pre-existing tune/research records were unchanged; no hearings or
  learning progress were inferred. The deployed gaps rules report zero core gaps for all 148 additions.
  Added slip-jig, triple-hornpipe and quadrille definitions, four tradition labels, and wrapping for qualified
  source statistics on phones. These code changes were pushed directly to main and their Workers Builds
  and live assets were confirmed; data changes were separately imported and read back through the editor API.
  Source snapshots, field comparisons, privacy checks, the full mapping and holds remain in private session
  artifacts. Updated A1-A5 coverage; no audio/video playback.

- 2026-09-29: Shipped high-interest marking and filtering (F11), with a schema-9 default, validated editor
  updates, undo/history and JSON/Markdown exports. Main commit `6aa8082` passed Workers Builds and the live
  site serves the new controls. Set F3's future priority order to Hayden, Sarah / PCC, then high-interest
  tunes, ahead of jam/session popularity. Through the editor API, marked Bonaparte's Retreat high interest
  and added Music for a Found Harmonium with complete sourced core research and the same mark. Both are
  "Not played yet"; no encounter was invented for Harmonium. The two crossing tunes remain still learning.
  Completed the four-tune recording-curation pass described in A3: four audited refs imported, ambiguous
  variants held, and private recordings and top choices preserved. Updated live coverage counts.

- 2026-09-29: Nate authorized direct-to-main delivery as the standing default for this single-contributor,
  low-risk personal project, including automatic resolution of ordinary concurrent-session conflicts. Added
  root AGENTS.md guidance, linked it from CLAUDE.md and README, and replaced the feature-branch-only delivery
  note. Integrated main's hearing-consistency changes with this session's privacy fix and recording skill.
  Resolved roadmap conflicts by retaining both logs and reconciling research-only versus all-reference
  coverage against live totals. Seven privacy regressions and the Worker dry-run passed. Pushed merge
  `5f0deb0` directly to main; Workers Builds completed successfully and the live public API now excludes
  personal refs while retaining all four Angeline recordings. D1 still contains the personal ref, and the
  deployed hearing helper retains the other session's behavior.

- 2026-09-29: Clarified delivery at Nate's request: this session has pushed directly to the GitHub repository's
  `naowen-microsoft-recording-quality` feature branch, not to `main`. The curation skill, documentation and
  privacy fix are not merged into `main`; the privacy fix is not deployed. The recording data is independently
  live through the editor API. Added the explicit status to README and a delivery-reporting rule to CLAUDE.md.

- 2026-09-29: Nate's feedback on the Angeline pilot: George Jackson's YouTube performance was his favorite,
  and the other selections were good too. Updated the recording-curation skill and A3 to actively search
  accomplished musicians' YouTube performances, and to distinguish a solo-fiddle teaching ideal from an
  overall listening recommendation. Full-band accompaniment is not an automatic downgrade. Recorded the
  verdict privately with the evidence; no live refs, provenance, personal data or top selection changed.

- 2026-09-29: Completed the Angeline the Baker recording import after owner sign-in. Added Brad Leftwich/
  Brett Riggs (style candidate), George Jackson's Old Time 100 variant (band), and Casey Willis's lesson
  excerpt (teaching); corrected Norman Edmonds's unsupported date and Hollow Rock lineage note. Four refs
  now persist for the tune, all with research provenance. Checked every stored field, preserved the existing
  source-ref ID and all private/core/top-selection data, and independently confirmed rows through read-only
  D1 access. The tune has no core or outside/style-recording gaps. Research-only coverage is now 33 recordings
  across 22 tunes, with 14 style-model candidates. Updated the curation skill with the completed result and
  the distinction between database authorization and owner API sign-in. No media playback or deployment.

- 2026-09-29: Authorized direct access to the existing `tunebook` D1 database through Wrangler's device
  OAuth flow, with account/user lookup and D1 permissions only. Installed the missing Windows keyring
  support; credentials are protected by Windows Credential Manager, not committed. Used npm-cached Node 22
  and available Wrangler 4.136.3 rather than changing the system Node or the unavailable package pin.
  A read-only query returned Angeline the Baker (ID 1), with zero rows written. At that point the recording
  import and privacy-fix deployment were still pending; the branch's Worker dry-run build succeeded.

- 2026-09-28: One-tune recording-quality run for Angeline the Baker. Prepared three complementary recordings
  and an Edmonds metadata correction; held the Franklin George lead on unresolved identity/linkage.
  No data import occurred because authenticated editor access was unavailable. Added
  `.github/skills/recording-curation/SKILL.md` with the evidence and selection lessons, and linked it from the
  agent instructions and README. Nate clarified public research refs versus private personal refs and
  approved a small privacy fix: the public API now filters personal/unknown-origin refs in the branch code,
  while editor responses and authenticated exports retain them. Added synthetic Worker API regression
  coverage. Code/skill changes are separate from the still-pending live data import; deployment is pending.

- 2026-09-29: Added Bonaparte Crossing the Alps and Bonaparte Crossing the Rhine through the signed-in editor
  API, both "Played, still learning"; linked their existing class recordings and added them to the existing
  PCC Fall 2026 class occasion without losing its nine earlier entries. Bonaparte's Retreat was left unchanged.
  Both new tunes have sourced core research and history, with medium confidence and no core gaps. Kept the
  class settings' keys and forms unconfirmed: American major-key settings and an Irish A-Dorian march share
  Bonaparte titles, so outside recording picks were held rather than matched by title alone. Cloudflare D1
  access worked for read-only scan lookup and verification; all data changes used the editor API.
  Separately, an ordinary embedded-browser reload retained sign-in, but navigation to the gaps page lost it;
  browser-pane session persistence remains unresolved, with no authentication code changed.

- 2026-09-28: Hearing consistency fix; Nate approved direct deployment to `main` instead of a PR after the
  app's PR action used its work-account credentials. Shared the non-teaching encounter rule
  between the main page and Markdown export, clarified the first-encounter labels, and renamed the
  gaps check to "No encounter logged" without changing which records satisfy it. Included the evaluation's
  corrected coverage figures. Nate deferred test infrastructure and recovery fixes; community-list population
  is a separate next task. No tune data, import behavior, undo behavior or deployment configuration changed.

- 2026-09-28: Project evaluation against the live public API and current code. Updated stale research, recording
  and hearing coverage above; the book has 129 tunes (36 memorized, 17 learning, 76 not played yet). Production
  deployment works, and the sampled public response excludes private notes and Drive media. Engineering
  follow-ups before larger imports/features: add real regression tests and CI (`npm test` currently discovers
  zero tests despite README's claim); include `session_sources` in exports and establish a documented restore
  procedure; repair promotion undo, which restores the unidentified title but leaves hearings pointing to the
  deleted tune; align the markdown export's "Heard" semantics with the main page. The latter three issues were
  reproduced locally with synthetic data, not by modifying production. Editor-only Drive coverage, signed-in
  browser flows and Cloudflare recovery settings were not evaluated. No application code changed in this review.

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
