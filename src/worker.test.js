import assert from 'node:assert/strict';
import { createHash, createHmac, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import test from 'node:test';
import worker from './worker.js';

const sessionKey = randomBytes(32);
const editorEmail = 'editor@example.test';
const viewerEmail = 'viewer@example.test';
const assetPage = '<!doctype html><html><head><title>Tune book</title></head><body class="book"><p>public-asset-page</p></body></html>';
const reference = (id, origin, kind = 'recording') => ({
  id, tune_id: 1, kind, origin,
  title: `${origin === 'research' ? 'public' : 'private'}-ref-${id}`,
  url: `https://example.test/${origin}/${id}`,
  note: `${origin === 'research' ? 'public' : 'private'}-ref-note-${id}`,
});
const references = [
  reference(1, 'research'),
  reference(2, 'mine'),
  reference(3, 'mine', 'sheet'),
  reference(4, 'research', 'sheet'),
  reference(5, 'mine', 'reference'),
  reference(6, 'unexpected'),
];

const tuneDefaults = {
  key: '', genre: 'Old-time', common: 0, form: '', origin: '', status: 2, source: '',
  notes: '', aka: '', genres2: '', top_media: '', high_interest: 0,
};

function environment({ schemaVersion = '9', highInterestColumn = true } = {}) {
  const tables = {
    tunes: [{ ...tuneDefaults, id: 1, name: 'Synthetic tune', notes: 'private-tune-note', aka: 'private-alias', top_media: 'ref:2' }],
    open_titles: [],
    research: [{ tune_id: 1, sources: '["https://example.test/research"]', history: 'Synthetic history text' }],
    refs: references,
    occasions: [],
    hearings: [],
    session_sources: [],
    media: [],
    media_links: [],
    edits: [],
    pop_scores: [],
    pop_evidence: [],
    planning_page: [],
    planning_scenarios: [],
  };
  if (!highInterestColumn) delete tables.tunes[0].high_interest;
  const meta = new Map([
    ['seeded', 'test-fixtures'],
    ['schema_version', schemaVersion],
    ['session_key', sessionKey.toString('base64url')],
    ['working_notes', 'private-working-note'],
  ]);
  const statements = [];
  const DB = {
    prepare(sql) {
      statements.push(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first(column) {
          let row;
          if (/^SELECT v FROM meta WHERE k = /.test(sql)) {
            const key = parameters[0] ?? sql.match(/WHERE k = '([^']+)'/)[1];
            row = meta.has(key) ? { v: meta.get(key) } : null;
          } else if (sql === 'SELECT html, updated_at FROM planning_page WHERE id = 1') {
            row = structuredClone(tables.planning_page[0] ?? null);
          } else if (sql === 'SELECT COUNT(*) AS n FROM planning_scenarios WHERE id != ?') {
            row = { n: tables.planning_scenarios.filter(s => s.id !== parameters[0]).length };
          } else {
            const table = sql.match(/^SELECT (?:\*|id) FROM (tunes|edits) WHERE id = \?$/)?.[1];
            assert.ok(table, `Unexpected first: ${sql}`);
            row = structuredClone(tables[table].find(row => row.id === parameters[0]) ?? null);
          }
          return column ? row?.[column] ?? null : row;
        },
        async all() {
          if (sql === 'PRAGMA table_info(tunes)') {
            return { results: Object.keys(tables.tunes[0]).map(name => ({ name })) };
          }
          if (sql.includes('FROM pop_scores s')) return { results: structuredClone(tables.pop_scores) };
        const table = sql.match(/\bFROM (\w+)/)?.[1];
          assert.ok(Object.hasOwn(tables, table), `Unexpected read: ${sql}`);
          return { results: structuredClone(tables[table]) };
        },
        async run() {
          if (sql.startsWith('ALTER TABLE tunes ADD COLUMN high_interest ')) {
            for (const tune of tables.tunes) tune.high_interest = 0;
            return { success: true };
          }
          if (sql.startsWith("INSERT OR REPLACE INTO meta (k,v) VALUES ('schema_version'")) {
            meta.set('schema_version', parameters[0]);
            return { success: true };
          }
          if (sql === 'UPDATE tunes SET high_interest = ?, updated_at = ? WHERE id = ?') {
            const tune = tables.tunes.find(t => t.id === parameters[2]);
            assert.ok(tune);
            [tune.high_interest, tune.updated_at] = parameters;
            return { success: true, meta: { changes: 1 } };
          }
          if (sql === 'SELECT * FROM tunes WHERE id = ?') {
            return { results: structuredClone(tables.tunes.filter(t => t.id === parameters[0])) };
          }
          if (sql.startsWith('INSERT INTO edits ')) {
            const fields = ['at', 'action', 'tbl', 'row_id', 'label', 'field', 'old', 'new'];
            const row = { id: tables.edits.length + 1, undone: 0, ...Object.fromEntries(fields.map((field, i) => [field, parameters[i]])) };
            tables.edits.push(row);
            return { success: true, meta: { last_row_id: row.id } };
          }
          if (sql.startsWith('INSERT INTO tunes ')) {
            const fields = sql.match(/^INSERT INTO tunes \(([^)]+)\)/)[1].split(',');
            const row = { ...tuneDefaults, id: Math.max(0, ...tables.tunes.map(t => t.id)) + 1,
              ...Object.fromEntries(fields.map((field, i) => [field, parameters[i]])) };
            tables.tunes.push(row);
            return { success: true, results: [structuredClone(row)], meta: { last_row_id: row.id } };
          }
          if (sql === 'DELETE FROM tunes WHERE id = ?') {
            tables.tunes = tables.tunes.filter(t => t.id !== parameters[0]);
            return { success: true };
          }
          if (sql === 'INSERT OR REPLACE INTO planning_scenarios (id, name, data, updated_at) VALUES (?, ?, ?, ?)') {
            const [id, name, data, updated_at] = parameters;
            tables.planning_scenarios = tables.planning_scenarios.filter(s => s.id !== id).concat([{ id, name, data, updated_at }]);
            return { success: true };
          }
          if (sql === 'DELETE FROM planning_scenarios WHERE id = ?') {
            tables.planning_scenarios = tables.planning_scenarios.filter(s => s.id !== parameters[0]);
            return { success: true };
          }
          if (sql === "INSERT OR REPLACE INTO meta (k,v) VALUES ('planning_published_at', ?)") {
            meta.set('planning_published_at', parameters[0]);
            return { success: true };
          }
          if (sql === 'INSERT OR REPLACE INTO planning_page (id, html, updated_at) VALUES (1, ?, ?)') {
            tables.planning_page = [{ id: 1, html: parameters[0], updated_at: parameters[1] }];
            return { success: true };
          }
          if (sql === 'UPDATE edits SET undone = 1 WHERE id = ?') {
            tables.edits.find(e => e.id === parameters[0]).undone = 1;
            return { success: true };
          }
          assert.match(sql, /^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|DROP TABLE IF EXISTS|INSERT OR REPLACE INTO meta \(k,v\) VALUES \('schema_version')/);
          return { success: true };
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
  };
  const assetRequests = [];
  const ASSETS = {
    async fetch(request) {
      assetRequests.push(request);
      return new Response(assetPage, { headers: { 'content-type': 'text/html', etag: '"asset-etag"', 'cache-control': 'public, max-age=0, must-revalidate' } });
    },
  };
  return { DB, ASSETS, EDITOR_EMAILS: editorEmail, VIEWER_EMAILS: viewerEmail, tables, meta, statements, assetRequests };
}

// Sessions issued before /planning have no path field (p); newer ones are site-wide (p: '/').
function sessionCookie(email = editorEmail, exp = Date.now() + 400 * 864e5, extra = {}) {
  const payload = Buffer.from(JSON.stringify({ email, exp, ...extra })).toString('base64url');
  const signature = createHmac('sha256', sessionKey).update(`session.${payload}`).digest('base64url');
  return `tb_session=${payload}.${signature}`;
}

async function get(path = 'data', cookie, env = environment(), handler = worker) {
  const request = new Request(`https://nategrimwood.com/fiddle/api/${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return handler.fetch(request, env);
}

async function write(env, method, path, body, { cookie = sessionCookie(), origin = 'https://nategrimwood.com' } = {}) {
  const headers = { 'content-type': 'application/json', origin };
  if (cookie) headers.cookie = cookie;
  return worker.fetch(new Request(`https://nategrimwood.com/fiddle/api/${path}`, {
    method, headers, body: JSON.stringify(body),
  }), env);
}

async function assertPublicData(cookie) {
  const response = await get('data', cookie);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.editor, false);
  assert.deepEqual(data.refs, references.filter(ref => ref.origin === 'research'));
  // Long text is fetched per tune; signed-out readers get the research refs' notes and nothing personal.
  const detail = await (await get('tunes/1/detail', cookie)).json();
  assert.deepEqual(detail.research.sources, ['https://example.test/research']);
  assert.equal(detail.research.history, 'Synthetic history text');
  assert.deepEqual(detail.refs.map(f => f.id), references.filter(ref => ref.origin === 'research').map(ref => ref.id));
  assert.ok(!JSON.stringify(detail).includes('private-'));
  assert.equal(data.tunes[0].top_media, undefined);
  assert.equal(data.media, undefined);
  assert.equal(data.working_notes, undefined);
  assert.ok(!JSON.stringify(data).includes('private-'));
}

test('signed-out readers receive research refs, never personal or unknown-origin refs', () => assertPublicData());
test('an invalid session does not expose personal refs', () => assertPublicData('tb_session=invalid.signature'));
test('an expired session does not expose personal refs', () => assertPublicData(sessionCookie(editorEmail, Date.now() - 1000)));
test('a signed session for a non-editor does not expose personal refs', () => assertPublicData(sessionCookie('visitor@example.test')));

test('editors retain all refs and their private top-recording selection', async () => {
  const response = await get('data', sessionCookie());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.editor, true);
  assert.deepEqual(data.refs, references);
  assert.equal(data.tunes[0].top_media, 'ref:2');
  assert.equal(data.working_notes, 'private-working-note');
});

test('authenticated JSON backups retain personal and research refs', async () => {
  const response = await get('export.json', sessionCookie());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.refs, references);
  assert.equal(data.tunes[0].top_media, 'ref:2');
});

test('the data payload carries each tune\'s popularity score and badge', async () => {
  const env = environment();
  env.tables.pop_scores = [{ tune_id: 1, score: 7, basis: 'local + online', curated: 1, n: 3 }];
  const response = await get('data', undefined, env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.popularity, { 1: { score: 7, basis: 'local + online', curated: true, n: 3 } });
});

test('signed-out readers cannot download a private JSON backup', async () => {
  const response = await get('export.json');
  assert.equal(response.status, 401);
  assert.ok(!(await response.text()).includes('private-'));
});

test('schema 8 tunes migrate to unmarked without changing learning status', async () => {
  const { default: isolatedWorker } = await import('./worker.js?interest-migration');
  const env = environment({ schemaVersion: '8', highInterestColumn: false });
  env.tables.tunes[0].status = 0;
  const response = await get('data', sessionCookie(), env, isolatedWorker);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.tunes[0].high_interest, 0);
  assert.equal(data.tunes[0].status, 0);
  assert.equal(env.meta.get('schema_version'), '9');
  assert.equal(env.statements.filter(sql => sql.startsWith('ALTER TABLE tunes ADD COLUMN high_interest ')).length, 1);
});

test('a partially applied interest migration preserves existing marks', async () => {
  const { default: isolatedWorker } = await import('./worker.js?interest-migration-existing');
  const env = environment({ schemaVersion: '8' });
  env.tables.tunes[0].high_interest = 1;
  const response = await get('data', sessionCookie(), env, isolatedWorker);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tunes[0].high_interest, 1);
  assert.equal(env.meta.get('schema_version'), '9');
  assert.ok(!env.statements.some(sql => sql.startsWith('ALTER TABLE tunes ADD COLUMN high_interest ')));
});

test('high interest persists independently, can be cleared, and supports history undo', async () => {
  const env = environment();
  const marked = await write(env, 'PATCH', 'tunes/1', { field: 'high_interest', value: 1 });
  assert.equal(marked.status, 200);
  assert.equal((await marked.json()).high_interest, 1);
  const publicData = await (await get('data', undefined, env)).json();
  assert.equal(publicData.tunes[0].high_interest, 1);
  assert.equal(publicData.tunes[0].status, 2);
  assert.equal(env.tables.tunes[0].top_media, 'ref:2');
  assert.equal(env.tables.edits[0].field, 'high_interest');
  assert.equal(env.tables.edits[0].old, '0');
  assert.equal(env.tables.edits[0].new, '1');
  const cleared = await write(env, 'PATCH', 'tunes/1', { field: 'high_interest', value: 0 });
  assert.equal((await cleared.json()).high_interest, 0);
  const undone = await write(env, 'POST', 'undo/2', {});
  assert.equal(undone.status, 200);
  assert.equal(env.tables.tunes[0].high_interest, 1);
  assert.equal(env.tables.edits[1].undone, 1);
});

test('tune creation accepts an interest mark and defaults other tunes to unmarked', async () => {
  const env = environment();
  const marked = await write(env, 'POST', 'tunes', { fields: { name: 'Interested tune', high_interest: 1 } });
  assert.equal(marked.status, 201);
  assert.equal((await marked.json()).high_interest, 1);
  const ordinary = await write(env, 'POST', 'tunes', { fields: { name: 'Ordinary tune' } });
  assert.equal(ordinary.status, 201);
  assert.equal((await ordinary.json()).high_interest, 0);
});

test('invalid interest values are rejected without changing data or edit history', async () => {
  const env = environment();
  for (const value of [-1, 2, 0.5, 'high']) {
    const response = await write(env, 'PATCH', 'tunes/1', { field: 'high_interest', value });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /whole number from 0 to 1/);
  }
  const create = await write(env, 'POST', 'tunes', { fields: { name: 'Invalid tune', high_interest: 2 } });
  assert.equal(create.status, 400);
  assert.equal(env.tables.tunes.length, 1);
  assert.equal(env.tables.tunes[0].high_interest, 0);
  assert.equal(env.tables.edits.length, 0);
});

test('interest edits require the editor session and same-origin requests', async () => {
  const env = environment();
  const body = { field: 'high_interest', value: 1 };
  assert.equal((await write(env, 'PATCH', 'tunes/1', body, { cookie: null })).status, 401);
  assert.equal((await write(env, 'PATCH', 'tunes/1', body, { origin: 'https://other.example.test' })).status, 403);
  assert.equal(env.tables.tunes[0].high_interest, 0);
  assert.equal(env.tables.edits.length, 0);
});

test('JSON and Markdown backups retain high interest without implying a learning status', async () => {
  const env = environment();
  env.tables.tunes[0].high_interest = 1;
  const json = await (await get('export.json', sessionCookie(), env)).json();
  assert.equal(json.tunes[0].high_interest, 1);
  assert.equal(json.tunes[0].status, 2);
  const markdown = await (await get('export.md', sessionCookie(), env)).text();
  assert.match(markdown, /\| Status \| High interest \| From \|/);
  assert.match(markdown, /\| Not played yet \| Yes \|/);
  assert.match(markdown, /1 high interest/);
});

test('undoing a tune deletion restores its interest mark', async () => {
  const env = environment();
  env.tables.tunes[0].high_interest = 1;
  const removed = await write(env, 'DELETE', 'tunes/1', {});
  assert.equal(removed.status, 200);
  const { edit_id } = await removed.json();
  assert.equal(env.tables.tunes.length, 0);
  const restored = await write(env, 'POST', `undo/${edit_id}`, {});
  assert.equal(restored.status, 200);
  assert.equal(env.tables.tunes[0].id, 1);
  assert.equal(env.tables.tunes[0].high_interest, 1);
  assert.equal(env.tables.tunes[0].status, 2);
});

test('the data feed leaves out long text and sends its lengths instead', async () => {
  const env = environment();
  const response = await get('data', undefined, env);
  assert.equal(response.status, 200);
  assert.ok(env.statements.some(sql => /length\(history\) AS history_len/.test(sql)));
  assert.ok(env.statements.some(sql => /length\(note\) AS note_len/.test(sql)));
  assert.ok(!env.statements.some(sql => sql === 'SELECT * FROM research ORDER BY tune_id'));
});

test('editors get every recording note from the detail endpoint', async () => {
  const detail = await (await get('tunes/1/detail', sessionCookie())).json();
  assert.deepEqual(detail.refs.map(f => f.id), references.map(ref => ref.id));
});

test('the search index carries each tune\'s history', async () => {
  const index = await (await get('search-index')).json();
  assert.deepEqual(index.history, { 1: 'Synthetic history text' });
});

test('backups still carry the full research text', async () => {
  const json = await (await get('export.json', sessionCookie())).json();
  assert.equal(json.research[0].history, 'Synthetic history text');
  assert.deepEqual(json.research[0].sources, ['https://example.test/research']);
});

// ---------------------------------------------------------------- /planning and the site hub

const planningHtml = '<!doctype html><html><head><title>Plan</title></head><body><p>private-planning-number 123,456</p></body></html>';

async function page(path, cookie, env = environment(), headers = {}) {
  const h = { accept: 'text/html,application/xhtml+xml', ...headers };
  if (cookie) h.cookie = cookie;
  return worker.fetch(new Request(`https://nategrimwood.com${path}`, { headers: h }), env);
}

async function upload(env, cookie, { html = planningHtml, origin = 'https://nategrimwood.com' } = {}) {
  const form = new FormData();
  form.append('page', new Blob([html], { type: 'text/html' }), 'spending_charts.html');
  const headers = { origin };
  if (cookie) headers.cookie = cookie;
  return worker.fetch(new Request('https://nategrimwood.com/planning/upload', { method: 'POST', headers, body: form }), env);
}

const outsiders = [
  ['signed out', undefined],
  ['an invalid session', 'tb_session=invalid.signature'],
  ['an expired editor session', sessionCookie(editorEmail, Date.now() - 1000)],
  ['a signed-in viewer', sessionCookie(viewerEmail)],
  ['an unlisted account', sessionCookie('visitor@example.test')],
];

for (const [who, cookie] of outsiders) {
  test(`/planning sends ${who} to the tune book without the stored page`, async () => {
    const env = environment();
    env.tables.planning_page = [{ id: 1, html: planningHtml, updated_at: 'x' }];
    for (const path of ['/planning', '/planning/', '/planning/upload', '/planning/anything']) {
      const response = await page(path, cookie, env);
      assert.equal(response.status, 302, path);
      assert.equal(response.headers.get('location'), 'https://nategrimwood.com/fiddle');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(!(await response.text()).includes('private-planning'));
    }
  });
}

test('the editor gets the stored planning page, privately and with the hub', async () => {
  const env = environment();
  env.tables.planning_page = [{ id: 1, html: planningHtml, updated_at: 'x' }];
  const response = await page('/planning', sessionCookie(editorEmail, undefined, { p: '/' }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await response.text();
  assert.match(html, /private-planning-number/);
  assert.match(html, /<body><style>[^]*<nav id="site-hub"[^]*<a href="\/planning" aria-current="page">Planning<\/a>/);
});

test('before any upload the editor sees the upload form', async () => {
  const response = await page('/planning', sessionCookie());
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /No planning page has been published yet/);
  assert.match(html, /<form method="post" action="\/planning\/upload" enctype="multipart\/form-data">/);
});

test('the editor can upload the planning page, and only the editor sees it', async () => {
  const env = environment();
  const response = await upload(env, sessionCookie());
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://nategrimwood.com/planning');
  assert.equal(env.tables.planning_page[0].html, planningHtml);
  assert.match(await (await page('/planning', sessionCookie(), env)).text(), /private-planning-number/);
  for (const [, cookie] of outsiders) {
    assert.ok(!(await (await page('/planning', cookie, env)).text()).includes('private-planning'));
  }
});

test('viewers, outsiders and cross-site requests cannot upload a planning page', async () => {
  const env = environment();
  for (const [who, cookie] of outsiders) {
    const response = await upload(env, cookie);
    assert.equal(response.status, 403, who);
  }
  assert.equal((await upload(env, sessionCookie(), { origin: 'https://other.example.test' })).status, 403);
  assert.deepEqual(env.tables.planning_page, []);
});

test('an upload that is not an HTML page is refused', async () => {
  const env = environment();
  const response = await upload(env, sessionCookie(), { html: '{"not":"html"}' });
  assert.equal(response.status, 400);
  assert.deepEqual(env.tables.planning_page, []);
});

test('the planning page is never part of a backup', async () => {
  const env = environment();
  env.tables.planning_page = [{ id: 1, html: planningHtml, updated_at: 'x' }];
  const json = await (await get('export.json', sessionCookie(), env)).text();
  assert.ok(!json.includes('private-planning'));
  assert.ok(!env.statements.some(sql => /FROM planning_page/.test(sql)));
});

test('the editor gets the hub on every page, freshly fetched and never cached', async () => {
  const env = environment();
  const response = await page('/fiddle', sessionCookie(), env, { 'if-none-match': '"asset-etag"' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('etag'), null);
  assert.equal(env.assetRequests[0].headers.get('if-none-match'), null);
  const html = await response.text();
  assert.match(html, /<body class="book"><style>[^]*<nav id="site-hub"/);
  assert.match(html, /<a href="\/fiddle" aria-current="page">Fiddle<\/a><a href="\/planning">Planning<\/a><\/nav>/);
  assert.match(html, /public-asset-page/);
});

for (const [who, cookie] of outsiders) {
  test(`${who} gets the public pages unchanged, with no hub`, async () => {
    const env = environment();
    const response = await page('/fiddle', cookie, env, { 'if-none-match': '"asset-etag"' });
    assert.equal(await response.text(), assetPage);
    assert.equal(response.headers.get('etag'), '"asset-etag"');
    assert.equal(env.assetRequests[0].headers.get('if-none-match'), '"asset-etag"');
  });
}

test('the apex still redirects to the tune book', async () => {
  const response = await page('/', sessionCookie());
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://nategrimwood.com/fiddle');
});

test('an old /fiddle session moves to a site-wide cookie on the next data load', async () => {
  const cookies = (await get('data', sessionCookie())).headers.getSetCookie();
  assert.ok(cookies.some(c => /^tb_session=[^;]+\.[^;]+; Path=\/; Max-Age=34560000;/.test(c)), cookies.join('\n'));
  assert.ok(cookies.some(c => /^tb_session=; Path=\/fiddle; Max-Age=0;/.test(c)), cookies.join('\n'));
  const moved = (await get('data', sessionCookie(editorEmail, undefined, { p: '/' }))).headers.getSetCookie();
  assert.deepEqual(moved, []);
});

test('a browser holding both an old and a new session cookie is still signed in', async () => {
  const both = `tb_session=invalid.signature; ${sessionCookie(editorEmail, undefined, { p: '/' })}`;
  assert.equal((await page('/planning', both)).status, 200);
});

// Signed publishing from Nate's PC (POST /planning/publish).
const publisher = generateKeyPairSync('rsa', { modulusLength: 2048 });
const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publishKey = JSON.stringify(publisher.publicKey.export({ format: 'jwk' }));

async function publish(env, { html = planningHtml, time = Date.now(), key = publisher.privateKey, signedHtml = html, type = 'text/html' } = {}) {
  const hex = createHash('sha256').update(signedHtml).digest('hex');
  const signature = createSign('sha256').update(`planning-publish\n${time}\n${hex}`).sign(key).toString('base64url');
  return worker.fetch(new Request('https://nategrimwood.com/planning/publish', {
    method: 'POST', body: html,
    headers: { 'content-type': type, 'x-planning-time': String(time), 'x-planning-signature': signature },
  }), env);
}

function publishEnv() {
  const env = environment();
  env.PLANNING_PUBLISH_KEY = publishKey;
  return env;
}

test('the PC can publish the planning page with a valid signature, and outsiders still cannot read it', async () => {
  const env = publishEnv();
  const response = await publish(env);
  assert.equal(response.status, 204);
  assert.equal(env.tables.planning_page[0].html, planningHtml);
  assert.match(await (await page('/planning', sessionCookie(), env)).text(), /private-planning-number/);
  for (const [, cookie] of outsiders) {
    assert.ok(!(await (await page('/planning', cookie, env)).text()).includes('private-planning'));
  }
});

test('a publish signed by any other key, or for different content, is refused', async () => {
  const env = publishEnv();
  assert.equal((await publish(env, { key: stranger.privateKey })).status, 401);
  assert.equal((await publish(env, { signedHtml: '<!doctype html><p>something else</p>' })).status, 401);
  assert.deepEqual(env.tables.planning_page, []);
});

test('stale and replayed publishes are refused', async () => {
  const env = publishEnv();
  assert.equal((await publish(env, { time: Date.now() - 10 * 60000 })).status, 401);
  const time = Date.now();
  assert.equal((await publish(env, { time })).status, 204);
  assert.equal((await publish(env, { time, html: '<!doctype html><p>replayed</p>' })).status, 409);
  assert.equal((await publish(env, { time: time - 1000 })).status, 409);
  assert.equal(env.tables.planning_page[0].html, planningHtml);
});

test('publishing needs the configured key and an HTML body', async () => {
  assert.equal((await publish(environment())).status, 404);
  const env = publishEnv();
  assert.equal((await publish(env, { html: '{"not":"html"}' })).status, 400);
  assert.equal((await publish(env, { type: 'application/json' })).status, 415);
  assert.deepEqual(env.tables.planning_page, []);
});

// Saved scenarios (/planning/api/scenarios)
async function scenarioCall(env, method, id = '', body, { cookie = sessionCookie(), origin = 'https://nategrimwood.com' } = {}) {
  const headers = { origin, accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return worker.fetch(new Request(`https://nategrimwood.com/planning/api/scenarios${id ? '/' + id : ''}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
}

test('the editor can save, edit, list and delete scenarios', async () => {
  const env = environment();
  const data = { opts: { elle: { on: true, val: 2100 } }, proj: false, mode: 'all', safe: { r: 3 } };
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-1', { name: 'Elle moves in', data })).status, 200);
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-2', { name: 'Everything', data })).status, 200);
  const edited = await scenarioCall(env, 'PUT', 'scenario-1', { name: 'Elle moves in, renamed', data: { ...data, proj: true } });
  assert.equal(edited.status, 200);
  let list = await (await scenarioCall(env, 'GET')).json();
  assert.equal(list.scenarios.length, 2);
  const one = list.scenarios.find(s => s.id === 'scenario-1');
  assert.equal(one.name, 'Elle moves in, renamed');
  assert.equal(one.data.proj, true);
  assert.equal((await scenarioCall(env, 'DELETE', 'scenario-2')).status, 200);
  list = await (await scenarioCall(env, 'GET')).json();
  assert.deepEqual(list.scenarios.map(s => s.id), ['scenario-1']);
});

test('only the editor can read or change scenarios', async () => {
  const env = environment();
  env.tables.planning_scenarios = [{ id: 'scenario-1', name: 'private-scenario', data: '{"safe":{"fbN":123456}}', updated_at: 'x' }];
  for (const [who, cookie] of outsiders) {
    const read = await scenarioCall(env, 'GET', '', undefined, { cookie });
    assert.equal(read.status, 302, who);
    assert.ok(!(await read.text()).includes('private-scenario'));
    assert.equal((await scenarioCall(env, 'PUT', 'scenario-9', { name: 'x', data: {} }, { cookie })).status, 403, who);
    assert.equal((await scenarioCall(env, 'DELETE', 'scenario-1', undefined, { cookie })).status, 403, who);
  }
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-9', { name: 'x', data: {} }, { origin: 'https://other.example.test' })).status, 403);
  assert.deepEqual(env.tables.planning_scenarios.map(s => s.id), ['scenario-1']);
});

test('bad scenario names, ids and settings are refused', async () => {
  const env = environment();
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-1', { name: '  ', data: {} })).status, 400);
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-1', { name: 'x'.repeat(81), data: {} })).status, 400);
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-1', { name: 'ok', data: [] })).status, 400);
  assert.equal((await scenarioCall(env, 'PUT', 'scenario-1', { name: 'ok', data: { big: 'x'.repeat(20001) } })).status, 413);
  assert.equal((await scenarioCall(env, 'PUT', 'bad id!', { name: 'ok', data: {} })).status, 404);
  assert.deepEqual(env.tables.planning_scenarios, []);
});

test('the planning page may call its own scenarios API and nothing else', async () => {
  const env = environment();
  env.tables.planning_page = [{ id: 1, html: planningHtml, updated_at: 'x' }];
  const csp = (await page('/planning', sessionCookie(), env)).headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /default-src 'none'/);
});

test('signing out clears both the site-wide and the old /fiddle session cookie', async () => {
  const response = await write(environment(), 'POST', 'logout', {});
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(c => /^tb_session=; Path=\/; Max-Age=0;/.test(c)));
  assert.ok(cookies.some(c => /^tb_session=; Path=\/fiddle; Max-Age=0;/.test(c)));
});
