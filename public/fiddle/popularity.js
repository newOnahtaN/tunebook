// Popularity scoring for the tune book. Shared by the Worker (src/worker.js) and the
// explainer page (/fiddle/popularity), so the score shown anywhere is computed by this one file.
//
// Inputs are evidence rows gathered from sources (see SOURCES): local session logs, curated
// local lists, The Session's tunebook counts, a panel of published jam lists, and "hearsay"
// research (forums, blogs, videos). Each row is { source, value, extra } where extra is an object.
// Scores run 1-10. A tune with no evidence at all gets no score and the "no data" badge.

export const POP_VERSION = 1;

// How each source is described on the explainer page. `kind` decides which side it counts on.
export const SOURCES = {
  columbia:  { kind: 'local',   label: 'Columbia City Jam',        unit: 'nights' },
  quebecois: { kind: 'local',   label: 'PNW Québécois session',    unit: 'plays' },
  couth:     { kind: 'local',   label: 'Couth Buzzard Irish session', unit: 'plays' },
  nwsf:      { kind: 'curated', label: 'NW Scottish Fiddlers top tunes', unit: '' },
  otb:       { kind: 'curated', label: 'Old Time Buddies list',    unit: '' },
  session:   { kind: 'online',  label: 'The Session',              unit: 'tunebooks' },
  jamlists:  { kind: 'online',  label: 'Published jam lists',      unit: 'points' },
  hearsay:   { kind: 'online',  label: 'Hearsay research',         unit: '/10' },
};

// Tunable constants. Changing any of these changes every score, so the explainer page prints them.
export const CONSTANTS = {
  curve: 2,                 // score = 1 + 9 * strength^curve
  localCap: 0.9,            // local evidence alone tops out at a 9 ...
  topLocalRank: 3,          // ... except a local session's 3 most-played tunes, which are 10s
  extraLocalBonus: 0.05,    // each additional local list adds this much strength
  agreementBonus: 0.1,      // when local and online evidence both exist, add 10% of the weaker one
  // The Session tunebook ceiling per tradition group (log scale); old-time is capped because The
  // Session is an Irish-centred community and undercounts it.
  sessionCeiling: { celtic: 8000, americana: 1000, franco: 1000, other: 1000 },
  sessionCapAmericana: 0.85,
  jamListBase: 0.3,         // being on any published jam list is worth at least this
  jamListMax: 3.5,          // panel points available (St. Louis, Charlotte, Santa Clara, Bluegrass = 1; Victoria = 0.5)
  curatedFloor: 7,          // NWSF and Old Time Buddies tunes land between 7 and 10 ...
  curatedSpan: 3,           // ... placed within that range by their online strength
};

// Tradition group for a tune's primary genre. Session ceilings and jam lists depend on it.
export function popGroup(genre = '') {
  if (/Old-time|Bluegrass|Western swing|Waltz/i.test(genre)) return 'americana';
  if (/Irish|Scottish|Cape Breton|Shetland|English|Contra/i.test(genre)) return 'celtic';
  if (/Québécois|Gaspé|Acadian|Métis/i.test(genre)) return 'franco';
  return 'other';
}

const log1 = (v, max) => (max > 0 ? Math.log(1 + Math.max(0, v)) / Math.log(1 + max) : 0);
const scoreOf = (s, curve) => Math.max(1, Math.min(10, Math.round(1 + 9 * Math.pow(Math.max(0, Math.min(1, s)), curve))));
const strengthOfScore = (score, curve) => Math.pow((Math.max(1, Math.min(10, score)) - 1) / 9, 1 / curve);

// Strength (0..1) contributed by one evidence row. `lists` holds per-source maxima, e.g.
// { columbia: { max: 44, maxRecent: 21 }, quebecois: { max: 67 }, couth: { max: 31 } }.
export function rowStrength(row, group, lists = {}, C = CONSTANTS) {
  const x = row.extra || {};
  switch (row.source) {
    case 'columbia': {
      const L = lists.columbia || {};
      return 0.5 * log1(row.value, L.max) + 0.5 * log1(x.recent || 0, L.maxRecent);
    }
    case 'quebecois': return log1(row.value, (lists.quebecois || {}).max);
    case 'couth': return log1(row.value, (lists.couth || {}).max);
    case 'session': {
      let s = Math.min(1, Math.log10(1 + row.value) / Math.log10(1 + (C.sessionCeiling[group] || 1000)));
      if (group === 'americana') s = Math.min(s, C.sessionCapAmericana);
      return s;
    }
    case 'jamlists': return row.value > 0 ? C.jamListBase + (1 - C.jamListBase) * Math.min(1, row.value / C.jamListMax) : 0;
    case 'hearsay': return row.value > 1 ? strengthOfScore(row.value, C.curve) : 0;
    default: return 0;   // curated lists don't add strength; they set a 7-10 range (see below)
  }
}

// The whole calculation. Returns { score, basis, strength, local, online, curated, parts }.
export function computePopularity(rows, genre, lists = {}, C = CONSTANTS) {
  const group = popGroup(genre);
  const parts = [];
  const local = [], online = [];
  let curated = false, hearsayOnly = true, noTrace = false, topLocal = false;
  for (const r of rows) {
    const meta = SOURCES[r.source]; if (!meta) continue;
    if (meta.kind === 'curated') { curated = true; parts.push({ source: r.source, strength: null }); continue; }
    const s = rowStrength(r, group, lists, C);
    parts.push({ source: r.source, strength: Math.round(s * 1000) / 1000 });
    if (meta.kind === 'local') { local.push(s); if ((r.extra || {}).rank > 0 && r.extra.rank <= C.topLocalRank) topLocal = true; }
    else { online.push(s); if (r.source !== 'hearsay') hearsayOnly = false; if (r.source === 'hearsay' && r.value <= 1) noTrace = true; }
  }
  local.sort((a, b) => b - a); online.sort((a, b) => b - a);
  const loc = !local.length ? null : topLocal ? 1 : Math.min(1, local[0] + C.extraLocalBonus * (local.length - 1)) * C.localCap;
  const onl = online.length ? online[0] : null;

  let strength = null;
  if (loc != null || (onl != null && onl > 0)) {
    strength = Math.max(loc ?? 0, onl ?? 0);
    if (loc != null && onl != null) strength = Math.min(1, strength + C.agreementBonus * Math.min(loc, onl));
  }
  let score = strength == null ? null : scoreOf(strength, C.curve);
  // Curated local lists (NWSF top tunes, Old Time Buddies): placed between 7 and 10 by online strength.
  if (curated) {
    const placed = Math.round(C.curatedFloor + C.curatedSpan * Math.pow(onl ?? 0, C.curve));
    score = Math.max(score ?? 0, placed);
  }
  let basis;
  if (score == null) basis = 'no data';
  else if ((loc != null || curated) && onl != null && onl > 0) basis = 'local + online';
  else if (loc != null || curated) basis = 'local';
  else basis = hearsayOnly ? 'hearsay' : 'online';
  if (score == null && noTrace) basis = 'no data';
  const r3 = v => (v == null ? null : Math.round(v * 1000) / 1000);
  return { score, basis, strength: r3(strength), local: r3(loc), online: r3(onl), curated, topLocal, parts };
}
