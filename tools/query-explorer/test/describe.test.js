const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const D = require('../src/describe.js');
const { MINI } = require('./fixtures.js');

const table = name => QE.loadTable(QE.findTableDef(MINI, name));

test('formatValue', () => {
  assert.equal(D.formatValue(1250000, { type: 'number' }), '1,250,000');
  assert.equal(D.formatValue(2.5, { type: 'number' }), '2.5');
  assert.equal(D.formatValue(1001, { type: 'number', key: 'pk' }), '1001');
  assert.equal(D.formatValue(2016, { type: 'number', plain: true }), '2016');
  assert.equal(D.formatValue('2026-03-02', { type: 'date' }), 'Mar 2, 2026');
  assert.equal(D.formatValue('Hip-Hop', { type: 'text' }), 'Hip-Hop');
  assert.equal(D.formatValue(null, { type: 'number' }), '—');
});

test('filter sentences', () => {
  assert.equal(D.describeStep({ op: 'filter', column: 'genre', condition: 'is', value: 'Hip-Hop' }, table('Artists')),
    'Keep only rows where `genre` is **Hip-Hop**');
  assert.equal(D.describeStep({ op: 'filter', column: 'stream_count', condition: 'more_than', value: '1000000' }, table('Streams')),
    'Keep only rows where `stream_count` is more than **1,000,000**');
  assert.equal(D.describeStep({ op: 'filter', column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31' }, table('Streams')),
    'Keep only rows where `stream_date` is between **Mar 1, 2026** and **Mar 31, 2026**');
  assert.equal(D.describeStep({ op: 'filter', column: 'genre', condition: 'is_one_of', values: ['Latin', 'R&B'] }, table('Artists')),
    'Keep only rows where `genre` is one of **Latin**, **R&B**');
});

test('project, join, and aggregate sentences', () => {
  assert.equal(D.describeStep({ op: 'project', columns: ['artist_name', 'total_streams'] }, null),
    'Keep only the columns `artist_name`, `total_streams`');
  assert.equal(D.describeStep({ op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' }, null),
    'Combine with **Songs**, matching `song_id`');
  assert.equal(D.describeStep({ op: 'join', table: 'Artists', leftColumn: 'song_id', rightColumn: 'artist_id' }, null),
    'Combine with **Artists**, matching `song_id` to `artist_id`');
  assert.equal(D.describeStep({ op: 'join', table: 'Artists', cartesian: true }, null),
    'Combine every row with every row of **Artists**');
  assert.equal(D.describeStep({ op: 'aggregate', groupBy: ['artist_name'], summaries: [{ fn: 'total', column: 'stream_count' }] }, null),
    'Group by `artist_name` and calculate the total of `stream_count`');
  assert.equal(D.describeStep({ op: 'aggregate', groupBy: [], summaries: [{ fn: 'count' }, { fn: 'average', column: 'x' }] }, null),
    'For the whole table, calculate the count of rows and the average of `x`');
  assert.equal(D.describeStep({ op: 'aggregate', groupBy: ['a', 'b'], summaries: [{ fn: 'count' }, { fn: 'lowest', column: 'x' }, { fn: 'highest', column: 'x' }] }, null),
    'Group by `a` and `b` and calculate the count of rows, the lowest of `x`, and the highest of `x`');
});

test('describeRecipe starts with the start table', () => {
  const lines = D.describeRecipe(MINI, { start: 'Streams', steps: [{ op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' }] });
  assert.deepEqual(lines, ['Start with **Streams**', 'Combine with **Songs**, matching `song_id`']);
});

test('parseRich splits bold and code', () => {
  assert.deepEqual(D.parseRich('Keep `a` and **B** now'), [
    { kind: 'text', text: 'Keep ' },
    { kind: 'code', text: 'a' },
    { kind: 'text', text: ' and ' },
    { kind: 'strong', text: 'B' },
    { kind: 'text', text: ' now' },
  ]);
  assert.deepEqual(D.parseRich('plain'), [{ kind: 'text', text: 'plain' }]);
});
