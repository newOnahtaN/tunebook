// Tune book: static page + small JSON API backed by D1.
// Visitors read; the editor signs in with a passphrase (Worker secret EDIT_PASSPHRASE).
import seed from './seed.json';

const APEX = 'nategrimwood.com';
const HOME = '/fiddle';
const API = '/fiddle/api/';
const COOKIE = 'tb_session';
const SESSION_DAYS = 400;            // browsers cap cookie lifetime at 400 days
const RENEW_BELOW_DAYS = 300;
const MAX_FAILS = 5, LOCK_MINUTES = 15;
const SCHEMA_VERSION = '1';

const TUNE_FIELDS = { name: 'text', key: 'text', genre: 'text', common: 'int0_10', form: 'text',
                      origin: 'text', status: 'int0_2', source: 'text', notes: 'text' };
const OPEN_FIELDS = { title: 'text', source: 'text', notes: 'text' };
const TABLES = { tunes: TUNE_FIELDS, open: OPEN_FIELDS };
const TABLE_NAME = { tunes: 'tunes', open: 'open_titles' };
const KNOW = ['Memorized', 'Played, still learning', 'Not played yet'];
const GENRE_ORDER = ['Old-time', 'Contra', 'English', 'Irish', 'Québécois', 'Gaspé', 'Scottish', 'Shetland',
                     'Cape Breton', 'Waltz', 'Castilian', 'Camp composition'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // www -> apex, keeping the path
    if (url.hostname === 'www.' + APEX) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect(url.origin + HOME, 301);
    }
    if (url.pathname.startsWith(API)) {
      try {
        return await api(request, env, url);
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        console.error(e);
        return json({ error: 'Something went wrong on the server.' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

// ---------------------------------------------------------------- database

let ready = null;
function ensureDb(env) {
  if (!ready) ready = initDb(env).catch(e => { ready = null; throw e; });
  return ready;
}

async function initDb(env) {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tunes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', key TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '', common INTEGER NOT NULL DEFAULT 0, form TEXT NOT NULL DEFAULT '',
      origin TEXT NOT NULL DEFAULT '', status INTEGER NOT NULL DEFAULT 2, source TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS open_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, action TEXT NOT NULL, tbl TEXT NOT NULL,
      row_id INTEGER, label TEXT NOT NULL DEFAULT '', field TEXT, old TEXT, new TEXT, undone INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, fails INTEGER NOT NULL, until_ms INTEGER NOT NULL)`),
  ]);
  const seeded = await db.prepare(`SELECT v FROM meta WHERE k = 'seeded'`).first('v');
  if (!seeded) {
    const now = new Date().toISOString();
    const stmts = [];
    for (const t of seed.tunes) {
      stmts.push(db.prepare(`INSERT INTO tunes (name,key,genre,common,form,origin,status,source,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(t.name, t.key, t.genre, t.common, t.form, t.origin, t.status,
        t.source, t.notes || '', now, now));
    }
    for (const o of seed.open) {
      stmts.push(db.prepare(`INSERT INTO open_titles (title,source,notes,created_at,updated_at) VALUES (?,?,?,?,?)`)
        .bind(o.title, o.source, o.notes || '', now, now));
    }
    stmts.push(db.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('working_notes', ?)`).bind(seed.working_notes || ''));
    stmts.push(db.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('schema_version', ?)`).bind(SCHEMA_VERSION));
    stmts.push(db.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('seeded', ?)`).bind(now));
    await db.batch(stmts);  // one transaction: all or nothing
  }
}

// ---------------------------------------------------------------- auth

const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', enc.encode('tunebook-session:' + env.EDIT_PASSPHRASE),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = b64u(enc.encode(JSON.stringify({ exp })));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload)));
  return { value: payload + '.' + sig, exp };
}

function sessionCookie(value, maxAgeSec) {
  return `${COOKIE}=${value}; Path=${HOME}; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

async function readSession(request, env) {
  if (!env.EDIT_PASSPHRASE) return null;
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(env), unb64u(sig), enc.encode(payload));
  } catch { return null; }
  if (!ok) return null;
  const { exp } = JSON.parse(new TextDecoder().decode(unb64u(payload)));
  return exp > Date.now() ? { exp } : null;
}

async function timingSafeEqual(a, b) {
  // Compare HMACs of both strings so the comparison time doesn't depend on the secret.
  const k = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [x, y] = await Promise.all([crypto.subtle.sign('HMAC', k, enc.encode(a)), crypto.subtle.sign('HMAC', k, enc.encode(b))]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

async function login(request, env) {
  if (!env.EDIT_PASSPHRASE) throw new HttpError(503, "Editing isn't set up yet: the EDIT_PASSPHRASE secret is missing.");
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT fails, until_ms FROM login_attempts WHERE ip = ?`).bind(ip).first();
  if (row && row.until_ms > now) {
    throw new HttpError(429, `Too many wrong tries. Wait ${Math.ceil((row.until_ms - now) / 60000)} minutes and try again.`);
  }
  const body = await readJson(request);
  const guess = String(body.passphrase || '');
  if (!(await timingSafeEqual(guess, env.EDIT_PASSPHRASE))) {
    const fails = (row && row.until_ms <= now && row.fails >= MAX_FAILS) ? 1 : ((row?.fails || 0) + 1);
    const until = fails >= MAX_FAILS ? now + LOCK_MINUTES * 60000 : 0;
    await env.DB.prepare(`INSERT OR REPLACE INTO login_attempts (ip, fails, until_ms) VALUES (?,?,?)`).bind(ip, fails, until).run();
    throw new HttpError(401, "That passphrase didn't match.");
  }
  await env.DB.prepare(`DELETE FROM login_attempts WHERE ip = ?`).bind(ip).run();
  const s = await makeSession(env);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(s.value, SESSION_DAYS * 86400) });
}

// ---------------------------------------------------------------- helpers

async function readJson(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Expected JSON.');
  try { return await request.json(); } catch { throw new HttpError(400, 'Bad JSON.'); }
}

function clean(type, value) {
  if (type === 'text') {
    const s = String(value ?? '').replace(/\r\n?/g, '\n').trim();
    if (s.length > 4000) throw new HttpError(400, 'That text is too long.');
    return s;
  }
  const n = Number(value);
  const max = type === 'int0_10' ? 10 : 2;
  if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, `Must be a whole number from 0 to ${max}.`);
  return n;
}

function checkSameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request refused.');
}

async function logEdit(env, e) {
  return env.DB.prepare(`INSERT INTO edits (at, action, tbl, row_id, label, field, old, new) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(new Date().toISOString(), e.action, e.tbl, e.row_id ?? null, e.label || '', e.field ?? null,
          e.old == null ? null : String(e.old), e.new == null ? null : String(e.new));
}

const labelOf = (tbl, row) => (tbl === 'tunes' ? row.name : row.title) || '(untitled)';

async function getRow(env, tbl, id) {
  const row = await env.DB.prepare(`SELECT * FROM ${TABLE_NAME[tbl]} WHERE id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'Not found. It may have been deleted.');
  return row;
}

function publicTune(t) {
  const { notes, created_at, updated_at, ...rest } = t;
  return rest;
}

// ---------------------------------------------------------------- API

async function api(request, env, url) {
  await ensureDb(env);
  const path = url.pathname.slice(API.length).replace(/\/+$/, '');
  const method = request.method;
  const session = await readSession(request, env);
  const editor = !!session;

  if (path === 'data' && method === 'GET') {
    const [tunes, open, notes] = await Promise.all([
      env.DB.prepare(`SELECT * FROM tunes ORDER BY id`).all(),
      env.DB.prepare(`SELECT * FROM open_titles ORDER BY id`).all(),
      editor ? env.DB.prepare(`SELECT v FROM meta WHERE k = 'working_notes'`).first('v') : null,
    ]);
    const headers = {};
    if (editor && session.exp - Date.now() < RENEW_BELOW_DAYS * 864e5) {
      const s = await makeSession(env);
      headers['set-cookie'] = sessionCookie(s.value, SESSION_DAYS * 86400);
    }
    return json(editor
      ? { editor: true, tunes: tunes.results, open: open.results, working_notes: notes || '' }
      : { editor: false, editingEnabled: !!env.EDIT_PASSPHRASE, tunes: tunes.results.map(publicTune),
          open: open.results.map(({ title, source, id }) => ({ id, title, source })) }, 200, headers);
  }

  if (path === 'login' && method === 'POST') { checkSameOrigin(request, url); return login(request, env); }
  if (path === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  // Everything below is editor-only.
  if (!editor) throw new HttpError(401, 'Sign in to edit.');
  if (method !== 'GET') checkSameOrigin(request, url);

  let m;
  // PATCH /tunes/:id or /open/:id   body: { field, value }
  if ((m = path.match(/^(tunes|open)\/(\d+)$/)) && method === 'PATCH') {
    const [, tbl, idStr] = m; const id = Number(idStr);
    const body = await readJson(request);
    const type = TABLES[tbl][body.field];
    if (!type) throw new HttpError(400, 'Unknown field.');
    const value = clean(type, body.value);
    const row = await getRow(env, tbl, id);
    if (row[body.field] === value) return json(row);
    const now = new Date().toISOString();
    const [, , res] = await env.DB.batch([
      env.DB.prepare(`UPDATE ${TABLE_NAME[tbl]} SET ${body.field} = ?, updated_at = ? WHERE id = ?`).bind(value, now, id),
      await logEdit(env, { action: 'update', tbl, row_id: id, label: labelOf(tbl, { ...row, [body.field]: value }),
                           field: body.field, old: row[body.field], new: value }),
      env.DB.prepare(`SELECT * FROM ${TABLE_NAME[tbl]} WHERE id = ?`).bind(id),
    ]);
    return json(res.results[0]);
  }

  // POST /tunes or /open   body: { fields }
  if ((m = path.match(/^(tunes|open)$/)) && method === 'POST') {
    const tbl = m[1];
    const body = await readJson(request);
    const fields = TABLES[tbl];
    const vals = {};
    for (const [f, type] of Object.entries(fields)) {
      if (body.fields && f in body.fields) vals[f] = clean(type, body.fields[f]);
    }
    if (tbl === 'tunes') {
      vals.name ??= 'New tune'; vals.genre ??= 'Old-time'; vals.status ??= 2;
    } else vals.title ??= 'New title';
    return json(await insertRow(env, tbl, vals, 'create'), 201);
  }

  // DELETE /tunes/:id or /open/:id
  if ((m = path.match(/^(tunes|open)\/(\d+)$/)) && method === 'DELETE') {
    const [, tbl, idStr] = m; const id = Number(idStr);
    const row = await getRow(env, tbl, id);
    const res = await env.DB.batch([
      env.DB.prepare(`DELETE FROM ${TABLE_NAME[tbl]} WHERE id = ?`).bind(id),
      await logEdit(env, { action: 'delete', tbl, row_id: id, label: labelOf(tbl, row), old: JSON.stringify(row) }),
    ]);
    return json({ ok: true, edit_id: res[1].meta.last_row_id });
  }

  // POST /open/:id/promote   -> becomes a tune (Not played yet)
  if ((m = path.match(/^open\/(\d+)\/promote$/)) && method === 'POST') {
    const id = Number(m[1]);
    const row = await getRow(env, 'open', id);
    const body = await readJson(request);
    const genre = clean('text', body.genre || 'Old-time') || 'Old-time';
    const now = new Date().toISOString();
    const res = await env.DB.batch([
      env.DB.prepare(`INSERT INTO tunes (name,key,genre,common,form,origin,status,source,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *`).bind(row.title, '?', genre, 0, '?', '', 2, row.source, row.notes, now, now),
      env.DB.prepare(`DELETE FROM open_titles WHERE id = ?`).bind(id),
      await logEdit(env, { action: 'promote', tbl: 'open', row_id: id, label: row.title, old: JSON.stringify(row) }),
    ]);
    const tune = res[0].results[0];
    await env.DB.prepare(`UPDATE edits SET new = ? WHERE id = (SELECT MAX(id) FROM edits WHERE action = 'promote' AND row_id = ?)`)
      .bind(String(tune.id), id).run();
    return json(tune, 201);
  }

  if (path === 'meta/working_notes' && method === 'PUT') {
    const body = await readJson(request);
    const value = String(body.value ?? '').replace(/\r\n?/g, '\n');
    if (value.length > 100000) throw new HttpError(400, 'Notes are too long.');
    await env.DB.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('working_notes', ?)`).bind(value).run();
    return json({ ok: true });
  }

  if (path === 'history' && method === 'GET') {
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 500);
    const r = await env.DB.prepare(`SELECT * FROM edits ORDER BY id DESC LIMIT ?`).bind(limit).all();
    return json(r.results);
  }

  if ((m = path.match(/^undo\/(\d+)$/)) && method === 'POST') {
    return json(await undo(env, Number(m[1])));
  }

  if (path === 'export.json' && method === 'GET') {
    const data = await exportData(env);
    return new Response(JSON.stringify(data, null, 1), { headers: {
      'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="tune-book.json"' } });
  }
  if (path === 'export.md' && method === 'GET') {
    return new Response(toMarkdown(await exportData(env)), { headers: {
      'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="tune-book.md"' } });
  }

  throw new HttpError(404, 'No such API route.');
}

async function insertRow(env, tbl, vals, action, id = null) {
  const now = new Date().toISOString();
  const cols = Object.keys(vals);
  const allCols = (id != null ? ['id'] : []).concat(cols, ['created_at', 'updated_at']);
  const args = (id != null ? [id] : []).concat(cols.map(c => vals[c]), [vals.created_at || now, now]);
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO ${TABLE_NAME[tbl]} (${allCols.join(',')}) VALUES (${allCols.map(() => '?').join(',')}) RETURNING *`).bind(...args),
  ]);
  const row = res[0].results[0];
  await (await logEdit(env, { action, tbl, row_id: row.id, label: labelOf(tbl, row), new: JSON.stringify(row) })).run();
  return row;
}

async function undo(env, editId) {
  const e = await env.DB.prepare(`SELECT * FROM edits WHERE id = ?`).bind(editId).first();
  if (!e) throw new HttpError(404, 'That change is no longer in the history.');
  if (e.undone) throw new HttpError(409, 'That change was already undone.');
  const table = TABLE_NAME[e.tbl];
  const markUndone = env.DB.prepare(`UPDATE edits SET undone = 1 WHERE id = ?`).bind(editId);
  const now = new Date().toISOString();
  if (e.action === 'update') {
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(e.row_id).first();
    if (!row) throw new HttpError(409, 'That row has since been deleted.');
    const type = TABLES[e.tbl][e.field];
    const old = type === 'text' ? (e.old ?? '') : Number(e.old);
    await env.DB.batch([
      env.DB.prepare(`UPDATE ${table} SET ${e.field} = ?, updated_at = ? WHERE id = ?`).bind(old, now, e.row_id),
      await logEdit(env, { action: 'undo', tbl: e.tbl, row_id: e.row_id, label: e.label, field: e.field, old: row[e.field], new: old }),
      markUndone,
    ]);
  } else if (e.action === 'create') {
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(e.row_id).first();
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(e.row_id),
      await logEdit(env, { action: 'undo', tbl: e.tbl, row_id: e.row_id, label: e.label, old: row ? JSON.stringify(row) : null }),
      markUndone,
    ]);
  } else if (e.action === 'delete' || e.action === 'promote') {
    const row = JSON.parse(e.old);
    const exists = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(row.id).first();
    const stmts = [];
    if (e.action === 'promote' && e.new) stmts.push(env.DB.prepare(`DELETE FROM tunes WHERE id = ?`).bind(Number(e.new)));
    const cols = Object.keys(row).filter(c => !(exists && c === 'id'));
    stmts.push(env.DB.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map(c => row[c])));
    stmts.push(await logEdit(env, { action: 'undo', tbl: e.tbl, row_id: row.id, label: e.label, new: JSON.stringify(row) }));
    stmts.push(markUndone);
    await env.DB.batch(stmts);
  } else {
    throw new HttpError(409, "That kind of change can't be undone.");
  }
  return { ok: true };
}

async function exportData(env) {
  const [tunes, open, notes] = await Promise.all([
    env.DB.prepare(`SELECT * FROM tunes ORDER BY id`).all(),
    env.DB.prepare(`SELECT * FROM open_titles ORDER BY id`).all(),
    env.DB.prepare(`SELECT v FROM meta WHERE k = 'working_notes'`).first('v'),
  ]);
  return { exported_at: new Date().toISOString(), tunes: tunes.results, open: open.results, working_notes: notes || '' };
}

function toMarkdown(d) {
  const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
  const genres = [...new Set(d.tunes.map(t => t.genre))].sort((a, b) => {
    const ia = GENRE_ORDER.indexOf(a), ib = GENRE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const counts = [0, 1, 2].map(i => d.tunes.filter(t => t.status === i).length);
  const out = [
    "# Nate's tune book", '',
    `Exported from nategrimwood.com/fiddle on ${d.exported_at.slice(0, 10)}.`, '',
    '## How the columns work', '',
    '- **Common**: rough 1-10 guess at how widely players of that genre know the tune. Blank means unrated.',
    '- **Status**: anything in the Google Drive Fiddle folder counts as played; tunes in the VOM 2026 subfolder are played but not memorized; everything else is not played yet.',
    "- **From**: Drive folder name where files exist, otherwise the list in Nate's jam notes where the title appeared.",
    '- A `?` in Key, Form, or Origin means unconfirmed, not absent.', '',
    '## Totals', '',
    `- ${d.tunes.length} tunes traced`, `- ${counts[0]} memorized`, `- ${counts[1]} played, still learning`,
    `- ${counts[2]} not played yet`, `- ${d.open.length} titles still unidentified`, '',
    '## Tunes', '',
  ];
  for (const g of genres) {
    const rows = d.tunes.filter(t => t.genre === g)
      .sort((a, b) => (b.common ? 1 : 0) - (a.common ? 1 : 0) || b.common - a.common || a.name.localeCompare(b.name));
    out.push(`### ${g}`, '', '| Tune | Key | Common | Form | Origin | Status | From | Notes |', '|---|---|---|---|---|---|---|---|');
    for (const t of rows) {
      out.push(`| ${cell(t.name)} | ${cell(t.key)} | ${t.common || ''} | ${cell(t.form)} | ${cell(t.origin)} | ${KNOW[t.status]} | ${cell(t.source)} | ${cell(t.notes)} |`);
    }
    out.push('');
  }
  out.push('## Not yet identified', '', '| Title | From | Notes |', '|---|---|---|');
  for (const o of d.open) out.push(`| ${cell(o.title)} | ${cell(o.source)} | ${cell(o.notes)} |`);
  out.push('');
  if (d.working_notes) out.push(d.working_notes.trim(), '');
  return out.join('\n');
}
