const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/readings.js');
const N = require('../src/notation.js');

const rel = text => N.parseErd(text).relationships[0];

test('the cardinality words are exactly 6.1\'s', () => {
  assert.deepEqual(R.MEANING, { one: 'one and only one', 'zero-one': 'zero or one', 'one-many': 'one or more', 'zero-many': 'zero or more' });
});

test("6.1's example, read both ways", () => {
  assert.deepEqual(R.readRelationship(rel('ARTIST ||--o{ SONG : "records"')), [
    'An ARTIST is associated with **zero or more** SONGs.',
    'A SONG is associated with **one and only one** ARTIST.',
  ]);
});

test('all 16 combinations: sentence 1 uses the end next to B, sentence 2 the end next to A', () => {
  const many = k => k === 'one-many' || k === 'zero-many';
  for (const [l, lk] of Object.entries(N.END_KINDS.left)) {
    for (const [r, rk] of Object.entries(N.END_KINDS.right)) {
      const [s1, s2] = R.readRelationship(rel(`TEAM ${l}--${r} PLAYER : x`));
      assert.equal(s1, `A TEAM is associated with **${R.MEANING[rk]}** ${many(rk) ? 'PLAYERs' : 'PLAYER'}.`);
      assert.equal(s2, `A PLAYER is associated with **${R.MEANING[lk]}** ${many(lk) ? 'TEAMs' : 'TEAM'}.`);
    }
  }
});

test('plurals and articles', () => {
  assert.equal(R.readRelationship(rel('USER ||--o{ STATUS : x'))[0], 'A USER is associated with **zero or more** STATUSes.');
  assert.equal(R.readRelationship(rel('EVENT ||--o{ BOX : x'))[0], 'An EVENT is associated with **zero or more** BOXes.');
  assert.equal(R.readRelationship(rel('ORDER ||--o{ ITEM : x'))[0], 'An ORDER is associated with **zero or more** ITEMs.');
  assert.equal(R.readRelationship(rel('IDEA ||--|{ MATCH : x'))[0], 'An IDEA is associated with **one or more** MATCHes.');
});

test('the label never appears in the sentences', () => {
  for (const s of R.readRelationship(rel('ARTIST ||--o{ SONG : "records"'))) assert.ok(!s.includes('records'));
});

test('aliases read by their display names; names keep their own case', () => {
  const m = N.parseErd('p["Person"] ||--o{ CAR : owns');
  const display = n => m.entities.find(e => e.name === n).display;
  assert.equal(R.readRelationship(m.relationships[0], display)[1], 'A CAR is associated with **one and only one** Person.');
  assert.deepEqual(R.readRelationship(rel('Artist ||--o{ ARTIST : x')), [
    'An Artist is associated with **zero or more** ARTISTs.',
    'An ARTIST is associated with **one and only one** Artist.',
  ]);
});
