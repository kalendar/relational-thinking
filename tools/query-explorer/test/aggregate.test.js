const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const streams = () => QE.loadTable(QE.findTableDef(MINI, 'Streams'));
const agg = (t, groupBy, summaries) => QE.aggregateTable(t, { op: 'aggregate', groupBy, summaries });

test('group by one column with every summary function', () => {
  const out = agg(streams(), ['song_id'], [
    { fn: 'count' },
    { fn: 'total', column: 'stream_count' },
    { fn: 'average', column: 'stream_count' },
    { fn: 'lowest', column: 'stream_date' },
    { fn: 'highest', column: 'stream_count' },
  ]);
  assert.deepEqual(out.table.columns.map(c => c.name),
    ['song_id', 'number_of_rows', 'total_stream_count', 'average_stream_count', 'lowest_stream_date', 'highest_stream_count']);
  assert.deepEqual(out.table.rows, [
    { song_id: 10, number_of_rows: 2, total_stream_count: 700, average_stream_count: 350, lowest_stream_date: '2026-03-02', highest_stream_count: 500 },
    { song_id: 11, number_of_rows: 2, total_stream_count: 400, average_stream_count: 200, lowest_stream_date: '2026-03-02', highest_stream_count: 300 },
  ]);
  assert.deepEqual(out.trace.groups, [[0, 2], [1, 3]]);
  assert.equal(QE.getColumn(out.table, 'lowest_stream_date').type, 'date');
  assert.equal(QE.getColumn(out.table, 'total_stream_count').type, 'number');
});

test('no group-by columns makes the whole table one row', () => {
  const out = agg(streams(), [], [{ fn: 'count' }, { fn: 'total', column: 'stream_count' }]);
  assert.deepEqual(out.table.rows, [{ number_of_rows: 4, total_stream_count: 1100 }]);
  assert.deepEqual(out.trace.groups, [[0, 1, 2, 3]]);
});

test('two group-by columns', () => {
  const out = agg(streams(), ['song_id', 'stream_date'], [{ fn: 'count' }]);
  assert.equal(out.table.rows.length, 4);
  assert.deepEqual(out.table.columns.map(c => c.name), ['song_id', 'stream_date', 'number_of_rows']);
});

test('averages round to 2 decimal places', () => {
  const t = { name: 'T', sources: ['T'], columns: [{ name: 'x', type: 'number', origin: 'T' }], rows: [{ x: 1 }, { x: 1 }, { x: 2 }] };
  assert.equal(agg(t, [], [{ fn: 'average', column: 'x' }]).table.rows[0].average_x, 1.33);
});

test('duplicate summary names get a number added', () => {
  const out = agg(streams(), [], [{ fn: 'total', column: 'stream_count' }, { fn: 'total', column: 'stream_count' }]);
  assert.deepEqual(out.table.columns.map(c => c.name), ['total_stream_count', 'total_stream_count_2']);
});

test('aggregating an empty table', () => {
  const empty = QE.filterTable(streams(), { op: 'filter', column: 'stream_count', condition: 'more_than', value: '9999' }).table;
  const whole = agg(empty, [], [{ fn: 'count' }, { fn: 'total', column: 'stream_count' }, { fn: 'average', column: 'stream_count' }]);
  assert.deepEqual(whole.table.rows, [{ number_of_rows: 0, total_stream_count: 0, average_stream_count: null }]);
  assert.deepEqual(whole.trace.groups, [[]]);
  const grouped = agg(empty, ['song_id'], [{ fn: 'count' }]);
  assert.deepEqual(grouped.table.rows, []);
});
