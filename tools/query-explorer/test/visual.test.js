const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const V = require('../src/visual.js');
const { MINI } = require('./fixtures.js');

const table = name => QE.loadTable(QE.findTableDef(MINI, name));

test('filter plan marks kept and dropped rows', () => {
  const step = { op: 'filter', column: 'stream_count', condition: 'more_than', value: '250' };
  const before = table('Streams');
  const plan = V.visualPlan(step, before, QE.filterTable(before, step), null);
  assert.deepEqual(plan.beforeRows, ['keep', 'keep', 'drop', 'drop']);
  assert.deepEqual(plan.afterRows, ['keep', 'keep']);
});

test('project plan lists dropped columns', () => {
  const step = { op: 'project', columns: ['stream_id'] };
  const before = table('Streams');
  const plan = V.visualPlan(step, before, QE.projectTable(before, step), null);
  assert.deepEqual(plan.dropped, ['song_id', 'stream_date', 'stream_count']);
});

test('join plan gives matching rows the same id and marks unmatched rows', () => {
  const step = { op: 'join', table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' };
  const before = table('Artists');
  const other = table('Songs');
  const plan = V.visualPlan(step, before, QE.joinTable(before, other, step), other);
  assert.deepEqual(plan.leftMatch, [0, 1, null]);
  assert.deepEqual(plan.rightMatch, [0, 1, 1]);
  assert.deepEqual(plan.afterRows, ['c0', 'c1', 'c1']);
});

test('cartesian join plan has no matches to show', () => {
  const step = { op: 'join', table: 'Artists', cartesian: true };
  const before = table('Songs');
  const other = table('Artists');
  const plan = V.visualPlan(step, before, QE.joinTable(before, other, step), other);
  assert.equal(plan.cartesian, true);
  assert.deepEqual(plan.leftMatch, [null, null, null]);
});

test('aggregate plan orders rows by group and labels groups', () => {
  const step = { op: 'aggregate', groupBy: ['song_id'], summaries: [{ fn: 'count' }] };
  const before = table('Streams');
  const plan = V.visualPlan(step, before, QE.aggregateTable(before, step), null);
  assert.deepEqual(plan.order, [0, 2, 1, 3]);
  assert.deepEqual(plan.rowGroup, [0, 1, 0, 1]);
  assert.deepEqual(plan.labels, ['10', '11']);
  assert.deepEqual(plan.afterRows, ['c0', 'c1']);
  const whole = V.visualPlan({ ...step, groupBy: [] }, before, QE.aggregateTable(before, { ...step, groupBy: [] }), null);
  assert.deepEqual(whole.labels, ['All rows']);
});

test('colorClass cycles through 5 colors', () => {
  assert.equal(V.colorClass(0), 'c0');
  assert.equal(V.colorClass(6), 'c1');
  assert.equal(V.colorClass(null), null);
});
