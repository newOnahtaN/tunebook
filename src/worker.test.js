import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import test from 'node:test';
import worker from './worker.js';

const sessionKey = randomBytes(32);
const editorEmail = 'editor@example.test';
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

function environment() {
  const tables = {
    tunes: [{ id: 1, name: 'Synthetic tune', notes: 'private-tune-note', aka: 'private-alias', top_media: 'ref:2' }],
    open_titles: [],
    research: [{ tune_id: 1, sources: '["https://example.test/research"]' }],
    refs: references,
    occasions: [],
    hearings: [],
    session_sources: [],
    media: [],
    media_links: [],
  };
  const meta = new Map([
    ['seeded', 'test-fixtures'],
    ['schema_version', '8'],
    ['session_key', sessionKey.toString('base64url')],
    ['working_notes', 'private-working-note'],
  ]);
  const DB = {
    prepare(sql) {
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first(column) {
          assert.match(sql, /^SELECT v FROM meta WHERE k = /);
          const key = parameters[0] ?? sql.match(/WHERE k = '([^']+)'/)[1];
          const row = meta.has(key) ? { v: meta.get(key) } : null;
          return column ? row?.[column] ?? null : row;
        },
        async all() {
          const table = sql.match(/\bFROM (\w+)/)?.[1];
          assert.ok(Object.hasOwn(tables, table), `Unexpected read: ${sql}`);
          return { results: structuredClone(tables[table]) };
        },
        async run() {
          assert.match(sql, /^(CREATE TABLE IF NOT EXISTS|DROP TABLE IF EXISTS|INSERT OR REPLACE INTO meta \(k,v\) VALUES \('schema_version')/);
          return { success: true };
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
  };
  return { DB, EDITOR_EMAILS: editorEmail };
}

function sessionCookie(email = editorEmail, exp = Date.now() + 400 * 864e5) {
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
  const signature = createHmac('sha256', sessionKey).update(`session.${payload}`).digest('base64url');
  return `tb_session=${payload}.${signature}`;
}

async function get(path = 'data', cookie) {
  const request = new Request(`https://nategrimwood.com/fiddle/api/${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return worker.fetch(request, environment());
}

async function assertPublicData(cookie) {
  const response = await get('data', cookie);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.editor, false);
  assert.deepEqual(data.refs, references.filter(ref => ref.origin === 'research'));
  assert.deepEqual(data.research[0].sources, ['https://example.test/research']);
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

test('signed-out readers cannot download a private JSON backup', async () => {
  const response = await get('export.json');
  assert.equal(response.status, 401);
  assert.ok(!(await response.text()).includes('private-'));
});
