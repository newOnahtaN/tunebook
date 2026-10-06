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

const tuneDefaults = {
  key: '', genre: 'Old-time', common: 0, form: '', origin: '', status: 2, source: '',
  notes: '', aka: '', genres2: '', top_media: '', high_interest: 0,
};

function environment({ schemaVersion = '9', highInterestColumn = true } = {}) {
  const tables = {
    tunes: [{ ...tuneDefaults, id: 1, name: 'Synthetic tune', notes: 'private-tune-note', aka: 'private-alias', top_media: 'ref:2' }],
    open_titles: [],
    research: [{ tune_id: 1, sources: '["https://example.test/research"]' }],
    refs: references,
    occasions: [],
    hearings: [],
    session_sources: [],
    media: [],
    media_links: [],
    edits: [],
    pop_scores: [],
    pop_evidence: [],
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
  return { DB, EDITOR_EMAILS: editorEmail, tables, meta, statements };
}

function sessionCookie(email = editorEmail, exp = Date.now() + 400 * 864e5) {
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
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
