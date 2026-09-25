// Tune book: static page + small JSON API backed by D1.
// Visitors read. The editor signs in with Google (accounts listed in EDITOR_EMAILS) or with a passkey
// they added after a Google sign-in. Sessions are signed with a random key kept in the database.
import seed from './seed.json';
import { AuthError, b64u, unb64u, enc, verifyGoogleIdToken, verifyRegistration, verifyAssertion, SUPPORTED_ALGS } from './auth.js';

const APEX = 'nategrimwood.com';
const HOME = '/fiddle';
const API = '/fiddle/api/';
const COOKIE = 'tb_session';
const CHALLENGE_COOKIE = 'tb_challenge';
const SESSION_DAYS = 400;            // browsers cap cookie lifetime at 400 days
const RENEW_BELOW_DAYS = 300;
const CHALLENGE_MINUTES = 5;
const SCHEMA_VERSION = '2';

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
    const ours = url.hostname === APEX || url.hostname === 'www.' + APEX;
    // http -> https, and www -> apex, keeping the path
    if (ours && (url.protocol === 'http:' || url.hostname !== APEX)) {
      url.protocol = 'https:';
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect(url.origin + HOME, 301);
    }
    if (url.pathname.startsWith(API)) {
      try {
        return secure(await api(request, env, url));
      } catch (e) {
        if (e instanceof HttpError) return secure(json({ error: e.message }, e.status));
        if (e instanceof AuthError) return secure(json({ error: e.message }, 401));
        console.error(e);
        return secure(json({ error: 'Something went wrong on the server.' }, 500));
      }
    }
    return secure(await env.ASSETS.fetch(request));
  },
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, { headers = {}, cookies = [] } = {}) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(JSON.stringify(data), { status, headers: h });
}

function secure(res) {
  const r = new Response(res.body, res);
  r.headers.set('strict-transport-security', 'max-age=31536000');
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return r;
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
    db.prepare(`CREATE TABLE IF NOT EXISTS passkeys (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, user_handle TEXT NOT NULL, public_key TEXT NOT NULL,
      alg INTEGER NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '[]',
      label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, last_used_at TEXT)`),
    db.prepare(`DROP TABLE IF EXISTS login_attempts`),   // left over from passphrase sign-in
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
    stmts.push(db.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('seeded', ?)`).bind(now));
    await db.batch(stmts);  // one transaction: all or nothing
  }
  await db.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('schema_version', ?)`).bind(SCHEMA_VERSION).run();
}

// ---------------------------------------------------------------- auth

const editorEmails = env => String(env.EDITOR_EMAILS || '').split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const isEditor = (env, email) => !!email && editorEmails(env).includes(String(email).toLowerCase());
const randomId = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));

// Get (or create once) a random value stored in meta.
async function metaSecret(env, k, bytes = 32) {
  let v = await env.DB.prepare(`SELECT v FROM meta WHERE k = ?`).bind(k).first('v');
  if (!v) {
    await env.DB.prepare(`INSERT OR IGNORE INTO meta (k,v) VALUES (?,?)`).bind(k, randomId(bytes)).run();
    v = await env.DB.prepare(`SELECT v FROM meta WHERE k = ?`).bind(k).first('v');
  }
  return v;
}

// One HMAC key per request (read from D1 only when a request actually needs it).
function hmacKey(ctx) {
  ctx.key ??= metaSecret(ctx.env, 'session_key').then(v =>
    crypto.subtle.importKey('raw', unb64u(v), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  return ctx.key;
}

async function signToken(ctx, kind, obj) {
  const payload = b64u(enc.encode(JSON.stringify(obj)));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(ctx), enc.encode(kind + '.' + payload)));
  return payload + '.' + sig;
}

async function readToken(ctx, kind, token) {
  const [payload, sig, extra] = String(token || '').split('.');
  if (!payload || !sig || extra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(ctx), unb64u(sig), enc.encode(kind + '.' + payload)))) return null;
    const obj = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    return obj && obj.exp > Date.now() ? obj : null;
  } catch { return null; }
}

function getCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function setCookie(name, value, maxAgeSec, { path = HOME, sameSite = 'Lax' } = {}) {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=${sameSite}`;
}

async function readSession(ctx) {
  const raw = getCookie(ctx.request, COOKIE);
  if (!raw) return null;                       // visitors never touch the database for auth
  const s = await readToken(ctx, 'session', raw);
  return s && isEditor(ctx.env, s.email) ? s : null;
}

async function sessionCookie(ctx, email) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return setCookie(COOKIE, await signToken(ctx, 'session', { exp, email }), SESSION_DAYS * 86400);
}

const clearCookie = (name, path = HOME) => setCookie(name, '', 0, { path });

// Passkey challenges live in a short-lived signed cookie, so starting a sign-in never writes to the database.
async function issueChallenge(ctx, purpose) {
  const challenge = randomId(32);
  const token = await signToken(ctx, 'challenge', { exp: Date.now() + CHALLENGE_MINUTES * 60000, c: challenge, p: purpose });
  return { challenge, cookie: setCookie(CHALLENGE_COOKIE, token, CHALLENGE_MINUTES * 60, { path: API + 'auth/', sameSite: 'Strict' }) };
}

async function takeChallenge(ctx, purpose) {
  const t = await readToken(ctx, 'challenge', getCookie(ctx.request, CHALLENGE_COOKIE));
  if (!t || t.p !== purpose) throw new HttpError(400, 'That took too long or was started in another tab. Try again.');
  return t.c;
}

async function signedIn(ctx, email) {
  return json({ ok: true, email }, 200, { cookies: [await sessionCookie(ctx, email), clearCookie(CHALLENGE_COOKIE, API + 'auth/')] });
}

function deviceLabel(ua = '') {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'Chromebook' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux' : 'this device';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} on ${os}`;
}

const publicPasskey = p => ({ id: p.id, label: p.label, created_at: p.created_at, last_used_at: p.last_used_at });

async function listPasskeys(env, email) {
  const r = await env.DB.prepare(`SELECT * FROM passkeys WHERE email = ? ORDER BY created_at`).bind(email).all();
  return r.results;
}

// Routes under /fiddle/api/auth/.
async function authRoute(ctx, path, method, session) {
  const { env, request, url } = ctx;
  if (method !== 'GET') checkSameOrigin(request, url);
  const rp = { origin: url.origin, rpId: url.hostname };

  if (path === 'auth/google' && method === 'POST') {
    const body = await readJson(request);
    const who = await verifyGoogleIdToken(body.credential, { clientId: env.GOOGLE_CLIENT_ID, certsUrl: env.GOOGLE_CERTS_URL || undefined });
    if (!isEditor(env, who.email)) throw new HttpError(403, `${who.email} isn't allowed to edit this tune book.`);
    return signedIn(ctx, who.email);
  }

  if (path === 'auth/passkey/options' && method === 'POST') {
    const { challenge, cookie } = await issueChallenge(ctx, 'login');
    return json({ challenge, rpId: rp.rpId, timeout: CHALLENGE_MINUTES * 60000, userVerification: 'required' }, 200, { cookies: [cookie] });
  }

  if (path === 'auth/passkey/login' && method === 'POST') {
    const body = await readJson(request);
    const challenge = await takeChallenge(ctx, 'login');
    const id = b64u(unb64u(body.rawId));
    const row = await env.DB.prepare(`SELECT * FROM passkeys WHERE id = ?`).bind(id).first();
    if (!row) throw new HttpError(404, "That passkey isn't registered here (it may have been removed). Sign in with Google instead.");
    if (!isEditor(env, row.email)) throw new HttpError(403, `${row.email} isn't allowed to edit this tune book any more.`);
    if (body.userHandle && body.userHandle !== row.user_handle) throw new HttpError(401, "That passkey doesn't match its account.");
    const r = await verifyAssertion(body, { publicKey: row.public_key, alg: row.alg, signCount: row.sign_count },
      { challenge, origin: rp.origin, rpId: rp.rpId });
    await env.DB.prepare(`UPDATE passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?`)
      .bind(r.signCount, new Date().toISOString(), row.id).run();
    return signedIn(ctx, row.email);
  }

  // Everything below needs a signed-in editor.
  if (!session) throw new HttpError(401, 'Sign in first.');
  const email = session.email;

  if (path === 'auth/passkey/register/options' && method === 'POST') {
    const handle = await metaSecret(env, 'user_handle:' + email, 16);
    const existing = await listPasskeys(env, email);
    const { challenge, cookie } = await issueChallenge(ctx, 'register');
    return json({
      challenge,
      rp: { id: rp.rpId, name: 'Tune book' },
      user: { id: handle, name: email, displayName: email },
      pubKeyCredParams: SUPPORTED_ALGS.map(alg => ({ type: 'public-key', alg })),
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      attestation: 'none',
      timeout: CHALLENGE_MINUTES * 60000,
      excludeCredentials: existing.map(p => ({ type: 'public-key', id: p.id, transports: JSON.parse(p.transports || '[]') })),
    }, 200, { cookies: [cookie] });
  }

  if (path === 'auth/passkey/register' && method === 'POST') {
    const body = await readJson(request);
    const challenge = await takeChallenge(ctx, 'register');
    const v = await verifyRegistration(body, { challenge, origin: rp.origin, rpId: rp.rpId });
    const handle = await metaSecret(env, 'user_handle:' + email, 16);
    const count = (await listPasskeys(env, email)).length;
    if (count >= 20) throw new HttpError(400, 'That is a lot of passkeys. Remove some old ones first.');
    const label = deviceLabel(request.headers.get('user-agent') || '') + (v.synced ? ' (synced)' : '');
    const now = new Date().toISOString();
    const res = await env.DB.prepare(`INSERT OR IGNORE INTO passkeys (id,email,user_handle,public_key,alg,sign_count,transports,label,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(v.id, email, handle, v.publicKey, v.alg, v.signCount, JSON.stringify(v.transports), label, now).run();
    if (!res.meta.changes) throw new HttpError(409, 'That passkey is already registered.');
    return json({ ok: true, passkey: publicPasskey({ id: v.id, label, created_at: now, last_used_at: null }) }, 201,
      { cookies: [clearCookie(CHALLENGE_COOKIE, API + 'auth/')] });
  }

  if (path === 'auth/passkeys' && method === 'GET') {
    const list = await listPasskeys(env, email);
    const handle = await metaSecret(env, 'user_handle:' + email, 16);
    return json({ email, userHandle: handle, rpId: rp.rpId, passkeys: list.map(publicPasskey) });
  }

  let m;
  if ((m = path.match(/^auth\/passkeys\/([A-Za-z0-9_-]{1,1400})$/)) && method === 'DELETE') {
    const res = await env.DB.prepare(`DELETE FROM passkeys WHERE id = ? AND email = ?`).bind(m[1], email).run();
    if (!res.meta.changes) throw new HttpError(404, 'That passkey was already removed.');
    return json({ ok: true });
  }

  // Invalidate every session by rotating the signing key, then sign this device back in.
  if (path === 'auth/signout-others' && method === 'POST') {
    await env.DB.prepare(`UPDATE meta SET v = ? WHERE k = 'session_key'`).bind(randomId(32)).run();
    ctx.key = null;
    return json({ ok: true }, 200, { cookies: [await sessionCookie(ctx, email)] });
  }

  throw new HttpError(404, 'No such API route.');
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
  const ctx = { env, request, url, key: null };
  const session = await readSession(ctx);
  const editor = !!session;

  if (path === 'data' && method === 'GET') {
    const [tunes, open, notes] = await Promise.all([
      env.DB.prepare(`SELECT * FROM tunes ORDER BY id`).all(),
      env.DB.prepare(`SELECT * FROM open_titles ORDER BY id`).all(),
      editor ? env.DB.prepare(`SELECT v FROM meta WHERE k = 'working_notes'`).first('v') : null,
    ]);
    const cookies = [];
    if (editor && session.exp - Date.now() < RENEW_BELOW_DAYS * 864e5) cookies.push(await sessionCookie(ctx, session.email));
    const signin = { editingEnabled: editorEmails(env).length > 0, googleClientId: env.GOOGLE_CLIENT_ID || null };
    return json(editor
      ? { editor: true, email: session.email, ...signin, tunes: tunes.results, open: open.results, working_notes: notes || '' }
      : { editor: false, ...signin, tunes: tunes.results.map(publicTune),
          open: open.results.map(({ title, source, id }) => ({ id, title, source })) }, 200, { cookies });
  }

  if (path === 'logout' && method === 'POST') {
    checkSameOrigin(request, url);
    return json({ ok: true }, 200, { cookies: [clearCookie(COOKIE)] });
  }

  if (path.startsWith('auth/')) return authRoute(ctx, path, method, session);

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
