const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const table = name => QE.loadTable(QE.findTableDef(MINI, name));
const col = (t, name) => t.rows.map(r => r[name]);
const run = (name, step) => QE.filterTable(table(name), { op: 'filter', ...step });

test('loadTable turns positional rows into objects and records origin', () => {
  const t = table('Streams');
  assert.equal(t.name, 'Streams');
  assert.deepEqual(t.sources, ['Streams']);
  assert.deepEqual(t.rows[0], { stream_id: 100, song_id: 10, stream_date: '2026-03-02', stream_count: 500 });
  assert.equal(t.columns[1].origin, 'Streams');
  assert.equal(QE.getColumn(t, 'song_id').key, 'fk');
  assert.equal(QE.getColumn(t, 'nope'), null);
});

test('number conditions', () => {
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'is', value: '200' }).table, 'stream_id'), [102]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'is_not', value: '200' }).table, 'stream_id'), [100, 101, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'more_than', value: '250' }).table, 'stream_id'), [100, 101]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'less_than', value: '300' }).table, 'stream_id'), [102, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'at_least', value: '300' }).table, 'stream_id'), [100, 101]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'at_most', value: '200' }).table, 'stream_id'), [102, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'between', value: '100', value2: '300' }).table, 'stream_id'), [101, 102, 103]);
});

test('between works when the values are entered high-then-low', () => {
  const a = run('Streams', { column: 'stream_count', condition: 'between', value: '300', value2: '100' });
  assert.deepEqual(col(a.table, 'stream_id'), [101, 102, 103]);
  const d = run('Streams', { column: 'stream_date', condition: 'between', value: '2026-03-31', value2: '2026-03-01' });
  assert.deepEqual(col(d.table, 'stream_id'), [100, 101, 103]);
});

test('date conditions', () => {
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'on', value: '2026-03-02' }).table, 'stream_id'), [100, 101]);
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'before', value: '2026-03-02' }).table, 'stream_id'), []);
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'after', value: '2026-03-02' }).table, 'stream_id'), [102, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31' }).table, 'stream_id'), [100, 101, 103]);
});

test('text conditions ignore case and surrounding spaces', () => {
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is', value: 'latin' }).table, 'artist_name'), ['Bad Bunny']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is', value: ' Latin ' }).table, 'artist_name'), ['Bad Bunny']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is_not', value: 'LATIN' }).table, 'artist_name'), ['SZA', 'Doechii']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is_one_of', values: ['r&b', 'Hip-Hop'] }).table, 'artist_name'), ['SZA', 'Doechii']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'contains', value: 'HOP' }).table, 'artist_name'), ['Doechii']);
});

test('filter keeps columns, reports kept and dropped rows, and leaves the input alone', () => {
  const input = table('Streams');
  const out = QE.filterTable(input, { op: 'filter', column: 'stream_count', condition: 'more_than', value: '250' });
  assert.deepEqual(out.table.columns, input.columns);
  assert.deepEqual(out.trace, { kept: [0, 1], dropped: [2, 3] });
  assert.equal(input.rows.length, 4);
});
