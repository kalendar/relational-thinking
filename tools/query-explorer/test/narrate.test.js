const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const N = require('../src/narrate.js');
const { MINI } = require('./fixtures.js');

function narrate(ds, startName, step) {
  const before = QE.loadTable(QE.findTableDef(ds, startName));
  const other = QE.loadTable(QE.findTableDef(ds, step.table));
  const results = QE.runRecipe(ds, { start: startName, steps: [{ ...step, op: 'join', on: true }] });
  assert.equal(results[1].status, 'ok');
  return N.joinNarration({ step: { ...step, op: 'join' }, before, other, result: results[1] });
}

const all = texts => texts.map(t => t.title + ' ' + t.body).join('\n');

test('three steps with numbered titles', () => {
  const t = narrate(MINI, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.equal(t.length, 3);
  assert.deepEqual(t.map(x => x.title), ['Join, step 1 of 3', 'Join, step 2 of 3', 'Join, step 3 of 3']);
});

test('step 1 names both tables and the shared column', () => {
  const t = narrate(MINI, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(t[0].body.includes('**Streams**') && t[0].body.includes('**Songs**'));
  assert.ok(t[0].body.includes('`song_id`'));
});

test('step 1 says "matching a to b" when the column names differ', () => {
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(t => t.name === 'Songs').columns[0].name = 'id';
  const t = narrate(ds, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'id' });
  assert.ok(t[0].body.includes('matching `song_id` to `id`'), t[0].body);
  assert.ok(t[2].body.includes('**4 rows × 8 columns**'), t[2].body);
  assert.ok(!/appears only once/.test(t[2].body), 'different names: both columns stay');
});

test('some rows dropped: counts on each side', () => {
  const t = narrate(MINI, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(t[1].body.includes('4 of 4 rows in **Streams**'), t[1].body);
  assert.ok(t[1].body.includes('2 of 3 rows in **Songs**'), t[1].body);
  assert.ok(t[1].body.includes('1 row in **Songs** found no match'), t[1].body);
  assert.ok(t[1].body.includes('That row has a dashed outline and will be dropped'), t[1].body);
  assert.ok(!t[1].body.includes('Every row found a partner'));
});

test('nothing dropped says every row found a partner', () => {
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(x => x.name === 'Songs').rows.pop();
  const t = narrate(ds, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(t[1].body.includes('Every row found a partner'), t[1].body);
  assert.ok(!t[1].body.includes('dashed outline'), t[1].body);
});

test('unmatched rows on both sides use the plural wording', () => {
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(x => x.name === 'Streams').rows.push([104, 99, '2026-05-01', 50]);
  const t = narrate(ds, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(t[1].body.includes('1 row in **Streams** found no match and 1 row in **Songs** found no match'), t[1].body);
  assert.ok(t[1].body.includes('Those rows have a dashed outline and will be dropped'), t[1].body);
});

test('one-to-many: explains why there are more rows than matched rows', () => {
  const t = narrate(MINI, 'Artists', { table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' });
  assert.ok(t[1].body.includes('2 of 3 rows in **Artists**'), t[1].body);
  assert.ok(t[2].body.includes('**3 rows × 6 columns**'), t[2].body);
  assert.ok(t[2].body.includes('Some rows in **Artists** matched more than one partner, so they appear once for each partner.'), t[2].body);
  const plain = narrate(MINI, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(/more than one partner/.test(plain[2].body), 'Streams rows share songs, so Songs rows repeat');
  assert.ok(plain[2].body.includes('Some rows in **Songs** matched more than one partner'), plain[2].body);
});

test('a clean one-to-one join has no one-to-many sentence', () => {
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(x => x.name === 'Streams').rows = [[100, 10, '2026-03-02', 500], [101, 11, '2026-03-02', 300]];
  const t = narrate(ds, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(!/more than one partner/.test(t[2].body), t[2].body);
});

test('empty table: non-cartesian says there is nothing to match', () => {
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(x => x.name === 'Streams').rows = [];
  const t = narrate(ds, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(t[1].body.includes('**Streams** has no rows, so there is nothing to match'), t[1].body);
  assert.ok(t[2].body.includes('0 rows × 7 columns'), t[2].body);
  assert.ok(!/Check the columns/.test(t[2].body), t[2].body);
});

test('empty table: cartesian join says the result is empty', () => {
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(x => x.name === 'Songs').rows = [];
  const t = narrate(ds, 'Streams', { table: 'Songs', cartesian: true });
  assert.ok(t[1].body.includes('no rows') && t[1].body.includes('empty'), t[1].body);
  assert.ok(!t[1].body.includes('meaningless'), t[1].body);
  assert.ok(t[2].body.includes('0 rows × 8 columns'), t[2].body);
});

test('step 3 states size and singular/plural', () => {
  const t = narrate(MINI, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(t[2].body.includes('**4 rows × 7 columns**'), t[2].body);
  assert.ok(t[2].body.includes('`song_id`') && /only once|once/.test(t[2].body));
  const one = narrate(MINI, 'Artists', { table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' });
  assert.ok(one[2].body.includes('3 rows × 6 columns'));
  const ds = JSON.parse(JSON.stringify(MINI));
  ds.tables.find(x => x.name === 'Streams').rows = [[100, 10, '2026-03-02', 500]];
  const single = narrate(ds, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.ok(single[2].body.includes('1 row × 7 columns'), single[2].body);
  assert.ok(single[1].body.includes('1 of 1 row in **Streams**'), single[1].body);
});

test('nothing matched: empty result and a hint about the columns', () => {
  const t = narrate(MINI, 'Streams', { table: 'Artists', leftColumn: 'song_id', rightColumn: 'artist_id' });
  assert.ok(/nothing matched/i.test(t[1].body), t[1].body);
  assert.ok(t[1].body.includes('empty'));
  assert.ok(/check the columns/i.test(t[2].body), t[2].body);
  assert.ok(t[2].body.includes('0 rows × 7 columns'), t[2].body);
});

test('cartesian join states the multiplication and calls rows meaningless', () => {
  const t = narrate(MINI, 'Streams', { table: 'Songs', cartesian: true });
  assert.ok(t[0].body.includes('every row'), t[0].body);
  assert.ok(t[1].body.includes('4 × 3 = 12 rows'), t[1].body);
  assert.ok(/meaningless/.test(t[1].body));
  assert.ok(t[2].body.includes('**12 rows × 8 columns**'), t[2].body);
  assert.ok(!/appears only once/.test(t[2].body));
});

test('no SQL words anywhere', () => {
  const variants = [
    narrate(MINI, 'Streams', { table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' }),
    narrate(MINI, 'Streams', { table: 'Artists', leftColumn: 'song_id', rightColumn: 'artist_id' }),
    narrate(MINI, 'Streams', { table: 'Songs', cartesian: true }),
  ];
  for (const v of variants) assert.ok(!/\b(select|where|from|join clause|on clause|inner|outer)\b/i.test(all(v)), all(v));
});
