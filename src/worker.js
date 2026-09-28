// Tune book: static page + small JSON API backed by D1.
// Visitors read. The editor signs in with Google (accounts listed in EDITOR_EMAILS) or with a passkey
// they added after a Google sign-in. Sessions are signed with a random key kept in the database.
import seed from './seed.json';
import { AuthError, b64u, unb64u, enc, verifyGoogleIdToken, verifyRegistration, verifyAssertion, verifyRs256Jwt, SUPPORTED_ALGS } from './auth.js';
import { kindOf, serveType, buildIndex, matchFile } from './media.js';
import { serviceAccount, listTree, fetchMedia, oauthConfig, exchangeCode, writerToken, whoAmI, ensureFolder, uploadFile, WRITE_SCOPE } from './drive.js';
import { countsAsHeard } from '../public/fiddle/hearings.js';

const APEX = 'nategrimwood.com';
const HOME = '/fiddle';
const API = '/fiddle/api/';
const COOKIE = 'tb_session';
const CHALLENGE_COOKIE = 'tb_challenge';
const SESSION_DAYS = 400;            // browsers cap cookie lifetime at 400 days
const RENEW_BELOW_DAYS = 300;
const CHALLENGE_MINUTES = 5;
const SCHEMA_VERSION = '8';
const AUDIO_FOLDER = 'Audio from videos';          // inside the Fiddle folder; audio-only copies of videos
const JOB_AUDIENCE = 'tunebook-video-audio';        // GitHub Actions OIDC audience for the nightly job
const MEDIA_TOKEN_HOURS = 24;
// Alternate spellings used in Drive file names, added once when the "aka" column arrives (editable on the page).
const SEED_AKA = {
  'Angeline the Baker': 'Angelina Baker', 'Fly Around My Pretty Little Miss': 'Fly Away My Pretty Little Miss',
  'Me and My Fiddle': 'Me an My Fiddle', 'Reel St-Antoine': 'Saint Antoine', 'La Bastringue': 'La Bastrangue',
  "Mrs. Oliver Morris' Reel": "Miss Oliver Morris' Reel", "Earl of Dalhousie's Happy Return": 'Earl of Dilhousen Happy Return',
  "Sleep Soond Ida Mornin'": 'Sleep Soon Ida Mornin', "Roland White's": 'Roland White',
};

const TUNE_FIELDS = { name: 'text', key: 'text', genre: 'text', common: 'int0_10', form: 'text',
                      origin: 'text', status: 'int0_2', source: 'text', notes: 'text', aka: 'text', genres2: 'text',
                      top_media: 'text' };
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

  // Daily Drive rescan (see "triggers" in wrangler.jsonc), so new recordings show up without pressing anything.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureDb(env).then(() => serviceAccount(env) ? scanDrive(env) : null).catch(e => console.error('scan', e)));
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
    db.prepare(`CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0,
      folder TEXT NOT NULL DEFAULT '', path TEXT NOT NULL DEFAULT '', modified TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
      ignored INTEGER NOT NULL DEFAULT 0, gone INTEGER NOT NULL DEFAULT 0, first_seen TEXT NOT NULL DEFAULT '')`),
    // state 1 = linked, 0 = unlinked by hand (remembered so a rescan doesn't link it again)
    db.prepare(`CREATE TABLE IF NOT EXISTS media_links (
      media_id TEXT NOT NULL, tune_id INTEGER NOT NULL, state INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL DEFAULT '', PRIMARY KEY (media_id, tune_id))`),
    // Each time a tune was heard. An occasion is one lesson, class term, jam night, session or camp;
    // precision says how exact its dates are: day, month, season (a class term) or event (a camp week).
    // name is public; detail (a host's house, a teacher's name) and hearing notes are editor-only.
    db.prepare(`CREATE TABLE IF NOT EXISTS occasions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '',
      series TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', start TEXT NOT NULL DEFAULT '', end TEXT NOT NULL DEFAULT '',
      precision TEXT NOT NULL DEFAULT 'day', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`),
    // What enrichment runs (Claude researching the tune) found out, kept apart from what Nate added himself.
    db.prepare(`CREATE TABLE IF NOT EXISTS research (
      tune_id INTEGER PRIMARY KEY, type TEXT NOT NULL DEFAULT '', genres TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '', history TEXT NOT NULL DEFAULT '', sources TEXT NOT NULL DEFAULT '[]',
      confidence TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`),
    // Recordings, sheet music and references outside Drive (YouTube, archives...). origin: 'research' or 'mine'.
    db.prepare(`CREATE TABLE IF NOT EXISTS refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tune_id INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'recording', url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '', performer TEXT NOT NULL DEFAULT '', year TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT 'research',
      created_at TEXT NOT NULL DEFAULT '', UNIQUE (tune_id, url))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS hearings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, occasion_id INTEGER NOT NULL, tune_id INTEGER, open_id INTEGER,
      note TEXT NOT NULL DEFAULT '')`),
    // A tune's appearance on a community session's own tune list (Columbia City Jam, Couth Buzzard, etc.) --
    // a third provenance, distinct from Nate's own data and from research. "rank" is position within that
    // sheet's top list (1 = most played, or just list order for sheets with no play-count signal); "stat" is
    // a short human-readable readout of why it's there ("73 plays", "core repertoire"). Replaced wholesale
    // per sheet_key on each import so stale ranks don't linger.
    db.prepare(`CREATE TABLE IF NOT EXISTS session_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tune_id INTEGER NOT NULL, sheet_key TEXT NOT NULL,
      sheet_name TEXT NOT NULL DEFAULT '', rank INTEGER, stat TEXT NOT NULL DEFAULT '',
      synced_at TEXT NOT NULL DEFAULT '', UNIQUE (tune_id, sheet_key))`),
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
  // Migrations run after seeding so they also apply to freshly loaded tunes.
  const version = Number(await db.prepare(`SELECT v FROM meta WHERE k = 'schema_version'`).first('v') || 0);
  if (version < 3) {
    const cols = (await db.prepare(`PRAGMA table_info(tunes)`).all()).results.map(c => c.name);
    if (!cols.includes('aka')) await db.prepare(`ALTER TABLE tunes ADD COLUMN aka TEXT NOT NULL DEFAULT ''`).run();
    await db.batch(Object.entries(SEED_AKA).map(([name, aka]) =>
      db.prepare(`UPDATE tunes SET aka = ? WHERE name = ? AND aka = ''`).bind(aka, name)));
  }
  if (version < 4) {
    const cols = (await db.prepare(`PRAGMA table_info(media)`).all()).results.map(c => c.name);
    // audio_id on a video row: the Drive id of its audio-only copy, or 'none' when it has no audio track
    if (!cols.includes('audio_id')) await db.prepare(`ALTER TABLE media ADD COLUMN audio_id TEXT`).run();
  }
  if (version < 5) {
    const cols = (await db.prepare(`PRAGMA table_info(tunes)`).all()).results.map(c => c.name);
    // genres2: comma-separated secondary genres, alongside the required primary "genre" column.
    if (!cols.includes('genres2')) await db.prepare(`ALTER TABLE tunes ADD COLUMN genres2 TEXT NOT NULL DEFAULT ''`).run();
  }
  if (version < 6) {
    const cols = (await db.prepare(`PRAGMA table_info(tunes)`).all()).results.map(c => c.name);
    // top_media: the Drive media id to play from the compact card's play button, when manually chosen
    // (unset means "auto-pick" on the frontend: prefer a recording, then a video's audio-only copy, then the video).
    if (!cols.includes('top_media')) await db.prepare(`ALTER TABLE tunes ADD COLUMN top_media TEXT NOT NULL DEFAULT ''`).run();
  }
  if (version < 8) {
    const cols = (await db.prepare(`PRAGMA table_info(research)`).all()).results.map(c => c.name);
    // tags: research-derived style tags (crooked, pipe tune, session standard...), comma-separated
    if (!cols.includes('tags')) await db.prepare(`ALTER TABLE research ADD COLUMN tags TEXT NOT NULL DEFAULT ''`).run();
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function occasionLabel(o) {
  const [y, mo, d] = String(o.start || '').split('-').map(Number);
  if (!y) return o.name;
  if (o.precision === 'event') return `${o.name} ${y}`;
  const season = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'][mo - 1];
  const when = o.precision === 'day' ? `${MONTHS[mo - 1]} ${d}, ${y}` : o.precision === 'month' ? `${MONTHS[mo - 1]} ${y}` : `${season} ${y}`;
  return `${o.name}, ${when}`;
}
const OCCASION_KINDS = ['lesson', 'class', 'jam', 'session', 'camp', 'other'];
const PRECISIONS = ['day', 'month', 'season', 'event'];
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';

// "From" (tunes.source) is the first logged encounter, including lessons and classes.
async function refreshSources(env) {
  const rows = (await env.DB.prepare(`SELECT h.tune_id, o.* FROM hearings h JOIN occasions o ON o.id = h.occasion_id
    WHERE h.tune_id IS NOT NULL ORDER BY o.start, o.id`).all()).results;
  const first = new Map();
  for (const r of rows) if (!first.has(r.tune_id)) first.set(r.tune_id, occasionLabel(r));
  const openRows = (await env.DB.prepare(`SELECT h.open_id, o.* FROM hearings h JOIN occasions o ON o.id = h.occasion_id
    WHERE h.open_id IS NOT NULL ORDER BY o.start, o.id`).all()).results;
  const firstOpen = new Map();
  for (const r of openRows) if (!firstOpen.has(r.open_id)) firstOpen.set(r.open_id, occasionLabel(r));
  const stmts = [...first].map(([id, label]) => env.DB.prepare(`UPDATE tunes SET source = ? WHERE id = ? AND source != ?`).bind(label, id, label))
    .concat([...firstOpen].map(([id, label]) => env.DB.prepare(`UPDATE open_titles SET source = ? WHERE id = ? AND source != ?`).bind(label, id, label)));
  if (stmts.length) await env.DB.batch(stmts);
}

// Upsert occasions by key and replace each one's hearings. Tunes are matched by id, exact name or an
// "also known as" name; unidentified titles by id or exact title. Returns anything it couldn't match.
async function importHearings(env, occasions) {
  if (!Array.isArray(occasions) || !occasions.length) throw new HttpError(400, 'Send { occasions: [...] }.');
  const tunes = (await env.DB.prepare(`SELECT id, name, aka FROM tunes`).all()).results;
  const opens = (await env.DB.prepare(`SELECT id, title FROM open_titles`).all()).results;
  const norm = s => String(s || '').trim().toLowerCase();
  const byName = new Map();
  for (const t of tunes) for (const n of [t.name, ...String(t.aka || '').split(/[,;]/)]) if (norm(n) && !byName.has(norm(n))) byName.set(norm(n), t.id);
  const openByTitle = new Map(opens.map(o => [norm(o.title), o.id]));
  const tuneIds = new Set(tunes.map(t => t.id)), openIds = new Set(opens.map(o => o.id));
  const unmatched = [], now = new Date().toISOString();
  let count = 0;
  for (const o of occasions) {
    const key = clean('text', o.key);
    if (!key) throw new HttpError(400, 'Every occasion needs a key.');
    const kind = OCCASION_KINDS.includes(o.kind) ? o.kind : 'other';
    const precision = PRECISIONS.includes(o.precision) ? o.precision : 'day';
    const start = isoDate(o.start), end = isoDate(o.end) || start;
    if (!start) throw new HttpError(400, `Occasion ${key} needs a start date (YYYY-MM-DD).`);
    const occ = await env.DB.prepare(`INSERT INTO occasions (key,name,detail,series,kind,start,end,precision,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (key) DO UPDATE SET name = excluded.name, detail = excluded.detail,
      series = excluded.series, kind = excluded.kind, start = excluded.start, end = excluded.end,
      precision = excluded.precision, updated_at = excluded.updated_at RETURNING id`)
      .bind(key, clean('text', o.name), clean('text', o.detail), clean('text', o.series), kind, start, end, precision, now, now).first();
    const stmts = [env.DB.prepare(`DELETE FROM hearings WHERE occasion_id = ?`).bind(occ.id)];
    for (const h of o.hearings || []) {
      let tuneId = null, openId = null;
      if (h.tune_id != null) tuneId = tuneIds.has(Number(h.tune_id)) ? Number(h.tune_id) : null;
      else if (h.open_id != null) openId = openIds.has(Number(h.open_id)) ? Number(h.open_id) : null;
      else if (h.tune) tuneId = byName.get(norm(h.tune)) ?? null;
      else if (h.open) openId = openByTitle.get(norm(h.open)) ?? null;
      if (tuneId == null && openId == null) { unmatched.push({ occasion: key, ...h }); continue; }
      stmts.push(env.DB.prepare(`INSERT INTO hearings (occasion_id, tune_id, open_id, note) VALUES (?,?,?,?)`)
        .bind(occ.id, tuneId, openId, clean('text', h.note)));
      count++;
    }
    await env.DB.batch(stmts);
  }
  await refreshSources(env);
  return { ok: true, occasions: occasions.length, hearings: count, unmatched };
}

const REF_KINDS = ['recording', 'sheet', 'reference'];
const REF_CATEGORIES = ['style', 'source', 'band', 'teaching', 'other', ''];

// POST /research/import  body: { tunes: [{ tune | tune_id, type, genres: [], tags: [], region, summary, history, sources: [], confidence }],
//                                refs: [{ tune | tune_id, kind, url, title, performer, year, category, note, origin }] }
// Research rows are replaced field by field (omitted fields stay); refs upsert by (tune, url).
async function importResearch(env, body) {
  const tunes = (await env.DB.prepare(`SELECT id, name, aka FROM tunes`).all()).results;
  const norm = s => String(s || '').trim().toLowerCase();
  const byName = new Map();
  for (const t of tunes) for (const n of [t.name, ...String(t.aka || '').split(/[,;]/)]) if (norm(n) && !byName.has(norm(n))) byName.set(norm(n), t.id);
  const ids = new Set(tunes.map(t => t.id));
  const find = x => x.tune_id != null ? (ids.has(Number(x.tune_id)) ? Number(x.tune_id) : null) : (byName.get(norm(x.tune)) ?? null);
  const now = new Date().toISOString(), unmatched = [], stmts = [];
  const list = v => Array.isArray(v) ? v.map(x => clean('text', x)).filter(Boolean) : String(v || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
  for (const r of body.tunes || []) {
    const id = find(r);
    if (id == null) { unmatched.push(r.tune ?? r.tune_id); continue; }
    const cur = await env.DB.prepare(`SELECT * FROM research WHERE tune_id = ?`).bind(id).first() || {};
    const v = {
      type: 'type' in r ? clean('text', r.type) : cur.type || '',
      genres: 'genres' in r ? list(r.genres).join(', ') : cur.genres || '',
      region: 'region' in r ? clean('text', r.region) : cur.region || '',
      summary: 'summary' in r ? clean('text', r.summary) : cur.summary || '',
      history: 'history' in r ? String(r.history || '').slice(0, 20000) : cur.history || '',
      sources: 'sources' in r ? JSON.stringify(list(r.sources).filter(u => /^https?:\/\//.test(u))) : cur.sources || '[]',
      confidence: 'confidence' in r ? clean('text', r.confidence) : cur.confidence || '',
      tags: 'tags' in r ? list(r.tags).join(', ') : cur.tags || '',
    };
    stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO research (tune_id,type,genres,region,summary,history,sources,confidence,tags,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, v.type, v.genres, v.region, v.summary, v.history, v.sources, v.confidence, v.tags, now));
  }
  for (const f of body.refs || []) {
    const id = find(f), url = String(f.url || '');
    if (id == null || !/^https?:\/\//.test(url)) { unmatched.push({ ref: f.url, tune: f.tune ?? f.tune_id }); continue; }
    const kind = REF_KINDS.includes(f.kind) ? f.kind : 'recording';
    const category = REF_CATEGORIES.includes(f.category) ? f.category : 'other';
    const origin = f.origin === 'mine' ? 'mine' : 'research';
    stmts.push(env.DB.prepare(`INSERT INTO refs (tune_id,kind,url,title,performer,year,category,note,origin,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (tune_id, url) DO UPDATE SET kind = excluded.kind, title = excluded.title,
      performer = excluded.performer, year = excluded.year, category = excluded.category, note = excluded.note, origin = excluded.origin`)
      .bind(id, kind, url, clean('text', f.title), clean('text', f.performer), clean('text', String(f.year ?? '')), category,
            clean('text', f.note), origin, now));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { ok: true, research: (body.tunes || []).length, refs: (body.refs || []).length, unmatched };
}

// POST /session-sources/import  body: { sheets: [{ key, name, entries: [{ tune | tune_id, rank, stat }] }] }
// Each sheet's rows are replaced wholesale (old rows for that key deleted first) so stale ranks from an earlier
// pull never linger; a candidate not yet matched to a tune record (most of them, before enrichment) is reported
// in `unmatched` and simply isn't stored -- it stays tracked in data/session-tunes/candidates_pass1.json instead.
async function importSessionSources(env, body) {
  const tunes = (await env.DB.prepare(`SELECT id, name, aka FROM tunes`).all()).results;
  const norm = s => String(s || '').trim().toLowerCase();
  const byName = new Map();
  for (const t of tunes) for (const n of [t.name, ...String(t.aka || '').split(/[,;]/)]) if (norm(n) && !byName.has(norm(n))) byName.set(norm(n), t.id);
  const ids = new Set(tunes.map(t => t.id));
  const find = x => x.tune_id != null ? (ids.has(Number(x.tune_id)) ? Number(x.tune_id) : null) : (byName.get(norm(x.tune)) ?? null);
  const now = new Date().toISOString(), unmatched = [];
  let matched = 0;
  for (const sheet of body.sheets || []) {
    const key = clean('text', sheet.key);
    if (!key) continue;
    const stmts = [env.DB.prepare(`DELETE FROM session_sources WHERE sheet_key = ?`).bind(key)];
    (sheet.entries || []).forEach((e, i) => {
      const id = find(e);
      if (id == null) { unmatched.push({ sheet: key, tune: e.tune ?? e.tune_id }); return; }
      matched++;
      stmts.push(env.DB.prepare(`INSERT INTO session_sources (tune_id,sheet_key,sheet_name,rank,stat,synced_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT (tune_id, sheet_key) DO UPDATE SET sheet_name = excluded.sheet_name,
        rank = excluded.rank, stat = excluded.stat, synced_at = excluded.synced_at`)
        .bind(id, key, clean('text', sheet.name), Number.isFinite(+e.rank) ? +e.rank : i + 1, clean('text', e.stat), now));
    });
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  }
  return { ok: true, matched, unmatched };
}

async function researchData(env) {
  const [research, refs] = await Promise.all([
    env.DB.prepare(`SELECT * FROM research ORDER BY tune_id`).all(),
    env.DB.prepare(`SELECT * FROM refs ORDER BY tune_id, id`).all(),
  ]);
  return { research: research.results.map(r => ({ ...r, sources: JSON.parse(r.sources || '[]') })), refs: refs.results };
}

async function sessionSourceData(env) {
  const rows = await env.DB.prepare(`SELECT tune_id, sheet_key, sheet_name, rank, stat FROM session_sources ORDER BY tune_id, rank`).all();
  return { session_sources: rows.results };
}

async function hearingData(env, editor) {
  const [occ, hear] = await Promise.all([
    env.DB.prepare(`SELECT id, key, name, detail, series, kind, start, end, precision FROM occasions ORDER BY start, id`).all(),
    env.DB.prepare(`SELECT id, occasion_id, tune_id, open_id, note FROM hearings ORDER BY id`).all(),
  ]);
  return editor ? { occasions: occ.results, hearings: hear.results }
    : { occasions: occ.results.map(({ detail, key, series, ...o }) => o), hearings: hear.results.map(({ note, ...h }) => h) };
}

function publicTune(t) {
  const { notes, created_at, updated_at, aka, top_media, ...rest } = t;
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
      ? { editor: true, email: session.email, ...signin, tunes: tunes.results, open: open.results, working_notes: notes || '',
          ...(await hearingData(env, true)), ...(await researchData(env)), ...(await sessionSourceData(env)), ...(await mediaForEditor(ctx)) }
      : { editor: false, ...signin, tunes: tunes.results.map(publicTune),
          open: open.results.map(({ title, source, id }) => ({ id, title, source })), ...(await hearingData(env, false)), ...(await researchData(env)), ...(await sessionSourceData(env)) },
      200, { cookies });
  }

  if (path === 'logout' && method === 'POST') {
    checkSameOrigin(request, url);
    return json({ ok: true }, 200, { cookies: [clearCookie(COOKIE)] });
  }

  if (path.startsWith('auth/')) return authRoute(ctx, path, method, session);
  if (path.startsWith('job/')) return jobRoute(ctx, path, method);
  if (path === 'drive/callback' && method === 'GET') return driveCallback(ctx, session);

  // GET /media/:id/:token/:filename  -- the signed link works without a session so other apps can open it
  let mm;
  if ((mm = path.match(/^media\/([A-Za-z0-9_-]{10,100})\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\/[^/]+$/)) && (method === 'GET' || method === 'HEAD')) {
    return streamMedia(ctx, mm[1], mm[2]);
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
    await env.DB.batch([
      env.DB.prepare(`UPDATE edits SET new = ? WHERE id = (SELECT MAX(id) FROM edits WHERE action = 'promote' AND row_id = ?)`)
        .bind(String(tune.id), id),
      env.DB.prepare(`UPDATE hearings SET tune_id = ?, open_id = NULL WHERE open_id = ?`).bind(tune.id, id),
    ]);
    return json(tune, 201);
  }

  // POST /hearings/import  body: { occasions: [{ key, name, detail, series, kind, start, end, precision,
  //                                                hearings: [{ tune | tune_id | open | open_id, note }] }] }
  if (path === 'hearings/import' && method === 'POST') {
    const body = await readJson(request);
    return json(await importHearings(env, body.occasions));
  }
  if (path === 'research/import' && method === 'POST') {
    return json(await importResearch(env, await readJson(request)));
  }
  if (path === 'session-sources/import' && method === 'POST') {
    return json(await importSessionSources(env, await readJson(request)));
  }
  // DELETE /refs/:id
  if ((m = path.match(/^refs\/(\d+)$/)) && method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM refs WHERE id = ?`).bind(Number(m[1])).run();
    return json({ ok: true });
  }
  // DELETE /occasions/:key  (and its hearings)
  if ((m = path.match(/^occasions\/([^/]{1,200})$/)) && method === 'DELETE') {
    const key = decodeURIComponent(m[1]);
    const occ = await env.DB.prepare(`SELECT id FROM occasions WHERE key = ?`).bind(key).first();
    if (!occ) throw new HttpError(404, 'No such occasion.');
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM hearings WHERE occasion_id = ?`).bind(occ.id),
      env.DB.prepare(`DELETE FROM occasions WHERE id = ?`).bind(occ.id),
    ]);
    await refreshSources(env);
    return json({ ok: true });
  }

  if (path === 'meta/working_notes' && method === 'PUT') {
    const body = await readJson(request);
    const value = String(body.value ?? '').replace(/\r\n?/g, '\n');
    if (value.length > 100000) throw new HttpError(400, 'Notes are too long.');
    await env.DB.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('working_notes', ?)`).bind(value).run();
    return json({ ok: true });
  }

  if (path === 'drive/connect' && method === 'GET') return driveConnect(ctx, session);
  if (path === 'drive/disconnect' && method === 'POST') {
    await env.DB.prepare(`DELETE FROM meta WHERE k = 'drive_writer'`).run();
    return json({ ok: true });
  }

  if (path === 'drive/rescan' && method === 'POST') {
    if (!serviceAccount(env)) throw new HttpError(503, "Drive isn't connected yet. See the setup steps in the Drive recordings section.");
    return json(await scanDrive(env));
  }

  // PUT /links  body: { media_id, tune_id, linked }
  if (path === 'links' && method === 'PUT') {
    const body = await readJson(request);
    const mediaId = String(body.media_id || ''), tuneId = Number(body.tune_id);
    if (!(await env.DB.prepare(`SELECT id FROM media WHERE id = ?`).bind(mediaId).first())) throw new HttpError(404, 'That Drive file is no longer known. Rescan Drive.');
    await getRow(env, 'tunes', tuneId);
    await env.DB.prepare(`INSERT INTO media_links (media_id, tune_id, state, source, created_at) VALUES (?,?,?,?,?)
      ON CONFLICT (media_id, tune_id) DO UPDATE SET state = excluded.state, source = 'manual'`)
      .bind(mediaId, tuneId, body.linked === false ? 0 : 1, 'manual', new Date().toISOString()).run();
    return json({ ok: true });
  }

  // PUT /media/:id/ignored  body: { value }
  if ((m = path.match(/^media\/([A-Za-z0-9_-]{10,100})\/ignored$/)) && method === 'PUT') {
    const body = await readJson(request);
    await env.DB.prepare(`UPDATE media SET ignored = ? WHERE id = ?`).bind(body.value ? 1 : 0, m[1]).run();
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
  const media = await env.DB.prepare(`SELECT m.id, m.name, m.path, m.kind, m.url, group_concat(l.tune_id) AS tunes FROM media m
    JOIN media_links l ON l.media_id = m.id AND l.state = 1 WHERE m.gone = 0 GROUP BY m.id ORDER BY m.path, m.name`).all();
  return { exported_at: new Date().toISOString(), tunes: tunes.results, open: open.results, working_notes: notes || '',
    ...(await hearingData(env, true)), ...(await researchData(env)),
    media: media.results.map(x => ({ ...x, tunes: String(x.tunes || '').split(',').map(Number) })) };
}

function toMarkdown(d) {
  const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
  const genres = [...new Set(d.tunes.map(t => t.genre))].sort((a, b) => {
    const ia = GENRE_ORDER.indexOf(a), ib = GENRE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const counts = [0, 1, 2].map(i => d.tunes.filter(t => t.status === i).length);
  const occasions = new Map((d.occasions || []).map(o => [o.id, o]));
  const heard = new Map();
  for (const h of d.hearings || []) {
    if (h.tune_id == null || !countsAsHeard(occasions.get(h.occasion_id))) continue;
    heard.set(h.tune_id, (heard.get(h.tune_id) || new Set()).add(h.occasion_id));
  }
  const out = [
    "# Nate's tune book", '',
    `Exported from nategrimwood.com/fiddle on ${d.exported_at.slice(0, 10)}.`, '',
    '## How the columns work', '',
    '- **Common**: rough 1-10 guess at how widely players of that genre know the tune. Blank means unrated.',
    "- **Also**: other genres the tune fits, besides the section it's grouped under.",
    '- **Status**: anything in the Google Drive Fiddle folder counts as played; tunes in the VOM 2026 subfolder are played but not memorized; everything else is not played yet.',
    '- **From**: the first logged encounter with the tune, including lessons and classes.',
    '- **Heard**: separate non-teaching occasions (jams, sessions, camps and other encounters). Lessons and classes are logged but do not count here.',
    '- A `?` in Key, Form, or Origin means unconfirmed, not absent.', '',
    '## Totals', '',
    `- ${d.tunes.length} tunes traced`, `- ${counts[0]} memorized`, `- ${counts[1]} played, still learning`,
    `- ${counts[2]} not played yet`, `- ${d.open.length} titles still unidentified`, '',
    '## Tunes', '',
  ];
  for (const g of genres) {
    const rows = d.tunes.filter(t => t.genre === g)
      .sort((a, b) => (b.common ? 1 : 0) - (a.common ? 1 : 0) || b.common - a.common || a.name.localeCompare(b.name));
    out.push(`### ${g}`, '', '| Tune | Key | Common | Form | Also | Origin | Status | From | Heard | Notes |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const t of rows) {
      out.push(`| ${cell(t.name)} | ${cell(t.key)} | ${t.common || ''} | ${cell(t.form)} | ${cell(t.genres2)} | ${cell(t.origin)} | ${KNOW[t.status]} | ${cell(t.source)} | ${heard.get(t.id)?.size || ''} | ${cell(t.notes)} |`);
    }
    out.push('');
  }
  out.push('## Not yet identified', '', '| Title | From | Notes |', '|---|---|---|');
  for (const o of d.open) out.push(`| ${cell(o.title)} | ${cell(o.source)} | ${cell(o.notes)} |`);
  out.push('');
  if (d.working_notes) out.push(d.working_notes.trim(), '');
  return out.join('\n');
}

// ---------------------------------------------------------------- Drive recordings

async function mediaForEditor(ctx) {
  const { env } = ctx;
  const [media, links, last, writer, jobLast] = await Promise.all([
    env.DB.prepare(`SELECT id, name, mime, kind, size, folder, path, modified, url, ignored, audio_id FROM media WHERE gone = 0 ORDER BY path, name`).all(),
    env.DB.prepare(`SELECT media_id, tune_id FROM media_links WHERE state = 1`).all(),
    env.DB.prepare(`SELECT v FROM meta WHERE k = 'drive_last_scan'`).first('v'),
    env.DB.prepare(`SELECT v FROM meta WHERE k = 'drive_writer'`).first('v'),
    env.DB.prepare(`SELECT v FROM meta WHERE k = 'job_last'`).first('v'),
  ]);
  const sa = serviceAccount(env);
  const w = writer ? JSON.parse(writer) : null;
  return {
    media: media.results.map(x => ({ ...x, type: serveType(x.name, x.mime) })),
    links: links.results.map(l => [l.media_id, l.tune_id]),
    mediaToken: await signToken(ctx, 'media', { exp: Date.now() + MEDIA_TOKEN_HOURS * 36e5 }),
    drive: { configured: !!sa, robot: sa ? sa.client_email : null, folderId: env.DRIVE_FOLDER_ID || null,
             lastScan: last ? JSON.parse(last) : null,
             writer: { canConnect: !!oauthConfig(env), connected: !!w, email: w ? w.email : null, since: w ? w.at : null },
             job: jobLast ? JSON.parse(jobLast) : null, audioFolder: AUDIO_FOLDER },
  };
}

async function streamMedia(ctx, id, token) {
  const { env, request, url } = ctx;
  if (!(await readToken(ctx, 'media', token))) throw new HttpError(403, 'This recording link has expired. Reload the tune book and try again.');
  const row = await env.DB.prepare(`SELECT * FROM media WHERE id = ? AND gone = 0`).bind(id).first();
  if (!row) throw new HttpError(404, 'That recording is no longer in Drive.');
  const sa = serviceAccount(env);
  if (!sa) throw new HttpError(503, "Drive isn't connected.");
  const upstream = await fetchMedia(sa, id, request.headers.get('range'));
  if (!upstream.ok && upstream.status !== 206) {
    if (upstream.status === 416) return new Response(null, { status: 416, headers: { 'content-range': upstream.headers.get('content-range') || '' } });
    throw new HttpError(502, `Drive wouldn't send that file (HTTP ${upstream.status}).`);
  }
  const h = new Headers();
  for (const k of ['content-length', 'content-range', 'etag', 'last-modified']) if (upstream.headers.get(k)) h.set(k, upstream.headers.get(k));
  h.set('content-type', serveType(row.name, row.mime));
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'private, max-age=3600');
  const fname = encodeURIComponent(row.name).replace(/['()]/g, escape);
  h.set('content-disposition', `${url.searchParams.has('dl') ? 'attachment' : 'inline'}; filename*=UTF-8''${fname}`);
  return new Response(ctx.request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: h });
}

// List the Fiddle folder, record new/changed/removed files, and link new files to tunes when the match is clear.
async function scanDrive(env) {
  const db = env.DB;
  const started = new Date().toISOString();
  const summary = { at: started, files: 0, added: 0, removed: 0, linked: 0, unmatched: 0, error: null };
  try {
    if (!env.DRIVE_FOLDER_ID) throw new Error('DRIVE_FOLDER_ID is not set in wrangler.jsonc.');
    const found = (await listTree(serviceAccount(env), env.DRIVE_FOLDER_ID))
      .map(f => ({ ...f, kind: kindOf(f.name, f.mime) })).filter(f => f.kind);
    summary.files = found.length;
    const [known, linked, tunes] = await Promise.all([
      db.prepare(`SELECT id, name, size, modified, path, url, gone FROM media`).all(),
      db.prepare(`SELECT DISTINCT media_id FROM media_links`).all(),
      db.prepare(`SELECT id, name, aka FROM tunes`).all(),
    ]);
    const byId = new Map(known.results.map(r => [r.id, r]));
    const hasLinks = new Set(linked.results.map(r => r.media_id));
    const seen = new Set();
    const stmts = [];
    for (const f of found) {
      seen.add(f.id);
      const k = byId.get(f.id);
      if (!k) {
        summary.added++;
        stmts.push(db.prepare(`INSERT INTO media (id,name,mime,kind,size,folder,path,modified,url,first_seen) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(f.id, f.name, f.mime, f.kind, f.size, f.folder, f.path, f.modified, f.url, started));
      } else if (k.gone || k.name !== f.name || k.size !== f.size || k.modified !== f.modified || k.path !== f.path || k.url !== f.url) {
        stmts.push(db.prepare(`UPDATE media SET name=?, mime=?, kind=?, size=?, folder=?, path=?, modified=?, url=?, gone=0 WHERE id=?`)
          .bind(f.name, f.mime, f.kind, f.size, f.folder, f.path, f.modified, f.url, f.id));
      }
    }
    const goneIds = [];
    for (const k of known.results) {
      if (!k.gone && !seen.has(k.id)) { summary.removed++; goneIds.push(k.id); stmts.push(db.prepare(`UPDATE media SET gone = 1 WHERE id = ?`).bind(k.id)); }
    }
    // An audio copy deleted from Drive frees its video to be converted again.
    for (const id of goneIds) stmts.push(db.prepare(`UPDATE media SET audio_id = NULL WHERE audio_id = ?`).bind(id));
    // Pair audio copies in the "Audio from videos" folder with their videos (by name) and give them the video's tunes.
    const videosByStem = new Map(found.filter(f => f.kind === 'video').map(f => [stem(f.name).toLowerCase(), f]));
    for (const f of found) {
      if (f.kind !== 'audio' || f.folder !== AUDIO_FOLDER || f.path !== AUDIO_FOLDER) continue;
      const v = videosByStem.get(stem(f.name).replace(/\s*\(audio\)$/i, '').toLowerCase());
      if (!v) continue;
      stmts.push(db.prepare(`UPDATE media SET audio_id = ? WHERE id = ? AND (audio_id IS NULL OR audio_id = 'none')`).bind(f.id, v.id));
      if (!hasLinks.has(f.id)) {
        hasLinks.add(f.id);
        stmts.push(db.prepare(`INSERT OR IGNORE INTO media_links (media_id, tune_id, state, source, created_at)
          SELECT ?, tune_id, 1, 'video', ? FROM media_links WHERE media_id = ? AND state = 1`).bind(f.id, started, v.id));
      }
    }
    // Only files nobody has linked or unlinked yet get matched, so manual choices always stand.
    const index = buildIndex(tunes.results);
    for (const f of found) {
      if (hasLinks.has(f.id)) continue;
      const ids = matchFile(f.name, f.folder, index);
      if (!ids.length) { summary.unmatched++; continue; }
      for (const t of ids) {
        summary.linked++;
        stmts.push(db.prepare(`INSERT OR IGNORE INTO media_links (media_id, tune_id, state, source, created_at) VALUES (?,?,1,'auto',?)`)
          .bind(f.id, t, started));
      }
    }
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  } catch (e) {
    summary.error = e.message || String(e);
  }
  await db.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('drive_last_scan', ?)`).bind(JSON.stringify(summary)).run();
  return summary;
}

const stem = name => String(name).replace(/\.[A-Za-z0-9]{1,5}$/, '');

// ---------------------------------------------------------------- saving to Drive (Nate's permission)

async function driveConnect(ctx, session) {
  const cfg = oauthConfig(ctx.env);
  if (!cfg) throw new HttpError(503, 'Add the GOOGLE_CLIENT_SECRET secret in Cloudflare first (see the steps in Drive recordings).');
  const state = await signToken(ctx, 'drive-connect', { exp: Date.now() + 10 * 60000, email: session.email });
  const u = new URL(cfg.authUrl);
  u.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: ctx.url.origin + API + 'drive/callback', response_type: 'code',
    scope: WRITE_SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', login_hint: session.email, state }).toString();
  return Response.redirect(u.toString(), 302);
}

async function driveCallback(ctx, session) {
  const { env, url } = ctx;
  const back = msg => Response.redirect(`${url.origin}${HOME}?drive=${encodeURIComponent(msg)}#driveBox`, 302);
  if (!session) return back('Sign in to the tune book first, then try again.');
  if (url.searchParams.get('error')) return back(`Google said: ${url.searchParams.get('error')}`);
  const st = await readToken(ctx, 'drive-connect', url.searchParams.get('state'));
  if (!st || st.email !== session.email) return back('That took too long. Try again.');
  const cfg = oauthConfig(env);
  if (!cfg) return back('GOOGLE_CLIENT_SECRET is missing in Cloudflare.');
  try {
    const t = await exchangeCode(cfg, url.searchParams.get('code') || '', url.origin + API + 'drive/callback');
    if (!t.refresh_token) return back("Google didn't grant lasting access. Try again.");
    if (!String(t.scope || '').split(' ').includes(WRITE_SCOPE)) return back('Tick the box that lets Tune Book see and edit your Drive files, then try again.');
    const email = await whoAmI(cfg, t.access_token);
    if (!isEditor(env, email)) return back(`${email} isn't the tune book's owner.`);
    await env.DB.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('drive_writer', ?)`)
      .bind(JSON.stringify({ refresh_token: t.refresh_token, email, at: new Date().toISOString() })).run();
    return back('connected');
  } catch (e) {
    return back(e.message || String(e));
  }
}

async function writer(env) {
  const cfg = oauthConfig(env);
  const raw = await env.DB.prepare(`SELECT v FROM meta WHERE k = 'drive_writer'`).first('v');
  if (!cfg || !raw) return null;
  const w = JSON.parse(raw);
  try { return { cfg, token: await writerToken(cfg, w.refresh_token) }; }
  catch (e) { throw new HttpError(502, `Saving to Drive stopped working (${e.message}). Click "Allow saving to Drive" again.`); }
}

// ---------------------------------------------------------------- nightly job (GitHub Actions)
// The job proves who it is with a GitHub OIDC token, so no secret has to be copied into GitHub.

async function jobAuth(ctx) {
  const { env, request } = ctx;
  const m = /^Bearer\s+(.+)$/.exec(request.headers.get('authorization') || '');
  if (!m) throw new HttpError(401, 'Job token missing.');
  const claims = await verifyRs256Jwt(m[1], {
    certsUrl: env.GITHUB_JWKS_URL || 'https://token.actions.githubusercontent.com/.well-known/jwks',
    issuers: [env.GITHUB_OIDC_ISSUER || 'https://token.actions.githubusercontent.com'],
    audience: JOB_AUDIENCE, maxAgeSec: 3600, label: 'job',
  });
  if (claims.repository !== env.GITHUB_REPO || claims.ref !== 'refs/heads/main') throw new HttpError(403, 'That job is not allowed here.');
  return claims;
}

async function jobRoute(ctx, path, method) {
  const { env, request, url } = ctx;
  await jobAuth(ctx);
  let m;
  if (path === 'job/pending' && method === 'GET') {
    const connected = !!(await env.DB.prepare(`SELECT v FROM meta WHERE k = 'drive_writer'`).first('v')) && !!oauthConfig(env);
    const rows = connected ? (await env.DB.prepare(`SELECT id, name, size, mime FROM media
      WHERE kind = 'video' AND gone = 0 AND ignored = 0 AND audio_id IS NULL ORDER BY first_seen DESC LIMIT 25`).all()).results : [];
    const token = await signToken(ctx, 'media', { exp: Date.now() + 6 * 36e5 });
    await env.DB.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('job_last', ?)`)
      .bind(JSON.stringify({ at: new Date().toISOString(), pending: rows.length, connected })).run();
    return json({ connected, videos: rows.map(r => ({ id: r.id, name: r.name, size: r.size,
      url: `${url.origin}${API}media/${r.id}/${token}/${encodeURIComponent(r.name)}` })) });
  }
  if ((m = path.match(/^job\/audio\/([A-Za-z0-9_-]{10,100})$/)) && method === 'POST') {
    const video = await env.DB.prepare(`SELECT * FROM media WHERE id = ? AND kind = 'video'`).bind(m[1]).first();
    if (!video) throw new HttpError(404, 'Unknown video.');
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 90e6) throw new HttpError(413, 'Audio file is too big.');
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) throw new HttpError(400, 'Empty audio file.');
    const w = await writer(env);
    if (!w) throw new HttpError(409, 'Saving to Drive is not connected.');
    let folderId = await env.DB.prepare(`SELECT v FROM meta WHERE k = 'audio_folder_id'`).first('v');
    if (!folderId) {
      folderId = await ensureFolder(w.cfg, w.token, env.DRIVE_FOLDER_ID, AUDIO_FOLDER);
      await env.DB.prepare(`INSERT OR REPLACE INTO meta (k,v) VALUES ('audio_folder_id', ?)`).bind(folderId).run();
    }
    let f;
    try { f = await uploadFile(w.cfg, w.token, folderId, `${stem(video.name)} (audio).m4a`, 'audio/mp4', bytes); }
    catch (e) {
      // the folder may have been deleted by hand; forget it and let the next run recreate it
      await env.DB.prepare(`DELETE FROM meta WHERE k = 'audio_folder_id'`).run();
      throw new HttpError(502, e.message);
    }
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO media (id,name,mime,kind,size,folder,path,modified,url,first_seen) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(f.id, f.name, f.mimeType || 'audio/mp4', 'audio', Number(f.size || bytes.byteLength), AUDIO_FOLDER, AUDIO_FOLDER, f.modifiedTime || now, f.webViewLink || '', now),
      env.DB.prepare(`UPDATE media SET audio_id = ? WHERE id = ?`).bind(f.id, video.id),
      env.DB.prepare(`INSERT OR IGNORE INTO media_links (media_id, tune_id, state, source, created_at)
        SELECT ?, tune_id, 1, 'video', ? FROM media_links WHERE media_id = ? AND state = 1`).bind(f.id, now, video.id),
    ]);
    return json({ ok: true, id: f.id, name: f.name });
  }
  if ((m = path.match(/^job\/skip\/([A-Za-z0-9_-]{10,100})$/)) && method === 'POST') {
    await env.DB.prepare(`UPDATE media SET audio_id = 'none' WHERE id = ? AND kind = 'video'`).bind(m[1]).run();
    return json({ ok: true });
  }
  throw new HttpError(404, 'No such job route.');
}
