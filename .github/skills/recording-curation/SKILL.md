---
name: recording-curation
description: Curate high-quality fiddle recordings for the tune book, especially deep one-tune recording research, style-model selection, source verification, and recording enrichment imports. Use when asked to find better recordings or improve recording-research quality.
---

# Recording curation: quality before coverage

The goal is a recording Nate will actually want to learn style from, not more links
or a filled gap counter. Read `ROADMAP.md` A3 and `CLAUDE.md` first. Keep the scope
to the requested tune(s); a deep one-tune run is not permission to import a batch.

## Non-negotiables

- Never play audio or video in the browser, even muted. Use page/track metadata,
  YouTube oEmbed, liner notes, and static images. A direct-audio check may use a
  muted `Audio` with `preload = 'metadata'`, never `.play()`.
- Do not claim to have heard clarity, groove, ornamentation, balance, distortion,
  or musical excellence from a title, photograph, waveform, or famous name.
  Distinguish **documented facts**, **suitability inferred from those facts**, and
  **Nate's listening verdict**.
- Data writes use the signed-in editor API, not D1, seed files, forged sessions,
  or credentials copied from a browser. Never ask for a session cookie.
- Public research refs are allowed to be public (Nate, Sep 28, 2026). Personal
  refs (`origin = 'mine'`), Drive recordings, working notes, and private hearing
  details remain private. Keep scoped snapshots and import payloads in session
  artifacts, not `public/` or committed research datasets.

## 1. Establish the target and the baseline

Start on `/fiddle/gaps`, then read current `/fiddle/api/data`. Use an existing tune
ID when possible. Record its name, aliases, tradition, key/form, research, existing
refs, and current top selection. Use authorized editor access for private data;
if direct D1 access has also been authorized, narrowly scoped read-only queries
can independently verify persistence and protected-field values. Never replace
a teacher's or Nate's own recording just because a public recording is easier
to find.

For a "very common tune" request, use a high current commonness score or documented
session frequency; do not choose an obscure tune merely because its archive is
easy. Explain the choice briefly. Track the live baseline rather than assuming
the roadmap's counts include the same origins or the same date.

Resolve the musical identity before searching: unrelated same-title tunes,
song versus instrumental, numbered variants, source-player versions, and medleys.
The same key is not proof of the same tune; a different key is not proof of a
different tune. Use authoritative identity/lineage evidence. Unresolved identity
is a hold, not a low-confidence import.

## 2. Build a comparison set, not a list of convenient links

Search along three complementary routes:

1. **Tradition and lineage:** authoritative tune annotations, discographies,
   archive catalogues, label tracklists, and original sleeves establish source
   players and recordings worth seeking.
2. **Living style models:** respected fiddlers' own catalogues, concert archives,
   artist-published performances, and teacher-curated full-speed demonstrations.
   Prefer a single exposed fiddle in the target tradition, then sparse
   accompaniment. Check the actual track, not just the performer's reputation.
3. **Learning-oriented production:** artist-made tune collections, performance
   videos paired with lessons, close-up camera editions, and basic/advanced
   demonstrations. These can be valuable without earning the style-model slot.

Use authority to seed the search, not to lock it to a few familiar names. Search
aliases and shortened titles. A general web search can miss a recording which is
indexed on the platform under an unexpected title.

When broad search keeps returning beginner covers or generic recommendations,
change source, not merely wording: inspect the artist's actual catalogue, an
archive's tune-title index, or direct platform results. Capture exact URLs from
the result/metadata. AI search prose has supplied different video IDs and URLs
from its own citations; neither is accepted until opened and matched.

Keep only recordings with distinct listening purposes. Possible roles are a
primary style candidate, a meaningful historical source, an exceptional or
instructive band interpretation, and a useful teaching supplement. These are
not quotas. Several copies of one take are not several useful recordings.

## 3. Judge the actual take

Use separate criteria; do not hide unknowns behind a numerical quality score.

| Criterion | Evidence to seek | What it does not establish |
|---|---|---|
| Musical authority | Tradition-specific biography, teacher/label credentials, source lineage | That every take by the player is a useful model |
| Fiddle exposure | Track-level instrument credits, explicitly documented solo/sparse lineup | One credited artist or a fiddle close-up does not mean unaccompanied |
| Learnability | Complete performance, access to the tune in a medley, normal-speed example, documented camera/lesson format | A slow beginner arrangement is not automatically a stylistic model |
| Production/access | Artist's recording context, usable public link, documented runtime, embedding metadata | Technical availability is not good sound or good music |
| Additional value | A distinct source, tradition, variation, or learning purpose | Age, fame, or search rank alone |

The preferred style candidate remains a master playing an exposed single fiddle
in the tune's tradition. Sparse accompaniment can qualify as `style`, but label
it honestly; it is not the unaccompanied gold standard. A full band belongs in
`band`, even if the camera only shows the fiddler. A pedagogical excerpt belongs
in `teaching` unless the performance independently warrants a different role.

`source` means a documented source player/lineage or an important original
recording, not simply "old." Do not call an old commercial LP the tune's first,
definitive, or founding version without evidence.

Write a short reason to hear each pick, plus the relevant limitation. Say
"provisional style candidate" or "overhead view with full-band accompaniment",
not "crystal-clear bowing" or "best version" without a listening verdict.
Do not manufacture timestamps, tuning, or instrumentation.

## 4. Keep a claim-level evidence ledger

For each finalist, retain:

- Exact recording URL, title/edition, performer and instruments, accompaniment.
- Tune identity and any explicitly documented differences from the book's version.
- Recording date separately from original release, reissue, and upload dates.
- Category, distinct learning purpose, and why it beats or complements alternatives.
- Evidence URL for each substantive claim, link-check result/date, unresolved
  questions, and whether Nate has actually listened.

Apply A3's V1-V7 checks. Particular traps:

- **V1:** oEmbed 200 and matching title/author support link/embedding availability,
  not playback success for every region or browser. A 401 alone does not identify
  the cause. For MP3s, HEAD/content-type is preliminary; test metadata loading from
  the actual site with a timeout and a finite positive duration. Never play it.
- **V2/V7:** exact title matches are not enough for ambiguous tunes. A performer's
  explicit explanation of a variation can establish the relationship; disclose
  it. Do not fill uncertainty with guesses from key, filename, or album context.
- **V3/V6:** seek original sleeves, per-track credits, archive records, or the
  identified recordist's description. Album credits can include several fiddlers
  and instruments without assigning any of them to this track. A Topic channel
  is a delivery surface, not the performer credit.
- **V4:** use `date unknown` when the recording/session date is unverified. Put
  a verified release year in the note as a release year. Uploading an old take
  does not make its upload year the performance year.
- **V5:** omit unsupported claims instead of replacing them with another story.
  A factual biography supports the musician's credentials, not audible qualities
  of a particular take.

When text extraction yields only a footer or a large script/configuration blob,
inspect the page's public structured metadata without executing downloaded code.
For example, Bandcamp may expose `data-tralbum` or JSON-LD; YouTube watch-page
metadata can include `videoDetails.shortDescription` and `lengthSeconds`.
Parse JSON, do not evaluate scripts, load media, defeat access controls, or
pretend an inaccessible source was read. Stop when a needed fact stays unknown.

## 5. Audit decisions, not just links

Before import, obtain the independent audit required by A3. Give the reviewer the
candidate records and evidence links, not the picker's persuasive narrative.
Request a per-gate OK / FIX / HOLD / REJECT with sources and explicit unknowns.

An overall OK is not enough. In particular, "likely the right tune" plus
"could not verify identity" still fails V7. Resolve the specific uncertainty or
hold that recording. Independent factual review cannot certify listening quality.
Retain useful held leads privately; do not publish their uncertainties as facts.

## 6. Import narrowly and verify persistence

Use `POST /fiddle/api/research/import` with just `refs` for a recording-only pass.
Set every researched ref's `origin` to `research`. Read the current importer:
it upserts by `(tune_id, url)` and can overwrite an existing ref's origin/notes.
Never overwrite `mine`, and stop on unexpected concurrent changes.

Preserve the tune, core research, personal refs, and `top_media`. Do not set a
manual top recording unless requested or confirmed. The site's automatic order
already prefers personal recordings; adding `style` can change the research
fallback, so the style designation must be defensible.

Require HTTP success, `ok: true`, and an empty `unmatched` list. The response's
`refs` count is input count, not proof of inserted rows. Re-fetch data and compare
all intended fields, confirm no duplicates/unintended changes, and check gaps.
Run core-gap checks even when they should be unchanged.

Cloudflare/Wrangler authorization and the tune book's owner sign-in are separate.
Check the API's `editor` flag early, before a long research run. If false, open the
site's existing sign-in dialog and let Nate approve a passkey or Google sign-in;
do not ask him to run a console script when working browser automation is available.
Direct D1 access is useful for independent read-back, not for minting an owner
session or bypassing the editor import. Ask for the missing authorization once,
then complete the import rather than stopping at another prepared payload.

If usable signed-in automation is absent, prepare a guarded, reviewable import
artifact and say **prepared, not imported**. A browser panel opening successfully
does not prove authenticated automation exists. Never invent a page handle or
report projected counts as live results.

Update A3 coverage with its scope (research-only versus all editor-visible refs),
add the run to the roadmap log, and preserve factual corrections in the actual
stored refs, not only in the roadmap. Report the shortlist and limitations
briefly; do not turn the handoff into a catalogue of rejected links.

## Lessons from the Angeline the Baker pilot (Sep 28-29, 2026)

- Search synthesis attributed a convention recording to the fiddler's own channel
  and supplied a different video ID from its citation. oEmbed and the recordist's
  actual description identified Dave/David Wells and corrected the banjo player
  to Brett Riggs. Primary metadata changed the decision, not just the citation.
- George Jackson's "Overhead Fiddle Cam" sounded like a solo-video lead on paper.
  Artist credits instead identify five instruments; the description explains a
  Tilman Pyeatt-derived variation. It is a useful **band/visual-learning**
  comparison, not an unaccompanied default style pick.
- Franklin George's sleeve assigns fiddle and banjo by track, unlike album-level
  credits. That resolved instrumentation but not every tune-identity/linkage
  question. The independent audit said OK while admitting uncertainty; the final
  decision held the record rather than relaxing V7.
- Clyde Davenport's archive entry names the fiddler and recorder, but does not
  explicitly establish solo status or a date. Missing accompanists in a catalogue
  is not positive evidence that there are none.
- The roadmap had already rejected a Hollow Rock lineage claim, but the live
  Norman Edmonds ref still repeated it. Check and correct the stored record.
- Artist/teacher production intent and documented instrumentation made the
  shortlist more defensible. Whether the picks are genuinely better for Nate
  remains a listening question, not a conclusion this metadata-only run proved.
- The completed import added Leftwich/Riggs (provisional style), Jackson's
  full-band variant, and Willis's lesson excerpt, and corrected the existing
  Edmonds reference. Exact field comparisons and independent D1 reads confirmed
  four persisted refs; private data and the top selection stayed unchanged.
  The source MP3 loaded metadata from the site with a 142.16-second duration,
  without playback. Core and outside/style-recording gap checks passed.
