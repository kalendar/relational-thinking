const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/check.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const R = (columns, rows) => ({ columns, rows });
const exp = R(['artist_name', 'total'], [['A', 10], ['B', 20.5], ['C', null]]);

test('exact match, column names do not matter', () => {
  const r = C.compareResults(R(['x', 'y'], [['A', 10], ['B', 20.5], ['C', null]]), exp);
  assert.equal(r.ok, true);
  assert.equal(r.code, 'match');
  assert.equal(r.message, 'Nice! Your result matches. 3 rows × 2 columns.');
});

test('row order is ignored unless orderMatters', () => {
  const shuffled = R(['a', 'b'], [['C', null], ['A', 10], ['B', 20.5]]);
  assert.equal(C.compareResults(shuffled, exp).ok, true);
  const r = C.compareResults(shuffled, exp, { orderMatters: true });
  assert.equal(r.code, 'order');
  assert.equal(r.message, 'You have the right rows, but not in the right order. Check your ORDER BY.');
});

test('numeric tolerance: 0.004 passes, 0.01 fails, large numbers use relative tolerance', () => {
  assert.equal(C.valuesEqual(20.5, 20.504), true);
  assert.equal(C.valuesEqual(20.5, 20.51), false);
  assert.equal(C.valuesEqual(5950000, 5950003), true);
  assert.equal(C.valuesEqual(5950000, 5951000), false);
  assert.equal(C.valuesEqual(null, 0), false);
  assert.equal(C.valuesEqual(null, null), true);
  assert.equal(C.valuesEqual('Pop', 'pop'), false);
  assert.equal(C.valuesEqual('10', 10), false);
});

test('rounded averages match unrounded ones', () => {
  const a = R(['g', 'avg'], [['Guard', 17.8333333333333]]);
  const b = R(['g', 'avg'], [['Guard', 17.83]]);
  assert.equal(C.compareResults(b, a).ok, true);
});

test('wrong column count', () => {
  const r = C.compareResults(R(['a', 'b', 'c'], [['A', 10, 1]]), exp);
  assert.equal(r.code, 'columns');
  assert.equal(r.message, 'Close! Your result has 3 columns; the expected result has 2. Check your SELECT list.');
});

test('more rows and fewer rows', () => {
  const more = C.compareResults(R(['a', 'b'], [...exp.rows, ['D', 1]]), exp);
  assert.equal(more.code, 'more-rows');
  assert.equal(more.message, 'Close! Your result has 4 rows; the expected result has 3. Check your WHERE clause, or whether you need GROUP BY.');
  const fewer = C.compareResults(R(['a', 'b'], [['A', 10]]), exp);
  assert.equal(fewer.code, 'fewer-rows');
  assert.equal(fewer.message, 'Close! Your result has 1 row; the expected result has 3. Check your WHERE conditions and your JOINs.');
});

test('same size, different values (including swapped columns)', () => {
  const swapped = C.compareResults(R(['b', 'a'], [[10, 'A'], [20.5, 'B'], [null, 'C']]), exp);
  assert.equal(swapped.code, 'values');
  assert.equal(swapped.message, 'Your result is the right size, but some values are different. Check your calculations and which columns you picked.');
});

test('duplicate rows must appear the same number of times', () => {
  const e = R(['a'], [['x'], ['x'], ['y']]);
  assert.equal(C.compareResults(R(['a'], [['x'], ['y'], ['y']]), e).code, 'values');
});

test('checkExercise runs both queries; an error comes back as code error', async () => {
  const st = D.openStudio(await getSQL(), S.buildSchema(loadDatasets().find(d => d.id === 'spotify')));
  const exercise = { answer: "SELECT song_title FROM Songs WHERE duration_sec > 240;", orderMatters: false };
  assert.equal(C.checkExercise(st, 'select SONG_TITLE from songs where duration_sec >= 241', exercise).ok, true);
  const bad = C.checkExercise(st, 'SELECT title FROM Songs', exercise);
  assert.equal(bad.code, 'error');
  assert.match(bad.error.message, /no such column/);
  assert.equal(bad.message, 'Fix the error, then check again.');
  D.closeStudio(st);
});
