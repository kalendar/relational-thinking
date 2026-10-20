const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const datasets = loadDatasets();
const byId = id => datasets.find(d => d.id === id);

test('all ten data sets are found in the Query Explorer folder', () => {
  assert.equal(datasets.length, 10);
  assert.deepEqual(datasets.map(d => d.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('types: whole numbers INTEGER, decimals REAL, text and dates TEXT', () => {
  const fantasy = S.buildSchema(byId('fantasy'));
  const wp = fantasy.tables.find(t => t.name === 'WeeklyPoints');
  const col = n => wp.columns.find(c => c.name === n);
  assert.equal(col('fantasy_points').sqlType, 'REAL');
  assert.equal(col('week').sqlType, 'INTEGER');
  assert.equal(col('game_date').sqlType, 'TEXT');
  assert.equal(col('game_date').type, 'date');
});

test('keys: pk flag, fk points at the referenced table primary key', () => {
  const s = S.buildSchema(byId('spotify'));
  const songs = s.tables.find(t => t.name === 'Songs');
  assert.equal(songs.columns[0].pk, true);
  assert.deepEqual(songs.columns.find(c => c.name === 'artist_id').fk, { table: 'Artists', column: 'artist_id' });
  assert.deepEqual(s.relationships, [
    { from: { table: 'Songs', column: 'artist_id' }, to: { table: 'Artists', column: 'artist_id' } },
    { from: { table: 'Streams', column: 'song_id' }, to: { table: 'Songs', column: 'song_id' } },
  ]);
});

test('relationship count equals the number of fk columns, for every data set', () => {
  for (const d of datasets) {
    const fks = d.tables.flatMap(t => t.columns.filter(c => c.key === 'fk')).length;
    assert.equal(S.buildSchema(d).relationships.length, fks, d.id);
  }
});

test('createStatements puts parent tables before children and uses PRIMARY KEY / REFERENCES', () => {
  const ddl = S.createStatements(S.buildSchema(byId('spotify')));
  const order = ddl.map(s => /CREATE TABLE "(\w+)"/.exec(s)[1]);
  assert.ok(order.indexOf('Artists') < order.indexOf('Songs'));
  assert.ok(order.indexOf('Songs') < order.indexOf('Streams'));
  assert.match(ddl.find(s => s.includes('"Songs"')), /"artist_id" INTEGER REFERENCES "Artists"\("artist_id"\)/);
  assert.match(ddl.find(s => s.includes('"Songs"')), /"song_id" INTEGER PRIMARY KEY/);
});

test('quoteIdent doubles quotes', () => {
  assert.equal(S.quoteIdent('a"b'), '"a""b"');
});

test('every data set loads with matching row counts, valid foreign keys, and working date BETWEEN', async () => {
  const SQL = await getSQL();
  for (const d of datasets) {
    const schema = S.buildSchema(d);
    const db = new SQL.Database();
    S.loadSchema(db, schema);
    for (const t of schema.tables) {
      const n = db.exec(`SELECT COUNT(*) FROM ${S.quoteIdent(t.name)}`)[0].values[0][0];
      assert.equal(n, t.rows.length, `${d.id}.${t.name}`);
    }
    const bad = db.exec('PRAGMA foreign_key_check');
    assert.equal(bad.length, 0, `${d.id} foreign keys`);
    const dateCol = schema.tables.flatMap(t => t.columns.filter(c => c.type === 'date').map(c => [t, c]))[0];
    const [t, c] = dateCol;
    const n = db.exec(`SELECT COUNT(*) FROM ${S.quoteIdent(t.name)} WHERE ${S.quoteIdent(c.name)} BETWEEN '2000-01-01' AND '2099-12-31'`)[0].values[0][0];
    assert.equal(n, t.rows.length, `${d.id} dates`);
    db.close();
  }
});
