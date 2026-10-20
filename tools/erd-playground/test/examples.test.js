const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { EXAMPLES } = require('../src/examples.js');
const N = require('../src/notation.js');
const { REPO } = require('./helpers.js');

const IDS = ['artist-song', 'five-patterns', 'music-streaming', 'campus-concert', 'many-to-many', 'basketball', 'dining', 'netflix', 'fantasy', 'self'];

test('ten examples, in order, with titles and one-sentence descriptions', () => {
  assert.deepEqual(EXAMPLES.map(e => e.id), IDS);
  for (const e of EXAMPLES) {
    assert.ok(e.title.length > 3, e.id);
    assert.match(e.description, /^[A-Z].*\.$/, e.id);
    assert.ok(e.text.startsWith('erDiagram\n'), e.id);
  }
});

test('every example parses cleanly: no errors, no notes (so each is valid Mermaid)', () => {
  for (const e of EXAMPLES) {
    const m = N.parseErd(e.text);
    assert.deepEqual(m.errors, [], e.id);
    assert.deepEqual(m.notes, [], e.id);
  }
});

test('relationship counts', () => {
  assert.deepEqual(EXAMPLES.map(e => N.parseErd(e.text).relationships.length), [1, 5, 3, 7, 3, 2, 2, 3, 4, 1]);
});

test('the five patterns cover every right-side end; the self example relates an entity to itself', () => {
  const ends = new Set(N.parseErd(EXAMPLES[1].text).relationships.map(r => r.bEnd));
  assert.deepEqual([...ends].sort(), ['one', 'one-many', 'zero-many', 'zero-one']);
  const self = N.parseErd(EXAMPLES[9].text).relationships[0];
  assert.equal(self.a, self.b);
});

test('the first four examples come straight from the book', () => {
  const book = ['chapter-06.md', 'chapter-08.md'].map(f => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');
  for (const e of EXAMPLES.slice(0, 4)) {
    for (const line of e.text.split('\n').filter(l => /--|\.\./.test(l))) assert.ok(book.includes(line.trim()), `${e.id}: ${line.trim()}`);
  }
});

test('examples 6–9 have attribute blocks with 2–4 attributes per entity', () => {
  for (const e of EXAMPLES.slice(5, 9)) {
    for (const ent of N.parseErd(e.text).entities) {
      assert.ok(ent.attributes.length >= 2 && ent.attributes.length <= 4, `${e.id}: ${ent.name}`);
    }
  }
});
