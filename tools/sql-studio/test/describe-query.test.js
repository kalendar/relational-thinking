const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../src/randomq.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadAllDatasets } = require('./helpers.js');

const col = (name, type = 'text') => ({ name, type });

test('a plain list with a filter, sort, and limit', () => {
  const q = Q.describeQuery({
    start: 'Streams', joined: ['Songs', 'Artists'], distinct: false, aggregate: false, group: null,
    items: [{ kind: 'col', col: col('artist_name') }, { kind: 'col', col: col('stream_count', 'number') }],
    where: { joiner: 'AND', conds: [{ col: col('stream_date', 'date'), op: 'between', values: ['2026-03-05', '2026-03-12'] }, { col: col('genre'), op: 'in', values: ['Pop', 'R&B'] }] },
    having: null, order: { item: 1, desc: true }, limit: 5,
  });
  assert.equal(q, 'For each row of Streams (with its matching Songs and Artists rows), show artist_name and stream_count. '
    + 'Only include rows where stream_date is between 2026-03-05 and 2026-03-12 and genre is Pop or R&B. '
    + 'Sort by stream_count, highest first. Show only the first 5 rows.');
});

test('a grouped summary with HAVING', () => {
  const q = Q.describeQuery({
    start: 'Stream', joined: ['Song', 'Artist'], distinct: false, aggregate: true, group: col('genre'),
    items: [{ kind: 'col', col: col('genre') }, { kind: 'agg', fn: 'SUM', col: col('seconds_listened', 'number') }, { kind: 'agg', fn: 'COUNT' }],
    where: { joiner: 'OR', conds: [{ col: col('hometown'), op: 'isnull', values: [] }, { col: col('explicit', 'boolean'), op: 'bool', values: [1] }] },
    having: { item: 1, value: 600 }, order: { item: 0, desc: false }, limit: null,
  });
  assert.equal(q, 'Using Stream (with its matching Song and Artist rows), for each genre show the total of seconds_listened and the number of rows. '
    + 'Only count rows where hometown is missing (NULL) or explicit is true. '
    + 'Keep only groups where the total of seconds_listened is at least 600. '
    + 'Sort by genre, A to Z.');
});

test('DISTINCT, LIKE, dates, and a whole-table summary', () => {
  assert.equal(Q.describeQuery({
    start: 'Artists', joined: [], distinct: true, aggregate: false, group: null,
    items: [{ kind: 'col', col: col('genre') }],
    where: { joiner: 'AND', conds: [{ col: col('artist_name'), op: 'starts', values: ['Ta'] }] },
    having: null, order: null, limit: null,
  }), "List each different genre once, from Artists. Only include rows where artist_name starts with 'Ta'.");
  assert.equal(Q.describeQuery({
    start: 'Songs', joined: [], distinct: false, aggregate: true, group: null,
    items: [{ kind: 'agg', fn: 'AVG', col: col('duration_sec', 'number') }, { kind: 'agg', fn: 'COUNTD', col: col('genre') }],
    where: { joiner: 'AND', conds: [{ col: col('release_date', 'date'), op: 'ge', values: ['2024-01-01'] }] },
    having: null, order: { item: 0, desc: true }, limit: null,
  }), 'Using all of Songs, show the average duration_sec and the number of different genre values. '
    + 'Only count rows where release_date is on or after 2024-01-01. Sort by the average duration_sec, highest first.');
});

test('a true/false group reads naturally', () => {
  assert.equal(Q.describeQuery({ start: 'Song', joined: [], distinct: false, aggregate: true, group: col('explicit', 'boolean'),
    items: [{ kind: 'col', col: col('explicit', 'boolean') }, { kind: 'agg', fn: 'COUNT' }], where: null, having: null, order: null, limit: null }),
  'Using Song, for each explicit value (true or false) show the number of rows.');
});

test('every random query on every data set comes with a question that names its columns', async () => {
  const SQL = await getSQL();
  for (const d of loadAllDatasets()) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    const run = sql => D.runQuery(st, sql);
    for (let i = 0; i < 60; i++) {
      const options = Object.fromEntries(Q.FEATURES.map(f => [f, Q.mulberry32(i + 5)() < 0.6]));
      const g = Q.generateQuery({ schema: st.schema, run, options, seed: 777 + i });
      assert.ok(g.question && g.question.endsWith('.'), `${d.id}: ${g.sql}`);
      for (const m of g.sql.matchAll(/WHERE (?:\w+\.)?(\w+)/g)) assert.ok(g.question.includes(m[1]), `${m[1]} missing from: ${g.question}\n${g.sql}`);
    }
    D.closeStudio(st);
  }
});
