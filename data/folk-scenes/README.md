# Folk scenes of the 20 largest US metros (Oct 2026)

A research report on the folk scene of each of the 20 largest US metro areas (Census Vintage 2025 MSAs), plus the
data behind it. This is a research project, separate from the tune book's database and not deployed: nothing here
is served by the Worker (only `public/` is).

- `report/index.html`: the report. A single self-contained page (inline SVG charts) that works on a phone; open it
  in a browser. Its city cards link to the dossiers below.
- `cities/<slug>.md`: one dossier per metro (about 8,000–25,000 words), with sources cited inline.
- `cities/<slug>.json`: the structured census behind each dossier (recurring events with frequency, venue, cost,
  confidence and last evidence; venues, organizations, festivals, people, history timeline, defunct series, heritage
  traditions, surprises and open questions). The schema is in `BRIEF.md`.
- `central/`: cross-city datasets: Census population and ACS demographics per metro, thesession.org sessions and
  tune titles assigned to metros, NEA National Heritage Fellows, national dance and singing directories, community-
  owned folk buildings, contra dances in 2019 vs. 2026, and fiddle contests.
- `build/`: the scripts that turn the data into the report. `npm install` then `npm run build` rewrites
  `report/index.html`. `model.mjs` holds the counting rules; `cards.mjs` holds the hand-written city card copy.

Counting rules (also in the report's appendix): only recurring, public, in-MSA series with 2024–26 evidence and
medium or high confidence count; modern western club square dancing, online-only and listen-only events are kept
out of the totals.
