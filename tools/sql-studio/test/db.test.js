const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const spotify = loadDatasets().find(d => d.id === 'spotify');
async function studio() { return D.openStudio(await getSQL(), S.buildSchema(spotify)); }

test('runQuery returns columns and rows, even for zero rows', async () => {
  const st = await studio();
  const r = D.runQuery(st, "SELECT artist_name, genre FROM Artists WHERE genre = 'Latin'");
  assert.equal(r.ok, true);
  assert.deepEqual(r.columns, ['artist_name', 'genre']);
  assert.deepEqual(r.rows, [['Bad Bunny', 'Latin'], ['Karol G', 'Latin']]);
  const none = D.runQuery(st, "SELECT artist_name FROM Artists WHERE genre = 'Polka'");
  assert.deepEqual(none, { ok: true, columns: ['artist_name'], rows: [], truncated: false });
  D.closeStudio(st);
});

test('isReadOnly accepts SELECT, WITH, VALUES after comments', () => {
  assert.equal(D.isReadOnly('-- hi\n  select 1'), true);
  assert.equal(D.isReadOnly('WITH x AS (SELECT 1) SELECT * FROM x'), true);
  assert.equal(D.isReadOnly('VALUES (1)'), true);
  assert.equal(D.isReadOnly('DELETE FROM Artists'), false);
  assert.equal(D.isReadOnly('drop table Artists'), false);
});

test('writes are blocked with kind readonly, and data is unchanged', async () => {
  const st = await studio();
  const r = D.runQuery(st, 'DELETE FROM Artists');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'readonly');
  // A WITH ... DELETE slips past the first-word check; query_only still stops it.
  const r2 = D.runQuery(st, 'WITH x AS (SELECT 1) DELETE FROM Artists');
  assert.equal(r2.ok, false);
  assert.equal(D.runQuery(st, 'SELECT COUNT(*) FROM Artists').rows[0][0], 8);
  D.closeStudio(st);
});

test('empty or comment-only text gives kind empty', async () => {
  const st = await studio();
  assert.equal(D.runQuery(st, '  -- nothing\n').error.kind, 'empty');
  D.closeStudio(st);
});

test('SQLite errors come back with the raw message', async () => {
  const st = await studio();
  const r = D.runQuery(st, 'SELECT address FROM Artists');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'sqlite');
  assert.match(r.error.message, /no such column: address/);
  D.closeStudio(st);
});

test('runaway queries stop at the row cap and say so', async () => {
  const st = await studio();
  const r = D.runQuery(st, 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT i FROM n', { maxRows: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 1000);
  assert.equal(r.truncated, true);
  const big = D.runQuery(st, 'SELECT * FROM Streams a, Streams b, Streams c');
  assert.equal(big.rows.length, 24 ** 3);
  assert.equal(big.truncated, false);
  D.closeStudio(st);
});
