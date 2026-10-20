const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const N = require('../src/notation.js');
const { REPO } = require('./helpers.js');

test('every ER diagram in the book (Chapters 6, 8, 9, 10) parses with no errors', () => {
  let found = 0;
  for (const ch of ['chapter-06.md', 'chapter-08.md', 'chapter-09.md', 'chapter-10.md']) {
    const text = fs.readFileSync(path.join(REPO, ch), 'utf8');
    for (const m of text.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
      if (!/^\s*erDiagram/.test(m[1])) continue;
      found++;
      const model = N.parseErd(m[1]);
      assert.deepEqual(model.errors, [], `${ch}:\n${m[1]}`);
      assert.ok(model.relationships.length > 0, ch);
    }
  }
  assert.ok(found >= 5, `found ${found} diagrams`);
});
