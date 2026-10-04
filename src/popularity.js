// Popularity storage and API for the tune book (see public/fiddle/popularity.js for the scoring).
//
// pop_lists     one row per source: label, link, and the stats scoring needs (e.g. the busiest tune's count)
// pop_evidence  one row per tune per source: the raw number, extra detail (JSON), a note, a link, the date read
// pop_scores    the computed score for every tune, recomputed whenever evidence changes
// pop_history   a row whenever a tune's score or badge changes, so changes can be audited over time
import { computePopularity, SOURCES, CONSTANTS, POP_VERSION } from '../public/fiddle/popularity.js';

export const POP_TABLES = [
  `CREATE TABLE IF NOT EXISTS pop_lists (source TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
     stats TEXT NOT NULL DEFAULT '{}', as_of TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS pop_evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, tune_id INTEGER NOT NULL, source TEXT NOT NULL,
     value REAL NOT NULL DEFAULT 0, extra TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
     as_of TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS pop_evidence_tune ON pop_evidence (tune_id)`,
  `CREATE TABLE IF NOT EXISTS pop_scores (tune_id INTEGER PRIMARY KEY, score INTEGER, basis TEXT NOT NULL DEFAULT 'no data',
     strength REAL, local REAL, online REAL, curated INTEGER NOT NULL DEFAULT 0, parts TEXT NOT NULL DEFAULT '[]',
     version INTEGER NOT NULL DEFAULT 0, computed_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS pop_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tune_id INTEGER NOT NULL, score INTEGER,
     basis TEXT NOT NULL DEFAULT '', prev_score INTEGER, prev_basis TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
     at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS pop_history_tune ON pop_history (tune_id)`,
];

export async function ensurePopTables(db) {
  await db.batch(POP_TABLES.map(sql => db.prepare(sql)));
}

const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const clip = (s, n) => String(s ?? '').slice(0, n);

async function loadLists(db) {
  const { results } = await db.prepare(`SELECT source, label, url, stats, as_of FROM pop_lists`).all();
  const lists = {};
  for (const r of results) lists[r.source] = { ...parse(r.stats, {}), label: r.label, url: r.url, as_of: r.as_of };
  return lists;
}

// Recompute every tune's score from stored evidence. Writes pop_scores and logs changes to pop_history.
export async function recomputeAll(db, reason = 'recompute') {
  const now = new Date().toISOString();
  const [tunes, ev, prev, lists] = await Promise.all([
    db.prepare(`SELECT id, genre FROM tunes`).all(),
    db.prepare(`SELECT tune_id, source, value, extra FROM pop_evidence`).all(),
    db.prepare(`SELECT tune_id, score, basis FROM pop_scores`).all(),
    loadLists(db),
  ]);
  const byTune = new Map();
  for (const r of ev.results) {
    if (!byTune.has(r.tune_id)) byTune.set(r.tune_id, []);
    byTune.get(r.tune_id).push({ source: r.source, value: r.value, extra: parse(r.extra, {}) });
  }
  const old = new Map(prev.results.map(r => [r.tune_id, r]));
  const stmts = [], changed = [];
  for (const t of tunes.results) {
    const p = computePopularity(byTune.get(t.id) || [], t.genre, lists);
    stmts.push(db.prepare(`INSERT INTO pop_scores (tune_id, score, basis, strength, local, online, curated, parts, version, computed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tune_id) DO UPDATE SET score=excluded.score, basis=excluded.basis,
      strength=excluded.strength, local=excluded.local, online=excluded.online, curated=excluded.curated, parts=excluded.parts,
      version=excluded.version, computed_at=excluded.computed_at`)
      .bind(t.id, p.score, p.basis, p.strength, p.local, p.online, p.curated ? 1 : 0, JSON.stringify(p.parts), POP_VERSION, now));
    const o = old.get(t.id);
    if (!o || o.score !== p.score || o.basis !== p.basis) {
      changed.push(t.id);
      stmts.push(db.prepare(`INSERT INTO pop_history (tune_id, score, basis, prev_score, prev_basis, reason, at) VALUES (?,?,?,?,?,?,?)`)
        .bind(t.id, p.score, p.basis, o ? o.score : null, o ? o.basis : '', clip(reason, 200), now));
    }
  }
  // Scores of deleted tunes go away with them.
  stmts.push(db.prepare(`DELETE FROM pop_scores WHERE tune_id NOT IN (SELECT id FROM tunes)`));
  for (let i = 0; i < stmts.length; i += 90) await db.batch(stmts.slice(i, i + 90));
  return { tunes: tunes.results.length, changed: changed.length };
}

// POST /popularity/import
// { reason, lists: [{source, label, url, stats:{...}, as_of}],
//   replace_sources: ['columbia', ...]   -> delete all evidence from these sources first
//   evidence: [{tune_id, source, value, extra:{...}, note, url, as_of}] }
// Evidence for a (tune, source) pair in the payload replaces what was stored for that pair.
export async function importPopularity(db, body, validTuneIds) {
  const lists = Array.isArray(body?.lists) ? body.lists : [];
  const evidence = Array.isArray(body?.evidence) ? body.evidence : [];
  const replace = Array.isArray(body?.replace_sources) ? body.replace_sources.filter(s => SOURCES[s]) : [];
  const problems = [];
  const stmts = [];
  for (const l of lists) {
    if (!SOURCES[l.source]) { problems.push(`unknown list source ${l.source}`); continue; }
    stmts.push(db.prepare(`INSERT INTO pop_lists (source, label, url, stats, as_of) VALUES (?,?,?,?,?)
      ON CONFLICT(source) DO UPDATE SET label=excluded.label, url=excluded.url, stats=excluded.stats, as_of=excluded.as_of`)
      .bind(l.source, clip(l.label || SOURCES[l.source].label, 200), clip(l.url, 500), JSON.stringify(l.stats || {}), clip(l.as_of, 40)));
  }
  for (const s of replace) stmts.push(db.prepare(`DELETE FROM pop_evidence WHERE source = ?`).bind(s));
  const seen = new Set();
  const rows = [];
  for (const e of evidence) {
    const id = Number(e.tune_id);
    if (!SOURCES[e.source]) { problems.push(`unknown source ${e.source} for tune ${e.tune_id}`); continue; }
    if (!validTuneIds.has(id)) { problems.push(`no tune ${e.tune_id}`); continue; }
    const value = Number(e.value);
    if (!Number.isFinite(value)) { problems.push(`bad value for tune ${id} / ${e.source}`); continue; }
    const key = id + '|' + e.source;
    if (!seen.has(key)) { seen.add(key); if (!replace.includes(e.source)) stmts.push(db.prepare(`DELETE FROM pop_evidence WHERE tune_id = ? AND source = ?`).bind(id, e.source)); }
    rows.push(db.prepare(`INSERT INTO pop_evidence (tune_id, source, value, extra, note, url, as_of) VALUES (?,?,?,?,?,?,?)`)
      .bind(id, e.source, value, clip(JSON.stringify(e.extra || {}), 8000), clip(e.note, 1000), clip(e.url, 500), clip(e.as_of, 40)));
  }
  const all = stmts.concat(rows);
  for (let i = 0; i < all.length; i += 90) await db.batch(all.slice(i, i + 90));
  const result = await recomputeAll(db, body?.reason || 'evidence import');
  return { lists: lists.length, evidence: rows.length, problems, ...result };
}

// Scores only, keyed by tune id, for the main page.
export async function popScores(db) {
  const { results } = await db.prepare(`SELECT s.tune_id, s.score, s.basis, s.curated,
    (SELECT COUNT(*) FROM pop_evidence e WHERE e.tune_id = s.tune_id) AS n FROM pop_scores s`).all();
  const out = {};
  // n = how many evidence rows the tune has; 0 means it hasn't been researched for popularity yet.
  for (const r of results) out[r.tune_id] = { score: r.score, basis: r.basis, curated: !!r.curated, n: r.n };
  return out;
}

// GET /popularity: everything the explainer page needs to show and re-check each score.
export async function popularityPayload(db) {
  const [lists, scores, ev, hist, tunes] = await Promise.all([
    loadLists(db),
    db.prepare(`SELECT * FROM pop_scores`).all(),
    db.prepare(`SELECT tune_id, source, value, extra, note, url, as_of FROM pop_evidence ORDER BY tune_id, source`).all(),
    db.prepare(`SELECT tune_id, score, basis, prev_score, prev_basis, reason, at FROM pop_history ORDER BY id DESC LIMIT 1000`).all(),
    db.prepare(`SELECT id, name, genre, status, common FROM tunes`).all(),
  ]);
  return {
    version: POP_VERSION, constants: CONSTANTS, sources: SOURCES, lists,
    tunes: tunes.results,
    scores: scores.results.map(r => ({ ...r, curated: !!r.curated, parts: parse(r.parts, []) })),
    evidence: ev.results.map(r => ({ ...r, extra: parse(r.extra, {}) })),
    history: hist.results,
  };
}
