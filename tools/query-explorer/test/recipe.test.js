const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const marchByArtist = {
  start: 'Streams',
  steps: [
    { op: 'filter', column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31' },
    { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' },
    { op: 'join', table: 'Artists', leftColumn: 'artist_id', rightColumn: 'artist_id' },
    { op: 'aggregate', groupBy: ['artist_name'], summaries: [{ fn: 'total', column: 'stream_count' }] },
  ],
};

test('runRecipe returns one result per step plus the start', () => {
  const results = QE.runRecipe(MINI, marchByArtist);
  assert.equal(results.length, 5);
  assert.equal(results[0].table.name, 'Streams');
  assert.ok(results.every(r => r.status === 'ok'));
  assert.deepEqual(results[4].table.rows, [
    { artist_name: 'Bad Bunny', total_stream_count: 500 },
    { artist_name: 'SZA', total_stream_count: 400 },
  ]);
});

test('a turned-off step passes the table through unchanged', () => {
  const recipe = { start: 'Streams', steps: [{ op: 'filter', column: 'stream_count', condition: 'more_than', value: '250', on: false }] };
  const results = QE.runRecipe(MINI, recipe);
  assert.equal(results[1].status, 'off');
  assert.equal(results[1].table.rows.length, 4);
});

test('a step that needs a removed column is flagged, and later steps still run', () => {
  const recipe = {
    start: 'Streams',
    steps: [
      { op: 'project', columns: ['stream_id', 'song_id'] },
      { op: 'filter', column: 'stream_count', condition: 'more_than', value: '250' },
      { op: 'aggregate', groupBy: [], summaries: [{ fn: 'count' }] },
    ],
  };
  const results = QE.runRecipe(MINI, recipe);
  assert.equal(results[2].status, 'invalid');
  assert.match(results[2].message, /`stream_count`, which isn't in the table anymore/);
  assert.equal(results[2].table.rows.length, 4);
  assert.equal(results[3].status, 'ok');
  assert.deepEqual(results[3].table.rows, [{ number_of_rows: 4 }]);
});

test('turning off an earlier join flags the step that needed it', () => {
  const steps = JSON.parse(JSON.stringify(marchByArtist.steps));
  steps[1].on = false;
  const results = QE.runRecipe(MINI, { start: 'Streams', steps });
  assert.equal(results[2].status, 'off');
  assert.equal(results[3].status, 'invalid');
  assert.match(results[3].message, /`artist_id`/);
});

test('joining a table that is already in the result is flagged', () => {
  const results = QE.runRecipe(MINI, { start: 'Streams', steps: [{ op: 'join', table: 'Streams', cartesian: true }] });
  assert.equal(results[1].status, 'invalid');
  assert.match(results[1].message, /\*\*Streams\*\* is already part of the table/);
});

test('joining columns of different types is flagged', () => {
  const results = QE.runRecipe(MINI, { start: 'Streams', steps: [{ op: 'join', table: 'Songs', leftColumn: 'stream_date', rightColumn: 'song_id' }] });
  assert.equal(results[1].status, 'invalid');
  assert.match(results[1].message, /hold different kinds of values/);
});

test('aggregate on the wrong type of column is flagged', () => {
  const results = QE.runRecipe(MINI, { start: 'Artists', steps: [{ op: 'aggregate', groupBy: [], summaries: [{ fn: 'total', column: 'genre' }] }] });
  assert.equal(results[1].status, 'invalid');
  assert.match(results[1].message, /total of `genre`/);
});

test('incompleteReason explains what is missing', () => {
  const streams = QE.loadTable(QE.findTableDef(MINI, 'Streams'));
  const f = extra => QE.incompleteReason({ op: 'filter', column: 'stream_count', condition: 'more_than', value: '', value2: '', values: [], ...extra }, streams);
  assert.equal(QE.incompleteReason({ op: 'filter', column: '', condition: '', value: '' }, streams), 'Pick a column.');
  assert.equal(f({}), 'Pick a value.');
  assert.equal(f({ value: '1,000,000' }), 'Type a number, like 1500 (no commas).');
  assert.equal(f({ value: '1000000' }), null);
  assert.equal(f({ condition: 'between', value: '5' }), 'Fill in both values.');
  assert.equal(QE.incompleteReason({ op: 'filter', column: 'genre', condition: 'is_one_of', values: [] }, streams), 'Pick at least one value.');
  assert.equal(QE.incompleteReason({ op: 'project', columns: [] }, streams), 'Keep at least one column.');
  assert.equal(QE.incompleteReason({ op: 'join', table: '' }, streams), 'Pick a table.');
  assert.equal(QE.incompleteReason({ op: 'join', table: 'Songs', leftColumn: '', rightColumn: '' }, streams), 'Pick the columns to match.');
  assert.equal(QE.incompleteReason({ op: 'join', table: 'Songs', cartesian: true }, streams), null);
  assert.equal(QE.incompleteReason({ op: 'aggregate', groupBy: [], summaries: [] }, streams), 'Add a calculation.');
  assert.equal(QE.incompleteReason({ op: 'aggregate', groupBy: [], summaries: [{ fn: 'total', column: '' }] }, streams), 'Pick a column for each calculation.');
});

test('an incomplete saved step is flagged with its reason', () => {
  const results = QE.runRecipe(MINI, { start: 'Streams', steps: [{ op: 'project', columns: [] }] });
  assert.equal(results[1].status, 'invalid');
  assert.equal(results[1].message, 'Keep at least one column.');
});
