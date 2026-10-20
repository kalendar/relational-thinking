const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/notation.js');

const LABEL_NOTE = 'A line without a label works here. To use it in Mermaid or an AI tool, add a label, like `: "records"`.';
const HEADER_NOTE = 'Add `erDiagram` as the first line to use this in Mermaid.';
const one = text => N.parseErd(text);

test("6.1's first example", () => {
  const m = one('ARTIST ||--o{ SONG : "records"');
  assert.deepEqual(m.errors, []);
  assert.equal(m.hasHeader, false);
  assert.deepEqual(m.entities.map(e => e.name), ['ARTIST', 'SONG']);
  assert.equal(m.relationships.length, 1);
  const r = m.relationships[0];
  assert.deepEqual({ a: r.a, b: r.b, aEnd: r.aEnd, bEnd: r.bEnd, dashed: r.dashed, label: r.label, line: r.line },
    { a: 'ARTIST', b: 'SONG', aEnd: 'one', bEnd: 'zero-many', dashed: false, label: 'records', line: 1 });
  assert.deepEqual(r.aSym, { line: 1, col: 8, length: 2 });
  assert.deepEqual(r.bSym, { line: 1, col: 12, length: 2 });
});

test('all 16 end pairs map through END_KINDS', () => {
  for (const [l, lk] of Object.entries(N.END_KINDS.left)) {
    for (const [r, rk] of Object.entries(N.END_KINDS.right)) {
      const rel = one(`A ${l}--${r} B : x`).relationships[0];
      assert.equal(rel.aEnd, lk, `${l}--${r}`);
      assert.equal(rel.bEnd, rk, `${l}--${r}`);
    }
  }
  assert.deepEqual(N.END_KINDS.left, { '||': 'one', '|o': 'zero-one', '}|': 'one-many', '}o': 'zero-many' });
  assert.deepEqual(N.END_KINDS.right, { '||': 'one', 'o|': 'zero-one', '|{': 'one-many', 'o{': 'zero-many' });
});

test('dashed lines and unquoted labels', () => {
  assert.equal(one('A ||..o{ B : x').relationships[0].dashed, true);
  assert.equal(one('A ||--o{ B : records').relationships[0].label, 'records');
});

test('a missing label works, with one gentle note', () => {
  const m = one('ARTIST ||--o{ SONG\nSONG ||--o{ STREAM');
  assert.deepEqual(m.errors, []);
  assert.equal(m.relationships[0].label, '');
  assert.equal(m.notes.filter(n => n === LABEL_NOTE).length, 1);
});

test('the erDiagram header', () => {
  const withHeader = one('erDiagram\n    ARTIST ||--o{ SONG : "records"');
  assert.equal(withHeader.hasHeader, true);
  assert.ok(!withHeader.notes.includes(HEADER_NOTE));
  assert.equal(withHeader.relationships[0].line, 2);
  assert.ok(one('A ||--o{ B : x').notes.includes(HEADER_NOTE));
});

test('attribute blocks, keys, comments, and types with brackets', () => {
  const m = one([
    'erDiagram',
    '    ARTIST {',
    '        int artist_id PK',
    '        string hometown',
    '        int label_id FK "points at Label"',
    '        varchar(255) name',
    '        string[] tags',
    '        int code PK, UK',
    '    }',
  ].join('\n'));
  assert.deepEqual(m.errors, []);
  const a = m.entities[0].attributes;
  assert.deepEqual(a.map(x => x.name), ['artist_id', 'hometown', 'label_id', 'name', 'tags', 'code']);
  assert.deepEqual(a.map(x => x.keys), [['PK'], [], ['FK'], [], [], ['PK', 'UK']]);
  assert.equal(a[2].comment, 'points at Label');
  assert.deepEqual(a.map(x => x.type), ['int', 'string', 'int', 'varchar(255)', 'string[]', 'int']);
});

test('an entity can stand alone', () => {
  const m = one('erDiagram\n  GENRE\n  ARTIST ||--o{ SONG : records');
  assert.deepEqual(m.entities.map(e => e.name), ['GENRE', 'ARTIST', 'SONG']);
  assert.deepEqual(m.errors, []);
});

test('comments and blank lines are skipped', () => {
  const m = one('erDiagram\n\n  %% the first example\n  ARTIST ||--o{ SONG : records\n');
  assert.deepEqual(m.errors, []);
  assert.equal(m.relationships.length, 1);
});

test('plain-words errors, with line and column', () => {
  const err = t => one(t).errors[0];
  assert.deepEqual(err('A ||--o B : x'), { line: 1, col: 3, length: 5, message: 'Line 1: `||--o` is missing its last symbol. Line ends are `||`, `o|`, `|{`, or `o{`.' });
  assert.equal(err('A |--o{ B : x').message, 'Line 1: `|--o{` is missing its first symbol. Line ends are `||`, `o|`, `|{`, or `o{`.');
  assert.equal(err('A ||->o{ B : x').message, 'Line 1: `||->o{` isn\'t a relationship symbol. Line ends are `||`, `o|`, `|{`, or `o{`, with `--` in the middle.');
  assert.equal(err('A ||--o{ B records here').message, 'Line 1: Put a `:` before the label.');
  assert.equal(err('A ||--o{ : x').message, 'Line 1: This relationship needs an entity on each side.');
  assert.equal(err('ARTIST {\n  int id PK').message, 'Line 1: This attribute block is missing its closing `}`.');
  assert.equal(err('this is not right').message, "Line 1: This line isn't a relationship, an entity, or an attribute block.");
  assert.equal(one('erDiagram\n  A ||--o{ B : x\n  A ||--o B : y').errors[0].line, 3);
});

test('an unclosed block at the very end points at its opening line (Review Focus 2)', () => {
  const m = one('erDiagram\n  A ||--o{ B : x\n  B {\n    int id PK\n    string name');
  assert.equal(m.errors.length, 1);
  assert.equal(m.errors[0].line, 3);
});

test('pasted text: CRLF, tabs, trailing spaces, and non-breaking spaces parse the same (Review Focus 1)', () => {
  const clean = 'erDiagram\n    ARTIST ||--o{ SONG : "records"\n    ARTIST {\n        int artist_id PK\n    }';
  const messy = 'erDiagram  \r\n\tARTIST ||--o{ SONG : "records"   \r\n\r\n\tARTIST {\r\n\t\tint artist_id PK \r\n\t}\r\n';
  const a = one(clean);
  const b = one(messy);
  assert.deepEqual(b.errors, []);
  assert.deepEqual(b.entities, a.entities);
  assert.deepEqual(b.relationships.map(r => [r.a, r.b, r.aEnd, r.bEnd, r.label]), a.relationships.map(r => [r.a, r.b, r.aEnd, r.bEnd, r.label]));
});

test('names that differ only in case are two entities (Review Focus 5)', () => {
  assert.deepEqual(one('Artist ||--o{ ARTIST : x').entities.map(e => e.name), ['Artist', 'ARTIST']);
});

test('a 300-line paste parses quickly (Review Focus 4)', () => {
  const text = Array.from({ length: 300 }, (_, i) => `E${i} ||--o{ E${i + 1} : x`).join('\n');
  const t0 = performance.now();
  const m = one(text);
  const ms = performance.now() - t0;
  assert.equal(m.relationships.length, 300);
  assert.ok(ms < 50, `${ms.toFixed(1)} ms`);
});

test('parseErd never throws', () => {
  for (const t of ['', '{', '}', '"', 'A ||--o{ "B', ':', 'erDiagram erDiagram', '%%', 'A {}', 'A { }', '\u0000']) assert.doesNotThrow(() => one(t), t);
});

// ---- Task 3: Mermaid that goes beyond Chapter 6 ----

test("Mermaid's word cardinalities, with `to` and `optionally to`", () => {
  const r = one('CUSTOMER one or more to zero or many ORDER : places').relationships[0];
  assert.deepEqual([r.a, r.b, r.aEnd, r.bEnd, r.dashed, r.label], ['CUSTOMER', 'ORDER', 'one-many', 'zero-many', false, 'places']);
  assert.equal(one('A only one optionally to zero or one B : x').relationships[0].dashed, true);
  const words = {
    'only one': 'one', 1: 'one', 'zero or one': 'zero-one', 'one or zero': 'zero-one',
    'one or more': 'one-many', 'one or many': 'one-many', 'many(1)': 'one-many', '1+': 'one-many',
    'zero or more': 'zero-many', 'zero or many': 'zero-many', 'many(0)': 'zero-many', '0+': 'zero-many',
  };
  for (const [w, kind] of Object.entries(words)) {
    const rel = one(`A ${w} to ${w} B : x`).relationships[0];
    assert.ok(rel, w);
    assert.equal(rel.aEnd, kind, w);
    assert.equal(rel.bEnd, kind, w);
  }
});

test('aliases and quoted names', () => {
  const m = one('p["Person"] ||--o{ CAR : owns');
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.entities.map(e => [e.name, e.display]), [['p', 'Person'], ['CAR', 'CAR']]);
  const q = one('"Big Box" ||--o{ ITEM : holds');
  assert.deepEqual(q.errors, []);
  assert.deepEqual(q.entities.map(e => e.name), ['Big Box', 'ITEM']);
});

test('styling lines are accepted and ignored', () => {
  const m = one('erDiagram\n  direction LR\n  A ||--o{ B : x\n  style A fill:#f00\n  classDef hot fill:#fff\n  class A hot');
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.entities.map(e => e.name), ['A', 'B']);
});

test('a left end written the right-side way gets a mirroring message', () => {
  assert.equal(one('A o{--|| B : x').errors[0].message, 'Line 1: On the left side the symbols are mirrored: write `}o` instead of `o{`.');
  assert.equal(one('A |{--|| B : x').errors[0].message, 'Line 1: On the left side the symbols are mirrored: write `}|` instead of `|{`.');
  assert.equal(one('A o|--|| B : x').errors[0].message, 'Line 1: On the left side the symbols are mirrored: write `|o` instead of `o|`.');
});

// ---- review fixes ----

test('a missing } in the middle points at the block that was left open, and the next lines still parse', () => {
  const a = one('erDiagram\n  ARTIST {\n    int artist_id PK\n  ARTIST ||--o{ SONG : "records"');
  assert.equal(a.errors[0].line, 2);
  assert.equal(a.errors[0].message, 'Line 2: This attribute block is missing its closing `}`.');
  assert.equal(a.relationships.length, 1, 'the relationship after it is still read');
  const b = one('erDiagram\n  ARTIST {\n    int artist_id PK\n  SONG {\n    int song_id PK\n  }');
  assert.equal(b.errors.length, 1);
  assert.equal(b.errors[0].line, 2);
  assert.deepEqual(b.entities.map(e => [e.name, e.attributes.length]), [['ARTIST', 1], ['SONG', 1]]);
});

test('curly quotes from a word processor work like straight quotes', () => {
  const m = one('erDiagram\n  “Big Box” ||--o{ SONG : “records”\n  SONG {\n    int id PK “the id”\n  }');
  assert.deepEqual(m.errors, []);
  assert.equal(m.relationships[0].label, 'records');
  assert.equal(m.entities[0].name, 'Big Box');
  assert.equal(m.entities[1].attributes[0].comment, 'the id');
});

test('a long dash in the middle of a symbol gets a clear message', () => {
  assert.equal(one('A ||–o{ B : x').errors[0].message, 'Line 1: Use two hyphens `--` in the middle, not a long dash.');
  assert.equal(one('A ||—o{ B : x').errors[0].message, 'Line 1: Use two hyphens `--` in the middle, not a long dash.');
});

test('an empty label after the colon works here, with a note (Mermaid rejects it)', () => {
  const m = one('erDiagram\n  A ||--o{ B :');
  assert.deepEqual(m.errors, []);
  assert.equal(m.relationships[0].label, '');
  assert.ok(m.notes.includes('Line 2 has a `:` but no label. To use it in Mermaid, add a label after the `:` or remove the `:`.'));
  assert.deepEqual(one('erDiagram\n  A ||--o{ B : plays for').notes, [], 'a label with spaces is fine in Mermaid');
});
