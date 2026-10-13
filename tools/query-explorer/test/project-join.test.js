const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const table = name => QE.loadTable(QE.findTableDef(MINI, name));
const names = t => t.columns.map(c => c.name);

test('project keeps the table column order and reports dropped columns', () => {
  const out = QE.projectTable(table('Streams'), { op: 'project', columns: ['stream_count', 'stream_id'] });
  assert.deepEqual(names(out.table), ['stream_id', 'stream_count']);
  assert.deepEqual(out.table.rows[0], { stream_id: 100, stream_count: 500 });
  assert.deepEqual(out.trace, { kept: ['stream_id', 'stream_count'], dropped: ['song_id', 'stream_date'] });
});

test('join on a same-name key shows the key once and drops rows with no match', () => {
  const out = QE.joinTable(table('Streams'), table('Songs'), { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.deepEqual(names(out.table), ['stream_id', 'song_id', 'stream_date', 'stream_count', 'song_title', 'artist_id', 'release_date']);
  assert.deepEqual(out.table.rows.map(r => r.song_title), ['DtMF', 'Kill Bill', 'DtMF', 'Kill Bill']);
  assert.deepEqual(out.table.sources, ['Streams', 'Songs']);
  assert.deepEqual(out.trace.unmatchedLeft, []);
  assert.deepEqual(out.trace.unmatchedRight, [2]);
  assert.equal(out.trace.cartesian, false);
});

test('join from the parent side drops the parent row with no children', () => {
  const out = QE.joinTable(table('Artists'), table('Songs'), { op: 'join', table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' });
  assert.deepEqual(out.table.rows.map(r => `${r.artist_name}/${r.song_title}`), ['Bad Bunny/DtMF', 'SZA/Kill Bill', 'SZA/Saturn']);
  assert.deepEqual(out.trace.pairs, [[0, 0], [1, 1], [1, 2]]);
  assert.deepEqual(out.trace.unmatchedLeft, [2]);
});

test('joining with no match condition pairs every row and prefixes clashing names', () => {
  const out = QE.joinTable(table('Songs'), table('Artists'), { op: 'join', table: 'Artists', cartesian: true });
  assert.equal(out.table.rows.length, 9);
  assert.ok(names(out.table).includes('Songs.artist_id'));
  assert.ok(names(out.table).includes('Artists.artist_id'));
  assert.ok(!names(out.table).includes('artist_id'));
  assert.equal(out.trace.cartesian, true);
});

test('joining on the wrong key finds no matches and keeps both clashing columns', () => {
  const out = QE.joinTable(table('Songs'), table('Artists'), { op: 'join', table: 'Artists', leftColumn: 'song_id', rightColumn: 'artist_id' });
  assert.equal(out.table.rows.length, 0);
  assert.ok(names(out.table).includes('Songs.artist_id'));
  assert.ok(names(out.table).includes('Artists.artist_id'));
  assert.deepEqual(out.trace.unmatchedLeft, [0, 1, 2]);
});

test('suggestJoinKey follows foreign keys in either direction', () => {
  assert.deepEqual(QE.suggestJoinKey(table('Streams'), table('Songs')), { leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.deepEqual(QE.suggestJoinKey(table('Artists'), table('Songs')), { leftColumn: 'artist_id', rightColumn: 'artist_id' });
  assert.equal(QE.suggestJoinKey(table('Streams'), table('Artists')), null);
  const joined = QE.joinTable(table('Streams'), table('Songs'), { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' }).table;
  assert.deepEqual(QE.suggestJoinKey(joined, table('Artists')), { leftColumn: 'artist_id', rightColumn: 'artist_id' });
});
