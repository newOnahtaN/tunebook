import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ensurePopTables, importPopularity, recomputeAll, popScores, popularityPayload } from '../src/popularity.js';

// Minimal D1-shaped wrapper over node:sqlite.
function d1() {
  const db = new DatabaseSync(':memory:');
  const prep = sql => { const st = { sql, args: [] };
    st.bind = (...a) => { st.args = a; return st; };
    st.all = async () => ({ results: db.prepare(sql).all(...st.args) });
    st.first = async col => { const r = db.prepare(sql).get(...st.args) ?? null; return col && r ? r[col] : r; };
    st.run = async () => { db.prepare(sql).run(...st.args); return { success: true }; };
    return st; };
  return { raw: db, prepare: prep, batch: async list => { const out = []; for (const s of list) out.push(/^\s*(SELECT)/i.test(s.sql) ? await s.all() : await s.run()); return out; } };
}

test('import, score, history, payload', async () => {
  const db = d1();
  db.raw.exec(`CREATE TABLE tunes (id INTEGER PRIMARY KEY, name TEXT, genre TEXT, status INTEGER, common INTEGER)`);
  db.raw.exec(`INSERT INTO tunes VALUES (1,'Tater Roll','Old-time',2,0),(2,'Calum''s Road','Scottish',2,6),(3,'Cedar Paths','Camp composition',2,2),(4,'Nothing','Irish',2,0)`);
  await ensurePopTables(db);
  const res = await importPopularity(db, { reason: 'test',
    lists: [{ source: 'columbia', label: 'Columbia City Jam', url: 'x', stats: { max: 44, maxRecent: 21 }, as_of: '2026-10-04' }],
    evidence: [
      { tune_id: 1, source: 'columbia', value: 44, extra: { recent: 21, rank: 1 } },
      { tune_id: 2, source: 'nwsf', value: 1 }, { tune_id: 2, source: 'session', value: 749, extra: { id: 1 } },
      { tune_id: 3, source: 'hearsay', value: 1, note: 'no public trace' },
      { tune_id: 99, source: 'session', value: 5 }, { tune_id: 1, source: 'bogus', value: 1 },
    ] }, new Set([1, 2, 3, 4]));
  assert.equal(res.evidence, 4); assert.equal(res.problems.length, 2); assert.equal(res.changed, 4);
  const s = await popScores(db);
  assert.equal(s[1].score, 10); assert.equal(s[2].score, 9); assert.equal(s[2].curated, true);
  assert.equal(s[3].score, null); assert.equal(s[3].basis, 'no data'); assert.equal(s[4].basis, 'no data');
  // Re-importing the same pair replaces, and an unchanged recompute logs no history.
  await importPopularity(db, { evidence: [{ tune_id: 2, source: 'session', value: 20 }] }, new Set([1, 2, 3, 4]));
  const s2 = await popScores(db); assert.equal(s2[2].score, 7);
  const again = await recomputeAll(db); assert.equal(again.changed, 0);
  const p = await popularityPayload(db);
  assert.equal(p.evidence.filter(e => e.tune_id === 2 && e.source === 'session').length, 1);
  assert.ok(p.history.length >= 5); assert.equal(p.lists.columbia.max, 44); assert.equal(p.tunes.length, 4);
  // replace_sources wipes a source entirely.
  await importPopularity(db, { replace_sources: ['columbia'], evidence: [] }, new Set([1, 2, 3, 4]));
  assert.equal((await popScores(db))[1].basis, 'no data');
});
