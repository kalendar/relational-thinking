# Query Operations Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, single-file web tool where students apply filter, project, join, and aggregate steps to 10 sample data sets and watch each step change the table, with no SQL shown.

**Architecture:** Plain JavaScript split into small source files under `tools/query-explorer/src/`. Pure logic (`engine.js`, `describe.js`, `visual.js`) has no DOM and is tested with Node's built-in test runner. DOM code (`dom.js`, `table-view.js`, `recipe-view.js`, `animate.js`, `app.js`) re-renders the whole screen from one state object. `build.js` inlines everything into `dist/query-explorer.html`.

**Tech Stack:** Plain JavaScript (ES2020), HTML, CSS. Node 22 for the build and tests (`node:test`, `node:assert/strict`). No npm packages, no frameworks.

**Spec:** `docs/superpowers/specs/2026-10-13-query-operations-explorer-design.md`

## Global Constraints

- Students never see SQL. No on-screen text uses SQL keywords (`SELECT`, `WHERE`, `JOIN ... ON`, `GROUP BY`).
- All on-screen text is at a 10th-grade reading level.
- The deliverable is one file, `tools/query-explorer/dist/query-explorer.html`. It has no outside dependencies except the Google Fonts `<link>` (Montserrat, Nunito Sans), and it falls back to system fonts. It must work when opened from a local disk.
- No npm packages. Every source file runs in the browser as a classic script and in Node via `require`, using the pattern shown in Task 1.
- Never put data into `innerHTML`. Build all DOM with the `h()` helper (Task 11).
- Colors come from the `:root` tokens copied from `Claude outputs/table-splitter.html` (Task 11), including its dark mode (`prefers-color-scheme` plus `data-theme`).
- Laptop width (1024px and up) is the main target. At 375px the layout stacks, and tables scroll inside their own box.
- Inner join only. Three column types only: `text`, `number`, `date`. Dates are ISO strings `YYYY-MM-DD`.
- Data rules from spec §7, as enforced by the validator in Task 7.
- Spec section numbers (§N) refer to the spec file above.

## Review Focus

1. A number typed with commas (`1,000,000`) shows "Type a number, like 1500 (no commas)." and Apply stays disabled. Tested in Task 4.
2. "Between" values entered high-then-low return the same rows as low-then-high. Tested in Task 1.
3. Text values that differ only in case or surrounding spaces (`" latin "` vs `Latin`) still match. Tested in Task 1.
4. A filter that removes every row, followed by an aggregate, doesn't crash. Whole table: one row with `number_of_rows` 0. Grouped: zero rows. Tested in Task 3.
5. Editing or turning off an earlier step so that a later step's column disappears flags only that later step. Steps after it that don't need the column still run. Tested in Task 4.

---

## File Structure

```
tools/query-explorer/
  build.js                    # Task 11: inlines src/ into dist/query-explorer.html
  src/
    engine.js                 # Tasks 1–4: tables, the four operations, recipe runner
    describe.js               # Task 5: value formatting, step sentences, rich-text parsing
    visual.js                 # Task 6: which rows/columns get which highlight (pure)
    datasets/01-spotify.js    # Task 7
    datasets/02-concert.js    # Task 8
    datasets/03-netflix.js    # Task 8
    datasets/04-basketball.js # Task 8
    datasets/05-dining.js     # Task 9
    datasets/06-fantasy.js    # Task 9
    datasets/07-boxoffice.js  # Task 9
    datasets/08-esports.js    # Task 10
    datasets/09-tiktok.js     # Task 10
    datasets/10-festival.js   # Task 10
    index.html                # Task 11: page shell with INLINE markers
    styles.css                # Task 11
    dom.js                    # Task 11: h() and rich()
    table-view.js             # Task 11: renderTable, renderCounter, sizeText
    recipe-view.js            # Task 12: recipe panel and step editors
    app.js                    # Task 12: state, actions, render
    animate.js                # Task 13: playStep
  test/
    fixtures.js               # Task 1: tiny MINI data set used by engine tests
    helpers.js                # Task 7: loadDatasets()
    filter.test.js            # Task 1
    project-join.test.js      # Task 2
    aggregate.test.js         # Task 3
    recipe.test.js            # Task 4
    describe.test.js          # Task 5
    visual.test.js            # Task 6
    datasets.test.js          # Task 7 (+ count check in Task 10)
    build.test.js             # Task 11
  dist/query-explorer.html    # built deliverable (committed)
```

All commands below run from the repo root: `/Users/david/Documents/Claude/Projects/Intro to DBs`.

**Shared data shapes** (used by every task):

```js
// Data set definition (in datasets/*.js and test/fixtures.js)
{ id, name, description, start, tables: [TableDef], questions: [{ text, recipe: Recipe, note? }] }
// TableDef: rows are positional arrays matching columns
{ name, columns: [{ name, type: 'text'|'number'|'date', key?: 'pk'|'fk', ref?: TableName, plain?: true }], rows: [[...]] }
// Loaded table (engine output): rows are objects keyed by column name
{ name, sources: [TableName], columns: [{ ...column, origin: TableName }], rows: [{ [col]: value }] }
// Recipe and steps
Recipe = { start: TableName, steps: [Step] }
Step = { op: 'filter', column, condition, value, value2, values }   // values: string[] for is_one_of
     | { op: 'project', columns: [name] }
     | { op: 'join', table, leftColumn, rightColumn, cartesian: boolean }
     | { op: 'aggregate', groupBy: [name], summaries: [{ fn: 'count'|'total'|'average'|'lowest'|'highest', column }] }
// Steps in the app also carry { id: number, on: boolean }. on === false means turned off.
// Step result: { table, trace }
// Recipe result: one entry per step, index 0 = start:
{ status: 'ok'|'off'|'invalid', table, trace, message }
```

---

### Task 1: Engine scaffold, loadTable, and filter

**Files:**
- Create: `tools/query-explorer/src/engine.js`
- Create: `tools/query-explorer/test/fixtures.js`
- Test: `tools/query-explorer/test/filter.test.js`

**Interfaces:**
- Produces: `CONDITIONS`, `loadTable(def) → Table`, `getColumn(table, name) → column|null`, `findTableDef(dataset, name) → TableDef|null`, `filterTable(table, step) → { table, trace: { kept: number[], dropped: number[] } }`. Export pattern: `module.exports` in Node, `root.QE` in the browser.

- [ ] **Step 1: Create the test fixture**

`tools/query-explorer/test/fixtures.js`:

```js
// A tiny data set for engine tests. Saturn has no streams; Doechii has no songs.
const MINI = {
  id: 'mini',
  name: 'Mini',
  description: 'Artists · Songs · Streams',
  start: 'Streams',
  tables: [
    {
      name: 'Artists',
      columns: [
        { name: 'artist_id', type: 'number', key: 'pk' },
        { name: 'artist_name', type: 'text' },
        { name: 'genre', type: 'text' },
      ],
      rows: [[1, 'Bad Bunny', 'Latin'], [2, 'SZA', 'R&B'], [3, 'Doechii', 'Hip-Hop']],
    },
    {
      name: 'Songs',
      columns: [
        { name: 'song_id', type: 'number', key: 'pk' },
        { name: 'song_title', type: 'text' },
        { name: 'artist_id', type: 'number', key: 'fk', ref: 'Artists' },
        { name: 'release_date', type: 'date' },
      ],
      rows: [[10, 'DtMF', 1, '2025-01-05'], [11, 'Kill Bill', 2, '2022-12-09'], [12, 'Saturn', 2, '2024-02-22']],
    },
    {
      name: 'Streams',
      columns: [
        { name: 'stream_id', type: 'number', key: 'pk' },
        { name: 'song_id', type: 'number', key: 'fk', ref: 'Songs' },
        { name: 'stream_date', type: 'date' },
        { name: 'stream_count', type: 'number' },
      ],
      rows: [
        [100, 10, '2026-03-02', 500],
        [101, 11, '2026-03-02', 300],
        [102, 10, '2026-04-01', 200],
        [103, 11, '2026-03-15', 100],
      ],
    },
  ],
  questions: [],
};

module.exports = { MINI };
```

- [ ] **Step 2: Write the failing filter tests**

`tools/query-explorer/test/filter.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const table = name => QE.loadTable(QE.findTableDef(MINI, name));
const col = (t, name) => t.rows.map(r => r[name]);
const run = (name, step) => QE.filterTable(table(name), { op: 'filter', ...step });

test('loadTable turns positional rows into objects and records origin', () => {
  const t = table('Streams');
  assert.equal(t.name, 'Streams');
  assert.deepEqual(t.sources, ['Streams']);
  assert.deepEqual(t.rows[0], { stream_id: 100, song_id: 10, stream_date: '2026-03-02', stream_count: 500 });
  assert.equal(t.columns[1].origin, 'Streams');
  assert.equal(QE.getColumn(t, 'song_id').key, 'fk');
  assert.equal(QE.getColumn(t, 'nope'), null);
});

test('number conditions', () => {
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'is', value: '200' }).table, 'stream_id'), [102]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'is_not', value: '200' }).table, 'stream_id'), [100, 101, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'more_than', value: '250' }).table, 'stream_id'), [100, 101]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'less_than', value: '300' }).table, 'stream_id'), [102, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'at_least', value: '300' }).table, 'stream_id'), [100, 101]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'at_most', value: '200' }).table, 'stream_id'), [102, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_count', condition: 'between', value: '100', value2: '300' }).table, 'stream_id'), [101, 102, 103]);
});

test('between works when the values are entered high-then-low', () => {
  const a = run('Streams', { column: 'stream_count', condition: 'between', value: '300', value2: '100' });
  assert.deepEqual(col(a.table, 'stream_id'), [101, 102, 103]);
  const d = run('Streams', { column: 'stream_date', condition: 'between', value: '2026-03-31', value2: '2026-03-01' });
  assert.deepEqual(col(d.table, 'stream_id'), [100, 101, 103]);
});

test('date conditions', () => {
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'on', value: '2026-03-02' }).table, 'stream_id'), [100, 101]);
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'before', value: '2026-03-02' }).table, 'stream_id'), []);
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'after', value: '2026-03-02' }).table, 'stream_id'), [102, 103]);
  assert.deepEqual(col(run('Streams', { column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31' }).table, 'stream_id'), [100, 101, 103]);
});

test('text conditions ignore case and surrounding spaces', () => {
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is', value: 'latin' }).table, 'artist_name'), ['Bad Bunny']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is', value: ' Latin ' }).table, 'artist_name'), ['Bad Bunny']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is_not', value: 'LATIN' }).table, 'artist_name'), ['SZA', 'Doechii']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'is_one_of', values: ['r&b', 'Hip-Hop'] }).table, 'artist_name'), ['SZA', 'Doechii']);
  assert.deepEqual(col(run('Artists', { column: 'genre', condition: 'contains', value: 'HOP' }).table, 'artist_name'), ['Doechii']);
});

test('filter keeps columns, reports kept and dropped rows, and leaves the input alone', () => {
  const input = table('Streams');
  const out = QE.filterTable(input, { op: 'filter', column: 'stream_count', condition: 'more_than', value: '250' });
  assert.deepEqual(out.table.columns, input.columns);
  assert.deepEqual(out.trace, { kept: [0, 1], dropped: [2, 3] });
  assert.equal(input.rows.length, 4);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tools/query-explorer/test/filter.test.js`
Expected: FAIL with `Cannot find module '../src/engine.js'`

- [ ] **Step 4: Write the engine scaffold and filter**

`tools/query-explorer/src/engine.js`:

```js
// Query Explorer engine: tables and the four operations as pure functions. No DOM.
(function (root) {
  'use strict';

  const CONDITIONS = {
    text: [
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'is_one_of', label: 'is one of' },
      { id: 'contains', label: 'contains' },
    ],
    number: [
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'more_than', label: 'is more than' },
      { id: 'less_than', label: 'is less than' },
      { id: 'at_least', label: 'is at least' },
      { id: 'at_most', label: 'is at most' },
      { id: 'between', label: 'is between' },
    ],
    date: [
      { id: 'on', label: 'is on' },
      { id: 'before', label: 'is before' },
      { id: 'after', label: 'is after' },
      { id: 'between', label: 'is between' },
    ],
  };

  function loadTable(def) {
    const columns = def.columns.map(c => ({ ...c, origin: def.name }));
    const rows = def.rows.map(r => {
      const row = {};
      columns.forEach((c, i) => { row[c.name] = r[i]; });
      return row;
    });
    return { name: def.name, sources: [def.name], columns, rows };
  }

  function getColumn(table, name) {
    return table.columns.find(c => c.name === name) || null;
  }

  function findTableDef(dataset, name) {
    return dataset.tables.find(t => t.name === name) || null;
  }

  function norm(v) {
    return String(v).trim().toLowerCase();
  }

  function matches(value, type, f) {
    const c = f.condition;
    if (type === 'text') {
      const v = norm(value);
      switch (c) {
        case 'is': return v === norm(f.value);
        case 'is_not': return v !== norm(f.value);
        case 'is_one_of': return (f.values || []).some(x => norm(x) === v);
        case 'contains': return v.includes(norm(f.value));
      }
    }
    if (type === 'number') {
      const a = Number(f.value);
      switch (c) {
        case 'is': return value === a;
        case 'is_not': return value !== a;
        case 'more_than': return value > a;
        case 'less_than': return value < a;
        case 'at_least': return value >= a;
        case 'at_most': return value <= a;
        case 'between': {
          const b = Number(f.value2);
          return value >= Math.min(a, b) && value <= Math.max(a, b);
        }
      }
    }
    if (type === 'date') {
      const a = f.value;
      switch (c) {
        case 'on': return value === a;
        case 'before': return value < a;
        case 'after': return value > a;
        case 'between': {
          const b = f.value2;
          const lo = a < b ? a : b;
          const hi = a < b ? b : a;
          return value >= lo && value <= hi;
        }
      }
    }
    throw new Error(`Unknown condition "${c}" for a ${type} column`);
  }

  function filterTable(table, step) {
    const type = getColumn(table, step.column).type;
    const kept = [];
    const dropped = [];
    table.rows.forEach((row, i) => (matches(row[step.column], type, step) ? kept : dropped).push(i));
    return { table: { ...table, rows: kept.map(i => table.rows[i]) }, trace: { kept, dropped } };
  }

  const api = { CONDITIONS, loadTable, getColumn, findTableDef, filterTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tools/query-explorer/test/filter.test.js`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
git add tools/query-explorer/src/engine.js tools/query-explorer/test/fixtures.js tools/query-explorer/test/filter.test.js
git commit -m "Query Explorer: add engine scaffold and filter operation"
```

---

### Task 2: Project, join, and join-key suggestion

**Files:**
- Modify: `tools/query-explorer/src/engine.js`
- Test: `tools/query-explorer/test/project-join.test.js`

**Interfaces:**
- Consumes: `loadTable`, `getColumn`, `norm` (internal) from Task 1.
- Produces: `projectTable(table, step) → { table, trace: { kept: string[], dropped: string[] } }`; `joinTable(left, right, step) → { table, trace: { pairs: [leftIdx, rightIdx][], unmatchedLeft: number[], unmatchedRight: number[], cartesian: boolean } }`; `suggestJoinKey(current, other) → { leftColumn, rightColumn } | null`.

- [ ] **Step 1: Write the failing tests**

`tools/query-explorer/test/project-join.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const table = name => QE.loadTable(QE.findTableDef(MINI, name));
const names = t => t.columns.map(c => c.name);

test('project keeps the table column order and reports dropped columns', () => {
  const out = QE.projectTable(table('Streams'), { op: 'project', columns: ['stream_count', 'stream_id'] });
  assert.deepEqual(names(out.table), ['stream_id', 'stream_count']);
  assert.deepEqual(out.table.rows[0], { stream_id: 100, stream_count: 500 });
  assert.deepEqual(out.trace, { kept: ['stream_id', 'stream_count'], dropped: ['song_id', 'stream_date'] });
});

test('join on a same-name key shows the key once and drops rows with no match', () => {
  const out = QE.joinTable(table('Streams'), table('Songs'), { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.deepEqual(names(out.table), ['stream_id', 'song_id', 'stream_date', 'stream_count', 'song_title', 'artist_id', 'release_date']);
  assert.deepEqual(out.table.rows.map(r => r.song_title), ['DtMF', 'Kill Bill', 'DtMF', 'Kill Bill']);
  assert.deepEqual(out.table.sources, ['Streams', 'Songs']);
  assert.deepEqual(out.trace.unmatchedLeft, []);
  assert.deepEqual(out.trace.unmatchedRight, [2]);
  assert.equal(out.trace.cartesian, false);
});

test('join from the parent side drops the parent row with no children', () => {
  const out = QE.joinTable(table('Artists'), table('Songs'), { op: 'join', table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' });
  assert.deepEqual(out.table.rows.map(r => `${r.artist_name}/${r.song_title}`), ['Bad Bunny/DtMF', 'SZA/Kill Bill', 'SZA/Saturn']);
  assert.deepEqual(out.trace.pairs, [[0, 0], [1, 1], [1, 2]]);
  assert.deepEqual(out.trace.unmatchedLeft, [2]);
});

test('joining with no match condition pairs every row and prefixes clashing names', () => {
  const out = QE.joinTable(table('Songs'), table('Artists'), { op: 'join', table: 'Artists', cartesian: true });
  assert.equal(out.table.rows.length, 9);
  assert.ok(names(out.table).includes('Songs.artist_id'));
  assert.ok(names(out.table).includes('Artists.artist_id'));
  assert.ok(!names(out.table).includes('artist_id'));
  assert.equal(out.trace.cartesian, true);
});

test('joining on the wrong key finds no matches and keeps both clashing columns', () => {
  const out = QE.joinTable(table('Songs'), table('Artists'), { op: 'join', table: 'Artists', leftColumn: 'song_id', rightColumn: 'artist_id' });
  assert.equal(out.table.rows.length, 0);
  assert.ok(names(out.table).includes('Songs.artist_id'));
  assert.ok(names(out.table).includes('Artists.artist_id'));
  assert.deepEqual(out.trace.unmatchedLeft, [0, 1, 2]);
});

test('suggestJoinKey follows foreign keys in either direction', () => {
  assert.deepEqual(QE.suggestJoinKey(table('Streams'), table('Songs')), { leftColumn: 'song_id', rightColumn: 'song_id' });
  assert.deepEqual(QE.suggestJoinKey(table('Artists'), table('Songs')), { leftColumn: 'artist_id', rightColumn: 'artist_id' });
  assert.equal(QE.suggestJoinKey(table('Streams'), table('Artists')), null);
  const joined = QE.joinTable(table('Streams'), table('Songs'), { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' }).table;
  assert.deepEqual(QE.suggestJoinKey(joined, table('Artists')), { leftColumn: 'artist_id', rightColumn: 'artist_id' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/query-explorer/test/project-join.test.js`
Expected: FAIL with `QE.projectTable is not a function`

- [ ] **Step 3: Add project, join, and suggestJoinKey to `engine.js`**

Insert after `filterTable`:

```js
  function projectTable(table, step) {
    const keep = new Set(step.columns);
    const columns = table.columns.filter(c => keep.has(c.name));
    const rows = table.rows.map(r => {
      const row = {};
      columns.forEach(c => { row[c.name] = r[c.name]; });
      return row;
    });
    return {
      table: { ...table, columns, rows },
      trace: { kept: columns.map(c => c.name), dropped: table.columns.filter(c => !keep.has(c.name)).map(c => c.name) },
    };
  }

  function sameValue(a, b, type) {
    return type === 'text' ? norm(a) === norm(b) : a === b;
  }

  function joinTable(left, right, step) {
    const cartesian = !!step.cartesian;
    const sameKey = !cartesian && step.leftColumn === step.rightColumn;
    const rightKept = right.columns.filter(c => !(sameKey && c.name === step.rightColumn));
    const leftNames = new Set(left.columns.map(c => c.name));
    const clash = new Set(rightKept.filter(c => leftNames.has(c.name)).map(c => c.name));
    const leftMap = left.columns.map(c => ({ from: c.name, col: clash.has(c.name) ? { ...c, name: `${c.origin}.${c.name}` } : c }));
    const rightMap = rightKept.map(c => ({ from: c.name, col: clash.has(c.name) ? { ...c, name: `${right.name}.${c.name}` } : c }));
    const type = cartesian ? null : getColumn(left, step.leftColumn).type;

    const pairs = [];
    const unmatchedLeft = [];
    const matchedRight = new Set();
    left.rows.forEach((lr, li) => {
      let found = false;
      right.rows.forEach((rr, ri) => {
        if (cartesian || sameValue(lr[step.leftColumn], rr[step.rightColumn], type)) {
          pairs.push([li, ri]);
          matchedRight.add(ri);
          found = true;
        }
      });
      if (!found) unmatchedLeft.push(li);
    });
    const unmatchedRight = right.rows.map((_, i) => i).filter(i => !matchedRight.has(i));
    const rows = pairs.map(([li, ri]) => {
      const row = {};
      leftMap.forEach(m => { row[m.col.name] = left.rows[li][m.from]; });
      rightMap.forEach(m => { row[m.col.name] = right.rows[ri][m.from]; });
      return row;
    });
    return {
      table: {
        name: left.name,
        sources: [...left.sources, right.name],
        columns: [...leftMap.map(m => m.col), ...rightMap.map(m => m.col)],
        rows,
      },
      trace: { pairs, unmatchedLeft, unmatchedRight, cartesian },
    };
  }

  function suggestJoinKey(current, other) {
    for (const c of current.columns) {
      for (const o of other.columns) {
        if (c.name !== o.name) continue;
        if (c.key === 'fk' && c.ref === other.name && o.key === 'pk') return { leftColumn: c.name, rightColumn: o.name };
        if (o.key === 'fk' && o.ref === c.origin && c.key === 'pk') return { leftColumn: c.name, rightColumn: o.name };
      }
    }
    return null;
  }
```

Update the export line:

```js
  const api = { CONDITIONS, loadTable, getColumn, findTableDef, filterTable, projectTable, joinTable, suggestJoinKey };
```

- [ ] **Step 4: Run all engine tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/engine.js tools/query-explorer/test/project-join.test.js
git commit -m "Query Explorer: add project, join, and join-key suggestion"
```

---

### Task 3: Aggregate

**Files:**
- Modify: `tools/query-explorer/src/engine.js`
- Test: `tools/query-explorer/test/aggregate.test.js`

**Interfaces:**
- Produces: `SUMMARY_FUNCTIONS` (array of `{ id, label, prefix, types }`); `aggregateTable(table, step) → { table, trace: { groups: number[][] } }`, where `groups[i]` lists the input row indexes behind output row `i`.

- [ ] **Step 1: Write the failing tests**

`tools/query-explorer/test/aggregate.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { MINI } = require('./fixtures.js');

const streams = () => QE.loadTable(QE.findTableDef(MINI, 'Streams'));
const agg = (t, groupBy, summaries) => QE.aggregateTable(t, { op: 'aggregate', groupBy, summaries });

test('group by one column with every summary function', () => {
  const out = agg(streams(), ['song_id'], [
    { fn: 'count' },
    { fn: 'total', column: 'stream_count' },
    { fn: 'average', column: 'stream_count' },
    { fn: 'lowest', column: 'stream_date' },
    { fn: 'highest', column: 'stream_count' },
  ]);
  assert.deepEqual(out.table.columns.map(c => c.name),
    ['song_id', 'number_of_rows', 'total_stream_count', 'average_stream_count', 'lowest_stream_date', 'highest_stream_count']);
  assert.deepEqual(out.table.rows, [
    { song_id: 10, number_of_rows: 2, total_stream_count: 700, average_stream_count: 350, lowest_stream_date: '2026-03-02', highest_stream_count: 500 },
    { song_id: 11, number_of_rows: 2, total_stream_count: 400, average_stream_count: 200, lowest_stream_date: '2026-03-02', highest_stream_count: 300 },
  ]);
  assert.deepEqual(out.trace.groups, [[0, 2], [1, 3]]);
  assert.equal(QE.getColumn(out.table, 'lowest_stream_date').type, 'date');
  assert.equal(QE.getColumn(out.table, 'total_stream_count').type, 'number');
});

test('no group-by columns makes the whole table one row', () => {
  const out = agg(streams(), [], [{ fn: 'count' }, { fn: 'total', column: 'stream_count' }]);
  assert.deepEqual(out.table.rows, [{ number_of_rows: 4, total_stream_count: 1100 }]);
  assert.deepEqual(out.trace.groups, [[0, 1, 2, 3]]);
});

test('two group-by columns', () => {
  const out = agg(streams(), ['song_id', 'stream_date'], [{ fn: 'count' }]);
  assert.equal(out.table.rows.length, 4);
  assert.deepEqual(out.table.columns.map(c => c.name), ['song_id', 'stream_date', 'number_of_rows']);
});

test('averages round to 2 decimal places', () => {
  const t = { name: 'T', sources: ['T'], columns: [{ name: 'x', type: 'number', origin: 'T' }], rows: [{ x: 1 }, { x: 1 }, { x: 2 }] };
  assert.equal(agg(t, [], [{ fn: 'average', column: 'x' }]).table.rows[0].average_x, 1.33);
});

test('duplicate summary names get a number added', () => {
  const out = agg(streams(), [], [{ fn: 'total', column: 'stream_count' }, { fn: 'total', column: 'stream_count' }]);
  assert.deepEqual(out.table.columns.map(c => c.name), ['total_stream_count', 'total_stream_count_2']);
});

test('aggregating an empty table', () => {
  const empty = QE.filterTable(streams(), { op: 'filter', column: 'stream_count', condition: 'more_than', value: '9999' }).table;
  const whole = agg(empty, [], [{ fn: 'count' }, { fn: 'total', column: 'stream_count' }, { fn: 'average', column: 'stream_count' }]);
  assert.deepEqual(whole.table.rows, [{ number_of_rows: 0, total_stream_count: 0, average_stream_count: null }]);
  assert.deepEqual(whole.trace.groups, [[]]);
  const grouped = agg(empty, ['song_id'], [{ fn: 'count' }]);
  assert.deepEqual(grouped.table.rows, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/query-explorer/test/aggregate.test.js`
Expected: FAIL with `QE.aggregateTable is not a function`

- [ ] **Step 3: Add aggregate to `engine.js`**

Insert after `CONDITIONS`:

```js
  const SUMMARY_FUNCTIONS = [
    { id: 'count', label: 'count of rows', prefix: 'number_of_rows', types: [] },
    { id: 'total', label: 'total', prefix: 'total', types: ['number'] },
    { id: 'average', label: 'average', prefix: 'average', types: ['number'] },
    { id: 'lowest', label: 'lowest', prefix: 'lowest', types: ['number', 'date'] },
    { id: 'highest', label: 'highest', prefix: 'highest', types: ['number', 'date'] },
  ];
```

Insert after `suggestJoinKey`:

```js
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function summarize(fn, rows, column) {
    if (fn === 'count') return rows.length;
    const vals = rows.map(r => r[column]).filter(v => v !== null && v !== undefined);
    if (fn === 'total') return round2(vals.reduce((s, v) => s + v, 0));
    if (!vals.length) return null;
    if (fn === 'average') return round2(vals.reduce((s, v) => s + v, 0) / vals.length);
    if (fn === 'lowest') return vals.reduce((m, v) => (v < m ? v : m));
    if (fn === 'highest') return vals.reduce((m, v) => (v > m ? v : m));
    throw new Error(`Unknown summary "${fn}"`);
  }

  function aggregateTable(table, step) {
    const index = new Map();
    const groups = [];
    table.rows.forEach((row, i) => {
      const key = JSON.stringify(step.groupBy.map(g => row[g]));
      if (!index.has(key)) { index.set(key, groups.length); groups.push([]); }
      groups[index.get(key)].push(i);
    });
    if (!step.groupBy.length && !groups.length) groups.push([]);

    const groupCols = step.groupBy.map(g => getColumn(table, g));
    const used = new Set(groupCols.map(c => c.name));
    const sumCols = step.summaries.map(s => {
      const fn = SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
      const base = s.fn === 'count' ? fn.prefix : `${fn.prefix}_${s.column.replace(/\./g, '_')}`;
      let name = base;
      for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
      used.add(name);
      const type = s.fn === 'lowest' || s.fn === 'highest' ? getColumn(table, s.column).type : 'number';
      return { name, type, origin: table.name, summary: s };
    });

    const rows = groups.map(members => {
      const memberRows = members.map(i => table.rows[i]);
      const row = {};
      groupCols.forEach(c => { row[c.name] = memberRows[0][c.name]; });
      sumCols.forEach(c => { row[c.name] = summarize(c.summary.fn, memberRows, c.summary.column); });
      return row;
    });
    const columns = [...groupCols, ...sumCols.map(({ summary, ...c }) => c)];
    return { table: { ...table, columns, rows }, trace: { groups } };
  }
```

Update the export line:

```js
  const api = { CONDITIONS, SUMMARY_FUNCTIONS, loadTable, getColumn, findTableDef, filterTable, projectTable, joinTable, suggestJoinKey, aggregateTable };
```

- [ ] **Step 4: Run all tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 18 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/engine.js tools/query-explorer/test/aggregate.test.js
git commit -m "Query Explorer: add aggregate operation"
```

---

### Task 4: Step checks and the recipe runner

**Files:**
- Modify: `tools/query-explorer/src/engine.js`
- Test: `tools/query-explorer/test/recipe.test.js`

**Interfaces:**
- Produces:
  - `incompleteReason(step, inputTable) → string|null`: why Apply must stay disabled.
  - `validateStep(table, step, dataset) → string|null`: why a saved step can't run.
  - `runRecipe(dataset, recipe) → Result[]`, with length `steps.length + 1`, where index 0 is the start table. A step that is turned off or can't run passes the previous table through unchanged.

  Messages use `` `col` `` for column names and `**Table**` for table names. `describe.js` turns these into code and bold text.

- [ ] **Step 1: Write the failing tests**

`tools/query-explorer/test/recipe.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/query-explorer/test/recipe.test.js`
Expected: FAIL with `QE.runRecipe is not a function`

- [ ] **Step 3: Add the checks and runner to `engine.js`**

Insert after `aggregateTable`:

```js
  function blank(v) {
    return v === undefined || v === null || String(v).trim() === '';
  }

  function notNumber(v) {
    return blank(v) || !Number.isFinite(Number(v));
  }

  function incompleteReason(step, table) {
    switch (step.op) {
      case 'filter': {
        if (blank(step.column)) return 'Pick a column.';
        if (blank(step.condition)) return 'Pick a condition.';
        if (step.condition === 'is_one_of') return step.values && step.values.length ? null : 'Pick at least one value.';
        const two = step.condition === 'between';
        if (blank(step.value) || (two && blank(step.value2))) return two ? 'Fill in both values.' : 'Pick a value.';
        const col = table ? getColumn(table, step.column) : null;
        if (col && col.type === 'number' && (notNumber(step.value) || (two && notNumber(step.value2)))) {
          return 'Type a number, like 1500 (no commas).';
        }
        return null;
      }
      case 'project':
        return step.columns && step.columns.length ? null : 'Keep at least one column.';
      case 'join':
        if (blank(step.table)) return 'Pick a table.';
        if (!step.cartesian && (blank(step.leftColumn) || blank(step.rightColumn))) return 'Pick the columns to match.';
        return null;
      case 'aggregate':
        if (!step.summaries || !step.summaries.length) return 'Add a calculation.';
        if (step.summaries.some(s => s.fn !== 'count' && blank(s.column))) return 'Pick a column for each calculation.';
        return null;
    }
    return 'Unknown step.';
  }

  function missingColumn(table, name) {
    return getColumn(table, name) ? null : `This step uses \`${name}\`, which isn't in the table anymore.`;
  }

  function validateStep(table, step, dataset) {
    switch (step.op) {
      case 'filter': {
        const missing = missingColumn(table, step.column);
        if (missing) return missing;
        const type = getColumn(table, step.column).type;
        if (!CONDITIONS[type].some(c => c.id === step.condition)) return `\`${step.column}\` can't use the condition you picked anymore.`;
        return null;
      }
      case 'project': {
        for (const name of step.columns) {
          const missing = missingColumn(table, name);
          if (missing) return missing;
        }
        return null;
      }
      case 'join': {
        const def = findTableDef(dataset, step.table);
        if (!def) return `There's no table named **${step.table}** in this data set.`;
        if (table.sources.includes(step.table)) return `**${step.table}** is already part of the table.`;
        if (step.cartesian) return null;
        const missing = missingColumn(table, step.leftColumn);
        if (missing) return missing;
        const right = def.columns.find(c => c.name === step.rightColumn);
        if (!right) return `**${step.table}** has no column \`${step.rightColumn}\`.`;
        if (getColumn(table, step.leftColumn).type !== right.type) {
          return `\`${step.leftColumn}\` and \`${step.rightColumn}\` hold different kinds of values, so they can't be matched.`;
        }
        return null;
      }
      case 'aggregate': {
        for (const name of step.groupBy) {
          const missing = missingColumn(table, name);
          if (missing) return missing;
        }
        for (const s of step.summaries) {
          if (s.fn === 'count') continue;
          const missing = missingColumn(table, s.column);
          if (missing) return missing;
          const fn = SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
          if (!fn.types.includes(getColumn(table, s.column).type)) return `You can't find the ${fn.label} of \`${s.column}\`.`;
        }
        return null;
      }
    }
    return `Unknown step type "${step.op}".`;
  }

  function applyStep(table, step, dataset) {
    switch (step.op) {
      case 'filter': return filterTable(table, step);
      case 'project': return projectTable(table, step);
      case 'join': return joinTable(table, loadTable(findTableDef(dataset, step.table)), step);
      case 'aggregate': return aggregateTable(table, step);
    }
    throw new Error(`Unknown step type "${step.op}"`);
  }

  function runRecipe(dataset, recipe) {
    const start = loadTable(findTableDef(dataset, recipe.start));
    const results = [{ status: 'ok', table: start, trace: null, message: null }];
    let current = start;
    for (const step of recipe.steps) {
      if (step.on === false) {
        results.push({ status: 'off', table: current, trace: null, message: null });
        continue;
      }
      const problem = incompleteReason(step, current) || validateStep(current, step, dataset);
      if (problem) {
        results.push({ status: 'invalid', table: current, trace: null, message: problem });
        continue;
      }
      const out = applyStep(current, step, dataset);
      current = out.table;
      results.push({ status: 'ok', table: out.table, trace: out.trace, message: null });
    }
    return results;
  }
```

Update the export line:

```js
  const api = {
    CONDITIONS, SUMMARY_FUNCTIONS, loadTable, getColumn, findTableDef,
    filterTable, projectTable, joinTable, suggestJoinKey, aggregateTable,
    incompleteReason, validateStep, runRecipe,
  };
```

- [ ] **Step 4: Run all tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 27 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/engine.js tools/query-explorer/test/recipe.test.js
git commit -m "Query Explorer: add step checks and recipe runner"
```

---

### Task 5: Formatting and step sentences

**Files:**
- Create: `tools/query-explorer/src/describe.js`
- Test: `tools/query-explorer/test/describe.test.js`

**Interfaces:**
- Consumes: `CONDITIONS`, `SUMMARY_FUNCTIONS`, `getColumn`, `runRecipe` from `engine.js`.
- Produces:
  - `formatValue(value, column) → string`
  - `describeStart(name) → string`
  - `describeStep(step, inputTable) → string`
  - `describeRecipe(dataset, recipe) → string[]` (start sentence first)
  - `parseRich(str) → [{ kind: 'text'|'strong'|'code', text }]`

  Sentences mark column names with `` `col` `` and table names and values with `**x**`.

- [ ] **Step 1: Write the failing tests**

`tools/query-explorer/test/describe.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/query-explorer/test/describe.test.js`
Expected: FAIL with `Cannot find module '../src/describe.js'`

- [ ] **Step 3: Write `describe.js`**

`tools/query-explorer/src/describe.js`:

```js
// Query Explorer: value formatting and plain-English step sentences. No DOM.
(function (root) {
  'use strict';
  const engine = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.QE;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ALL_CONDITIONS = [].concat(...Object.values(engine.CONDITIONS));

  function formatDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }

  function formatValue(value, column) {
    if (value === null || value === undefined || value === '') return '—';
    const type = column ? column.type : 'text';
    if (type === 'date') return formatDate(value);
    if (type === 'number') {
      const n = Number(value);
      if (column.key || column.plain) return String(n);
      return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return String(value);
  }

  const code = s => '`' + s + '`';
  const bold = s => '**' + s + '**';

  function listJoin(items) {
    if (items.length <= 2) return items.join(' and ');
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  function conditionLabel(id, type) {
    const found = (engine.CONDITIONS[type] || []).find(c => c.id === id) || ALL_CONDITIONS.find(c => c.id === id);
    return found ? found.label : id;
  }

  function describeStart(name) {
    return 'Start with ' + bold(name);
  }

  function describeStep(step, input) {
    switch (step.op) {
      case 'filter': {
        const col = input ? engine.getColumn(input, step.column) : null;
        const shown = col || { type: 'text' };
        const fmt = v => bold(formatValue(shown.type === 'number' ? Number(v) : v, shown));
        let value;
        if (step.condition === 'between') value = fmt(step.value) + ' and ' + fmt(step.value2);
        else if (step.condition === 'is_one_of') value = (step.values || []).map(bold).join(', ');
        else value = fmt(step.value);
        return `Keep only rows where ${code(step.column)} ${conditionLabel(step.condition, shown.type)} ${value}`;
      }
      case 'project':
        return 'Keep only the columns ' + step.columns.map(code).join(', ');
      case 'join':
        if (step.cartesian) return `Combine every row with every row of ${bold(step.table)}`;
        if (step.leftColumn === step.rightColumn) return `Combine with ${bold(step.table)}, matching ${code(step.leftColumn)}`;
        return `Combine with ${bold(step.table)}, matching ${code(step.leftColumn)} to ${code(step.rightColumn)}`;
      case 'aggregate': {
        const sums = listJoin(step.summaries.map(s => {
          if (s.fn === 'count') return 'the count of rows';
          const fn = engine.SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
          return `the ${fn.label} of ${code(s.column)}`;
        }));
        return step.groupBy.length
          ? `Group by ${listJoin(step.groupBy.map(code))} and calculate ${sums}`
          : `For the whole table, calculate ${sums}`;
      }
    }
    return 'Unknown step';
  }

  function describeRecipe(dataset, recipe) {
    const results = engine.runRecipe(dataset, recipe);
    return [describeStart(recipe.start), ...recipe.steps.map((s, k) => describeStep(s, results[k].table))];
  }

  function parseRich(str) {
    const parts = [];
    const re = /\*\*(.+?)\*\*|`(.+?)`/g;
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      if (m.index > last) parts.push({ kind: 'text', text: str.slice(last, m.index) });
      parts.push(m[1] !== undefined ? { kind: 'strong', text: m[1] } : { kind: 'code', text: m[2] });
      last = re.lastIndex;
    }
    if (last < str.length) parts.push({ kind: 'text', text: str.slice(last) });
    return parts;
  }

  const api = { formatValue, formatDate, describeStart, describeStep, describeRecipe, parseRich };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
```

- [ ] **Step 4: Run all tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 32 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/describe.js tools/query-explorer/test/describe.test.js
git commit -m "Query Explorer: add value formatting and step sentences"
```

---

### Task 6: Visual plan (which rows and columns get which highlight)

**Files:**
- Create: `tools/query-explorer/src/visual.js`
- Test: `tools/query-explorer/test/visual.test.js`

**Interfaces:**
- Consumes: `getColumn` (engine), `formatValue` (describe).
- Produces: `COLORS = 5`; `colorClass(id) → 'c0'..'c4' | null`; `visualPlan(step, before, result, other) → plan`. The plan's shape depends on the operation:
  - filter: `{ op, beforeRows: ('keep'|'drop')[], afterRows: 'keep'[] }`
  - project: `{ op, dropped: string[], afterRows: null[] }`
  - join: `{ op, cartesian, leftMatch: (number|null)[], rightMatch: (number|null)[], afterRows: (string|null)[] }`. Match ids start at 0; the screen shows `#id+1`.
  - aggregate: `{ op, order: number[], rowGroup: number[], labels: string[], afterRows: string[] }`

  `result` is a runRecipe entry (`{ table, trace }`). `other` is the loaded right-hand table for joins, otherwise `null`.

- [ ] **Step 1: Write the failing tests**

`tools/query-explorer/test/visual.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/query-explorer/test/visual.test.js`
Expected: FAIL with `Cannot find module '../src/visual.js'`

- [ ] **Step 3: Write `visual.js`**

`tools/query-explorer/src/visual.js`:

```js
// Query Explorer: decides which rows and columns get which highlight. No DOM.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const engine = node ? require('./engine.js') : root.QE;
  const describe = node ? require('./describe.js') : root.QE;

  const COLORS = 5;
  const keyOf = v => String(v).trim().toLowerCase();

  function colorClass(id) {
    return id === null || id === undefined ? null : 'c' + (id % COLORS);
  }

  function visualPlan(step, before, result, other) {
    const trace = result.trace;
    if (step.op === 'filter') {
      const kept = new Set(trace.kept);
      return {
        op: 'filter',
        beforeRows: before.rows.map((_, i) => (kept.has(i) ? 'keep' : 'drop')),
        afterRows: result.table.rows.map(() => 'keep'),
      };
    }
    if (step.op === 'project') {
      return { op: 'project', dropped: trace.dropped, afterRows: result.table.rows.map(() => null) };
    }
    if (step.op === 'join') {
      const leftMatch = before.rows.map(() => null);
      const rightMatch = other.rows.map(() => null);
      if (trace.cartesian) {
        return { op: 'join', cartesian: true, leftMatch, rightMatch, afterRows: result.table.rows.map(() => null) };
      }
      const ids = new Map();
      trace.pairs.forEach(([li, ri]) => {
        const k = keyOf(before.rows[li][step.leftColumn]);
        if (!ids.has(k)) ids.set(k, ids.size);
        leftMatch[li] = ids.get(k);
        rightMatch[ri] = ids.get(k);
      });
      return { op: 'join', cartesian: false, leftMatch, rightMatch, afterRows: trace.pairs.map(([li]) => colorClass(leftMatch[li])) };
    }
    if (step.op === 'aggregate') {
      const rowGroup = before.rows.map(() => null);
      trace.groups.forEach((g, gi) => g.forEach(i => { rowGroup[i] = gi; }));
      const labels = trace.groups.map(g => (step.groupBy.length && g.length
        ? step.groupBy.map(c => describe.formatValue(before.rows[g[0]][c], engine.getColumn(before, c))).join(' · ')
        : 'All rows'));
      return { op: 'aggregate', order: trace.groups.flat(), rowGroup, labels, afterRows: trace.groups.map((_, gi) => colorClass(gi)) };
    }
    throw new Error(`Unknown step type "${step.op}"`);
  }

  const api = { COLORS, colorClass, visualPlan };
  if (node) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
```

- [ ] **Step 4: Run all tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 38 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/visual.js tools/query-explorer/test/visual.test.js
git commit -m "Query Explorer: add visual plan for highlights"
```

---

### Task 7: Data set validator and the Spotify Streams data set

**Files:**
- Create: `tools/query-explorer/test/helpers.js`
- Create: `tools/query-explorer/test/datasets.test.js`
- Create: `tools/query-explorer/src/datasets/01-spotify.js`

**Interfaces:**
- Consumes: `runRecipe` (engine).
- Produces: the data set file pattern every later data set uses, and `loadDatasets() → DatasetDef[]` (sorted by file name).

- [ ] **Step 1: Write the loader and the validator**

`tools/query-explorer/test/helpers.js`:

```js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'datasets');

function loadDatasets() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().map(f => require(path.join(DIR, f)));
}

module.exports = { loadDatasets };
```

`tools/query-explorer/test/datasets.test.js`:

```js
// Checks every data set against the rules in spec §7.
const test = require('node:test');
const assert = require('node:assert/strict');
const QE = require('../src/engine.js');
const { loadDatasets } = require('./helpers.js');

const DATASETS = loadDatasets();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  const year = Number(s.slice(0, 4));
  return !isNaN(d) && d.toISOString().slice(0, 10) === s && year >= 2015 && year <= 2026;
}

test('data set ids are unique', () => {
  const ids = DATASETS.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const ds of DATASETS) {
  test(`${ds.name}: basic shape`, () => {
    assert.match(ds.id, /^[a-z0-9-]+$/);
    assert.ok(ds.tables.length >= 2 && ds.tables.length <= 3, '2–3 tables');
    assert.ok(ds.tables.some(t => t.name === ds.start), 'start table exists');
    assert.equal(ds.description, ds.tables.map(t => t.name).join(' · '));
  });

  test(`${ds.name}: tables follow the rules`, () => {
    for (const t of ds.tables) {
      assert.ok(t.rows.length >= 8 && t.rows.length <= 25, `${t.name} has ${t.rows.length} rows (needs 8–25)`);
      const pks = t.columns.filter(c => c.key === 'pk');
      assert.equal(pks.length, 1, `${t.name} has exactly one primary key`);
      assert.match(pks[0].name, /_id$/, `${t.name} primary key ends in _id`);
      t.rows.forEach((r, i) => {
        assert.equal(r.length, t.columns.length, `${t.name} row ${i} has ${t.columns.length} values`);
        t.columns.forEach((c, j) => {
          const v = r[j];
          const where = `${t.name}.${c.name} row ${i}`;
          if (c.type === 'number') assert.ok(Number.isFinite(v), `${where} is a number`);
          if (c.type === 'text') assert.ok(typeof v === 'string' && v.length > 0 && v.trim() === v, `${where} is non-empty trimmed text`);
          if (c.type === 'date') assert.ok(validDate(v), `${where} is a real date from 2015–2026`);
          if (typeof v === 'string') assert.ok(!v.includes('`') && !v.includes('**'), `${where} has no \` or **`);
        });
      });
      const k = t.columns.indexOf(pks[0]);
      const ids = t.rows.map(r => r[k]);
      assert.equal(new Set(ids).size, ids.length, `${t.name} primary keys are unique`);
    }
  });

  test(`${ds.name}: foreign keys are valid and some row has no match`, () => {
    let noMatch = false;
    for (const t of ds.tables) {
      t.columns.forEach((c, j) => {
        if (c.key !== 'fk') return;
        const parent = ds.tables.find(p => p.name === c.ref);
        assert.ok(parent, `${t.name}.${c.name} points to a real table`);
        const p = parent.columns.findIndex(pc => pc.key === 'pk' && pc.name === c.name);
        assert.ok(p >= 0, `${t.name}.${c.name} has the same name as ${parent.name}'s primary key`);
        const parentIds = new Set(parent.rows.map(r => r[p]));
        const used = new Set(t.rows.map(r => r[j]));
        for (const v of used) assert.ok(parentIds.has(v), `${t.name}.${c.name} value ${v} exists in ${parent.name}`);
        if ([...parentIds].some(id => !used.has(id))) noMatch = true;
      });
    }
    assert.ok(noMatch, 'at least one row has no match in a related table');
  });

  test(`${ds.name}: column names and types`, () => {
    const nonKey = ds.tables.flatMap(t => t.columns.filter(c => !c.key).map(c => c.name));
    assert.equal(new Set(nonKey).size, nonKey.length, 'non-key column names are unique across tables');
    const types = new Set(ds.tables.flatMap(t => t.columns.filter(c => !c.key).map(c => c.type)));
    for (const type of ['text', 'number', 'date']) assert.ok(types.has(type), `has a ${type} column`);
  });

  test(`${ds.name}: three Try-this questions whose hints run`, () => {
    assert.equal(ds.questions.length, 3);
    for (const q of ds.questions) {
      const results = QE.runRecipe(ds, q.recipe);
      results.forEach((r, k) => assert.equal(r.status, 'ok', `"${q.text}" step ${k}: ${r.message}`));
      assert.ok(results[results.length - 1].table.rows.length > 0, `"${q.text}" gives at least one row`);
    }
  });
}
```

- [ ] **Step 2: Run the tests to verify there's nothing to check yet**

Run: `node --test tools/query-explorer/test/datasets.test.js`
Expected: FAIL with `ENOENT: no such file or directory` for `src/datasets`

- [ ] **Step 3: Write the Spotify data set**

`tools/query-explorer/src/datasets/01-spotify.js`:

```js
(function (root) {
  'use strict';
  const dataset = {
    id: 'spotify',
    name: 'Spotify Streams',
    description: 'Artists · Songs · Streams',
    start: 'Streams',
    tables: [
      {
        name: 'Artists',
        columns: [
          { name: 'artist_id', type: 'number', key: 'pk' },
          { name: 'artist_name', type: 'text' },
          { name: 'genre', type: 'text' },
          { name: 'home_country', type: 'text' },
        ],
        rows: [
          [1, 'Bad Bunny', 'Latin', 'Puerto Rico'],
          [2, 'Taylor Swift', 'Pop', 'United States'],
          [3, 'Kendrick Lamar', 'Hip-Hop', 'United States'],
          [4, 'SZA', 'R&B', 'United States'],
          [5, 'Karol G', 'Latin', 'Colombia'],
          [6, 'Drake', 'Hip-Hop', 'Canada'],
          [7, 'Olivia Rodrigo', 'Pop', 'United States'],
          [8, 'Doechii', 'Hip-Hop', 'United States'],
        ],
      },
      {
        name: 'Songs',
        columns: [
          { name: 'song_id', type: 'number', key: 'pk' },
          { name: 'song_title', type: 'text' },
          { name: 'artist_id', type: 'number', key: 'fk', ref: 'Artists' },
          { name: 'release_date', type: 'date' },
          { name: 'duration_sec', type: 'number' },
        ],
        rows: [
          [1, 'DtMF', 1, '2025-01-05', 237],
          [2, 'Tití Me Preguntó', 1, '2022-05-06', 243],
          [3, 'Anti-Hero', 2, '2022-10-21', 200],
          [4, 'Cruel Summer', 2, '2019-08-23', 178],
          [5, 'Not Like Us', 3, '2024-05-04', 274],
          [6, 'luther', 3, '2024-11-22', 177],
          [7, 'Kill Bill', 4, '2022-12-09', 153],
          [8, 'Saturn', 4, '2024-02-22', 186],
          [9, 'TQG', 5, '2023-02-24', 198],
          [10, 'Si Antes Te Hubiera Conocido', 5, '2024-06-21', 196],
          [11, "God's Plan", 6, '2018-01-19', 199],
          [12, 'NOKIA', 6, '2025-02-14', 241],
          [13, 'drivers license', 7, '2021-01-08', 242],
          [14, 'vampire', 7, '2023-06-30', 219],
        ],
      },
      {
        name: 'Streams',
        columns: [
          { name: 'stream_id', type: 'number', key: 'pk' },
          { name: 'song_id', type: 'number', key: 'fk', ref: 'Songs' },
          { name: 'stream_date', type: 'date' },
          { name: 'stream_count', type: 'number' },
        ],
        rows: [
          [1, 1, '2026-03-02', 2150000],
          [2, 5, '2026-03-02', 1980000],
          [3, 3, '2026-03-05', 1420000],
          [4, 9, '2026-03-05', 1310000],
          [5, 2, '2026-03-09', 1760000],
          [6, 7, '2026-03-09', 1120000],
          [7, 12, '2026-03-12', 1650000],
          [8, 13, '2026-03-12', 890000],
          [9, 6, '2026-03-16', 1540000],
          [10, 1, '2026-03-16', 2040000],
          [11, 4, '2026-03-20', 1230000],
          [12, 10, '2026-03-20', 1180000],
          [13, 11, '2026-03-24', 970000],
          [14, 14, '2026-03-24', 1060000],
          [15, 5, '2026-03-28', 1870000],
          [16, 3, '2026-03-28', 1390000],
          [17, 1, '2026-04-02', 1920000],
          [18, 6, '2026-04-02', 1610000],
          [19, 9, '2026-04-06', 1270000],
          [20, 12, '2026-04-06', 1580000],
          [21, 7, '2026-04-10', 1090000],
          [22, 2, '2026-04-10', 1700000],
          [23, 14, '2026-04-14', 1150000],
          [24, 13, '2026-04-14', 840000],
        ],
      },
    ],
    questions: [
      {
        text: 'Which artist had the most total streams in March 2026?',
        recipe: {
          start: 'Streams',
          steps: [
            { op: 'filter', column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31' },
            { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' },
            { op: 'join', table: 'Artists', leftColumn: 'artist_id', rightColumn: 'artist_id' },
            { op: 'aggregate', groupBy: ['artist_name'], summaries: [{ fn: 'total', column: 'stream_count' }] },
          ],
        },
      },
      {
        text: 'What are the titles and release dates of all Latin songs?',
        recipe: {
          start: 'Songs',
          steps: [
            { op: 'join', table: 'Artists', leftColumn: 'artist_id', rightColumn: 'artist_id' },
            { op: 'filter', column: 'genre', condition: 'is', value: 'Latin' },
            { op: 'project', columns: ['song_title', 'release_date'] },
          ],
        },
      },
      {
        text: 'How many songs does each artist have?',
        note: 'Is anyone missing? Why?',
        recipe: {
          start: 'Artists',
          steps: [
            { op: 'join', table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' },
            { op: 'aggregate', groupBy: ['artist_name'], summaries: [{ fn: 'count' }] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
```

- [ ] **Step 4: Run all tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 44 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/test/helpers.js tools/query-explorer/test/datasets.test.js tools/query-explorer/src/datasets/01-spotify.js
git commit -m "Query Explorer: add data set validator and Spotify Streams data"
```

---

## How to write data sets 2–10 (Tasks 8–10)

Each data set file uses exactly the wrapper from `01-spotify.js`: the IIFE, the `dataset` object, and the export lines. Only `id`, `name`, `description`, `start`, `tables`, and `questions` change. The tasks below give the exact `columns` and `questions` for each data set. Write those as shown, then fill in `rows` following that data set's **Row requirements** and these rules:

- Primary keys count up from 1 in each table.
- **Real names, made-up numbers.** Use real artists, series, movies, NFL players and teams, and colleges where the task says so. Use invented names for private people (students, viewers, managers, gamers, small creators). Double-check that real release dates are correct. Every number is invented, but keep it believable.
- Nothing crude or mean. These are for a college class.
- Hint values must exist in the rows. For example, if a hint filters `ticket_type` is `VIP`, some rows must be `VIP`. The validator in Task 7 fails any hint that errors or returns zero rows, and it's the gate for every data set task.
- After each file, run `node --test tools/query-explorer/test/datasets.test.js` and fix anything it reports.

---

### Task 8: Data sets 2–4 (Concert Tour, Netflix Binge, Thundering Herd Basketball)

**Files:**
- Create: `tools/query-explorer/src/datasets/02-concert.js`
- Create: `tools/query-explorer/src/datasets/03-netflix.js`
- Create: `tools/query-explorer/src/datasets/04-basketball.js`
- Test: `tools/query-explorer/test/datasets.test.js` (existing)

**Interfaces:**
- Consumes: the data set file pattern from Task 7.

- [ ] **Step 1: Write `02-concert.js`**

`id: 'concert'`, `name: 'Concert Tour'`, `description: 'Venues · Shows · TicketSales'`, `start: 'TicketSales'`.

```js
    tables: [
      { name: 'Venues', columns: [
        { name: 'venue_id', type: 'number', key: 'pk' },
        { name: 'venue_name', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'capacity', type: 'number' },
      ], rows: [] },
      { name: 'Shows', columns: [
        { name: 'show_id', type: 'number', key: 'pk' },
        { name: 'venue_id', type: 'number', key: 'fk', ref: 'Venues' },
        { name: 'artist_name', type: 'text' },
        { name: 'show_date', type: 'date' },
      ], rows: [] },
      { name: 'TicketSales', columns: [
        { name: 'sale_id', type: 'number', key: 'pk' },
        { name: 'show_id', type: 'number', key: 'fk', ref: 'Shows' },
        { name: 'ticket_type', type: 'text' },
        { name: 'quantity', type: 'number' },
        { name: 'price_each', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'How many tickets were sold in each city?', recipe: { start: 'TicketSales', steps: [
        { op: 'join', table: 'Shows', leftColumn: 'show_id', rightColumn: 'show_id' },
        { op: 'join', table: 'Venues', leftColumn: 'venue_id', rightColumn: 'venue_id' },
        { op: 'aggregate', groupBy: ['city'], summaries: [{ fn: 'total', column: 'quantity' }] },
      ] } },
      { text: 'Which shows sold VIP tickets priced above $300?', recipe: { start: 'TicketSales', steps: [
        { op: 'filter', column: 'ticket_type', condition: 'is', value: 'VIP' },
        { op: 'filter', column: 'price_each', condition: 'more_than', value: '300' },
        { op: 'join', table: 'Shows', leftColumn: 'show_id', rightColumn: 'show_id' },
        { op: 'project', columns: ['artist_name', 'show_date', 'price_each'] },
      ] } },
      { text: 'What is the average ticket price for each ticket type?', recipe: { start: 'TicketSales', steps: [
        { op: 'aggregate', groupBy: ['ticket_type'], summaries: [{ fn: 'average', column: 'price_each' }] },
      ] } },
    ],
```

**Row requirements:**
- **Venues:** 8 real venues in at least 6 cities. Include Mountain Health Arena (Huntington, WV). At least one venue has no shows (for example, Red Rocks Amphitheatre in Morrison, CO).
- **Shows:** 10–12 rows from June to August 2026. Use real touring artists, such as Sabrina Carpenter, Morgan Wallen, Billie Eilish, Post Malone, Tyler, The Creator, Chappell Roan, and Zach Bryan.
- **TicketSales:** 22–25 rows. `ticket_type` is exactly `GA`, `Floor`, or `VIP`.
  - Price ranges: GA $60–150, Floor $150–300, VIP $250–600.
  - At least 3 VIP rows priced over 300 and at least 1 VIP row at 300 or less.
  - `quantity` is 50–2,000.

- [ ] **Step 2: Write `03-netflix.js`**

`id: 'netflix'`, `name: 'Netflix Binge'`, `description: 'Series · Episodes · ViewingSessions'`, `start: 'ViewingSessions'`.

```js
    tables: [
      { name: 'Series', columns: [
        { name: 'series_id', type: 'number', key: 'pk' },
        { name: 'series_title', type: 'text' },
        { name: 'genre', type: 'text' },
        { name: 'release_year', type: 'number', plain: true },
      ], rows: [] },
      { name: 'Episodes', columns: [
        { name: 'episode_id', type: 'number', key: 'pk' },
        { name: 'series_id', type: 'number', key: 'fk', ref: 'Series' },
        { name: 'season', type: 'number', plain: true },
        { name: 'episode_number', type: 'number', plain: true },
        { name: 'runtime_min', type: 'number' },
      ], rows: [] },
      { name: 'ViewingSessions', columns: [
        { name: 'session_id', type: 'number', key: 'pk' },
        { name: 'episode_id', type: 'number', key: 'fk', ref: 'Episodes' },
        { name: 'viewer_name', type: 'text' },
        { name: 'watch_date', type: 'date' },
        { name: 'minutes_watched', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'How many total minutes were watched for each series?', recipe: { start: 'ViewingSessions', steps: [
        { op: 'join', table: 'Episodes', leftColumn: 'episode_id', rightColumn: 'episode_id' },
        { op: 'join', table: 'Series', leftColumn: 'series_id', rightColumn: 'series_id' },
        { op: 'aggregate', groupBy: ['series_title'], summaries: [{ fn: 'total', column: 'minutes_watched' }] },
      ] } },
      { text: 'What did Jordan watch in February 2026?', recipe: { start: 'ViewingSessions', steps: [
        { op: 'filter', column: 'viewer_name', condition: 'is', value: 'Jordan' },
        { op: 'filter', column: 'watch_date', condition: 'between', value: '2026-02-01', value2: '2026-02-28' },
        { op: 'join', table: 'Episodes', leftColumn: 'episode_id', rightColumn: 'episode_id' },
        { op: 'join', table: 'Series', leftColumn: 'series_id', rightColumn: 'series_id' },
        { op: 'project', columns: ['series_title', 'season', 'episode_number', 'watch_date'] },
      ] } },
      { text: 'What is the average episode runtime for each genre?', recipe: { start: 'Episodes', steps: [
        { op: 'join', table: 'Series', leftColumn: 'series_id', rightColumn: 'series_id' },
        { op: 'aggregate', groupBy: ['genre'], summaries: [{ fn: 'average', column: 'runtime_min' }] },
      ] } },
    ],
```

**Row requirements:**
- **Series:** 8 real Netflix series with their real first-season year: Stranger Things (2016), Wednesday (2022), Squid Game (2021), Bridgerton (2020), Outer Banks (2020), Cobra Kai (2018), Ginny & Georgia (2021), Adolescence (2025). Use 4–5 genres, so that at least two series share a genre.
- **Episodes:** 16–20 rows, about 2 per series. Runtimes 30–80 minutes. At least one episode has no viewing sessions.
- **ViewingSessions:** 24–25 rows from January to March 2026. Use 5 invented first-name viewers, including `Jordan`. Jordan has at least 3 sessions in February 2026. Each session's `minutes_watched` is no more than that episode's runtime.

- [ ] **Step 3: Write `04-basketball.js`**

`id: 'basketball'`, `name: 'Thundering Herd Basketball'`, `description: 'Players · Games · BoxScores'`, `start: 'BoxScores'`.

```js
    tables: [
      { name: 'Players', columns: [
        { name: 'player_id', type: 'number', key: 'pk' },
        { name: 'player_name', type: 'text' },
        { name: 'position', type: 'text' },
        { name: 'class_year', type: 'text' },
        { name: 'jersey_number', type: 'number', plain: true },
      ], rows: [] },
      { name: 'Games', columns: [
        { name: 'game_id', type: 'number', key: 'pk' },
        { name: 'opponent', type: 'text' },
        { name: 'game_date', type: 'date' },
        { name: 'home_away', type: 'text' },
        { name: 'result', type: 'text' },
      ], rows: [] },
      { name: 'BoxScores', columns: [
        { name: 'box_id', type: 'number', key: 'pk' },
        { name: 'game_id', type: 'number', key: 'fk', ref: 'Games' },
        { name: 'player_id', type: 'number', key: 'fk', ref: 'Players' },
        { name: 'points', type: 'number' },
        { name: 'rebounds', type: 'number' },
        { name: 'assists', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'Who scored the most total points this season?', recipe: { start: 'BoxScores', steps: [
        { op: 'join', table: 'Players', leftColumn: 'player_id', rightColumn: 'player_id' },
        { op: 'aggregate', groupBy: ['player_name'], summaries: [{ fn: 'total', column: 'points' }] },
      ] } },
      { text: 'What is the average number of points for each position in home games?', recipe: { start: 'BoxScores', steps: [
        { op: 'join', table: 'Games', leftColumn: 'game_id', rightColumn: 'game_id' },
        { op: 'filter', column: 'home_away', condition: 'is', value: 'Home' },
        { op: 'join', table: 'Players', leftColumn: 'player_id', rightColumn: 'player_id' },
        { op: 'aggregate', groupBy: ['position'], summaries: [{ fn: 'average', column: 'points' }] },
      ] } },
      { text: 'In the games the Herd won, which players scored 20 or more points?', recipe: { start: 'BoxScores', steps: [
        { op: 'filter', column: 'points', condition: 'at_least', value: '20' },
        { op: 'join', table: 'Games', leftColumn: 'game_id', rightColumn: 'game_id' },
        { op: 'filter', column: 'result', condition: 'is', value: 'W' },
        { op: 'join', table: 'Players', leftColumn: 'player_id', rightColumn: 'player_id' },
        { op: 'project', columns: ['player_name', 'opponent', 'points'] },
      ] } },
    ],
```

**Row requirements:**
- **Players:** 10 invented names. `position` is `Guard`, `Forward`, or `Center`. `class_year` is `Freshman`, `Sophomore`, `Junior`, `Senior`, or `Redshirt Freshman`. Include one Redshirt Freshman with no box scores.
- **Games:** 8 games, January to February 2026, against real Sun Belt schools (App State, Georgia Southern, Old Dominion, James Madison, Coastal Carolina, Texas State, Arkansas State, Troy). `home_away` is `Home` or `Away`, at least 3 of each. `result` is `W` or `L`, at least 4 wins.
- **BoxScores:** 24–25 rows, about 3 players per game. Points 0–32. At least 3 rows have 20+ points in games the Herd won. Every box score uses a game and player that exist.

- [ ] **Step 4: Run the data set tests**

Run: `node --test tools/query-explorer/test/datasets.test.js`
Expected: PASS, 21 tests (1 + 5 for each of the 4 data sets)

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/datasets/02-concert.js tools/query-explorer/src/datasets/03-netflix.js tools/query-explorer/src/datasets/04-basketball.js
git commit -m "Query Explorer: add Concert Tour, Netflix Binge, and basketball data sets"
```

---

### Task 9: Data sets 5–7 (Campus Dining, Fantasy Football League, Box Office Weekend)

**Files:**
- Create: `tools/query-explorer/src/datasets/05-dining.js`
- Create: `tools/query-explorer/src/datasets/06-fantasy.js`
- Create: `tools/query-explorer/src/datasets/07-boxoffice.js`

**Interfaces:**
- Consumes: the data set file pattern from Task 7.

- [ ] **Step 1: Write `05-dining.js`**

`id: 'dining'`, `name: 'Campus Dining'`, `description: 'Students · DiningHalls · MealSwipes'`, `start: 'MealSwipes'`.

```js
    tables: [
      { name: 'Students', columns: [
        { name: 'student_id', type: 'number', key: 'pk' },
        { name: 'first_name', type: 'text' },
        { name: 'meal_plan', type: 'text' },
        { name: 'residence_hall', type: 'text' },
      ], rows: [] },
      { name: 'DiningHalls', columns: [
        { name: 'hall_id', type: 'number', key: 'pk' },
        { name: 'hall_name', type: 'text' },
        { name: 'campus_area', type: 'text' },
        { name: 'seats', type: 'number' },
      ], rows: [] },
      { name: 'MealSwipes', columns: [
        { name: 'swipe_id', type: 'number', key: 'pk' },
        { name: 'student_id', type: 'number', key: 'fk', ref: 'Students' },
        { name: 'hall_id', type: 'number', key: 'fk', ref: 'DiningHalls' },
        { name: 'swipe_date', type: 'date' },
        { name: 'meal_period', type: 'text' },
      ], rows: [] },
    ],
    questions: [
      { text: 'Which dining hall gets the most swipes at dinner?', recipe: { start: 'MealSwipes', steps: [
        { op: 'filter', column: 'meal_period', condition: 'is', value: 'Dinner' },
        { op: 'join', table: 'DiningHalls', leftColumn: 'hall_id', rightColumn: 'hall_id' },
        { op: 'aggregate', groupBy: ['hall_name'], summaries: [{ fn: 'count' }] },
      ] } },
      { text: 'How many swipes came from each meal plan?', recipe: { start: 'MealSwipes', steps: [
        { op: 'join', table: 'Students', leftColumn: 'student_id', rightColumn: 'student_id' },
        { op: 'aggregate', groupBy: ['meal_plan'], summaries: [{ fn: 'count' }] },
      ] } },
      { text: 'Who ate late-night meals, and where?', recipe: { start: 'MealSwipes', steps: [
        { op: 'filter', column: 'meal_period', condition: 'is', value: 'Late Night' },
        { op: 'join', table: 'Students', leftColumn: 'student_id', rightColumn: 'student_id' },
        { op: 'join', table: 'DiningHalls', leftColumn: 'hall_id', rightColumn: 'hall_id' },
        { op: 'project', columns: ['first_name', 'hall_name', 'swipe_date'] },
      ] } },
    ],
```

The spec listed DiningHalls with only `hall_name` and `campus_area`. `seats` (number) is added so this data set has a number column, which the validator requires.

**Row requirements:**
- **Students:** 10 invented first names. `meal_plan` is `Unlimited`, `14 per week`, or `Block 100`. Include one commuter student with no swipes.
- **DiningHalls:** 8 invented dining spots, such as "Herd Commons" and "Late Night @ the Union". Include at least one spot with no swipes, if possible.
- **MealSwipes:** 25 rows in February 2026. `meal_period` is `Breakfast`, `Lunch`, `Dinner`, or `Late Night`. At least 6 Dinner swipes spread over 3+ halls, and at least 3 Late Night swipes.

- [ ] **Step 2: Write `06-fantasy.js`**

`id: 'fantasy'`, `name: 'Fantasy Football League'`, `description: 'FantasyTeams · NFLPlayers · WeeklyPoints'`, `start: 'WeeklyPoints'`.

```js
    tables: [
      { name: 'FantasyTeams', columns: [
        { name: 'team_id', type: 'number', key: 'pk' },
        { name: 'team_name', type: 'text' },
        { name: 'manager_name', type: 'text' },
      ], rows: [] },
      { name: 'NFLPlayers', columns: [
        { name: 'player_id', type: 'number', key: 'pk' },
        { name: 'player_name', type: 'text' },
        { name: 'position', type: 'text' },
        { name: 'nfl_team', type: 'text' },
        { name: 'team_id', type: 'number', key: 'fk', ref: 'FantasyTeams' },
      ], rows: [] },
      { name: 'WeeklyPoints', columns: [
        { name: 'points_id', type: 'number', key: 'pk' },
        { name: 'player_id', type: 'number', key: 'fk', ref: 'NFLPlayers' },
        { name: 'week', type: 'number', plain: true },
        { name: 'game_date', type: 'date' },
        { name: 'fantasy_points', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'Which fantasy team scored the most total points?', recipe: { start: 'WeeklyPoints', steps: [
        { op: 'join', table: 'NFLPlayers', leftColumn: 'player_id', rightColumn: 'player_id' },
        { op: 'join', table: 'FantasyTeams', leftColumn: 'team_id', rightColumn: 'team_id' },
        { op: 'aggregate', groupBy: ['team_name'], summaries: [{ fn: 'total', column: 'fantasy_points' }] },
      ] } },
      { text: 'Which players had a week with 25 or more points?', recipe: { start: 'WeeklyPoints', steps: [
        { op: 'filter', column: 'fantasy_points', condition: 'at_least', value: '25' },
        { op: 'join', table: 'NFLPlayers', leftColumn: 'player_id', rightColumn: 'player_id' },
        { op: 'project', columns: ['player_name', 'week', 'fantasy_points'] },
      ] } },
      { text: 'What is the average weekly score for each position?', recipe: { start: 'WeeklyPoints', steps: [
        { op: 'join', table: 'NFLPlayers', leftColumn: 'player_id', rightColumn: 'player_id' },
        { op: 'aggregate', groupBy: ['position'], summaries: [{ fn: 'average', column: 'fantasy_points' }] },
      ] } },
    ],
```

**Row requirements:**
- **FantasyTeams:** 8 teams with invented, clean, pun-style names (for example, "Mahomes Alone" or "Bijan Mustard") and invented manager first names.
- **NFLPlayers:** 13 real players with their real position and NFL team from the 2025 season. Examples: Patrick Mahomes, Josh Allen, Lamar Jackson, Saquon Barkley, Bijan Robinson, Derrick Henry, Jahmyr Gibbs, Ja'Marr Chase, Justin Jefferson, CeeDee Lamb, Puka Nacua, Travis Kelce, and Christian McCaffrey.
  - `position` is `QB`, `RB`, `WR`, or `TE`.
  - Every fantasy team has at least 1 player.
  - One player (for example, McCaffrey, listed as injured) has no points rows.
- **WeeklyPoints:** 24 rows: 12 players × weeks 1–2. Week 1 `game_date` is `2026-09-13` and week 2 is `2026-09-20`. Points 2.0–38.0 with one decimal. At least 3 rows are 25+.

- [ ] **Step 3: Write `07-boxoffice.js`**

`id: 'boxoffice'`, `name: 'Box Office Weekend'`, `description: 'Studios · Movies · WeekendGrosses'`, `start: 'WeekendGrosses'`.

```js
    tables: [
      { name: 'Studios', columns: [
        { name: 'studio_id', type: 'number', key: 'pk' },
        { name: 'studio_name', type: 'text' },
        { name: 'headquarters', type: 'text' },
      ], rows: [] },
      { name: 'Movies', columns: [
        { name: 'movie_id', type: 'number', key: 'pk' },
        { name: 'movie_title', type: 'text' },
        { name: 'studio_id', type: 'number', key: 'fk', ref: 'Studios' },
        { name: 'genre', type: 'text' },
        { name: 'rating', type: 'text' },
        { name: 'release_date', type: 'date' },
      ], rows: [] },
      { name: 'WeekendGrosses', columns: [
        { name: 'gross_id', type: 'number', key: 'pk' },
        { name: 'movie_id', type: 'number', key: 'fk', ref: 'Movies' },
        { name: 'weekend_date', type: 'date' },
        { name: 'gross_millions', type: 'number' },
        { name: 'theaters', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'How much did each studio earn in total?', recipe: { start: 'WeekendGrosses', steps: [
        { op: 'join', table: 'Movies', leftColumn: 'movie_id', rightColumn: 'movie_id' },
        { op: 'join', table: 'Studios', leftColumn: 'studio_id', rightColumn: 'studio_id' },
        { op: 'aggregate', groupBy: ['studio_name'], summaries: [{ fn: 'total', column: 'gross_millions' }] },
      ] } },
      { text: 'Which PG-13 movies had a weekend over $50 million?', recipe: { start: 'WeekendGrosses', steps: [
        { op: 'filter', column: 'gross_millions', condition: 'more_than', value: '50' },
        { op: 'join', table: 'Movies', leftColumn: 'movie_id', rightColumn: 'movie_id' },
        { op: 'filter', column: 'rating', condition: 'is', value: 'PG-13' },
        { op: 'project', columns: ['movie_title', 'weekend_date', 'gross_millions'] },
      ] } },
      { text: "What was each movie's best weekend?", recipe: { start: 'WeekendGrosses', steps: [
        { op: 'join', table: 'Movies', leftColumn: 'movie_id', rightColumn: 'movie_id' },
        { op: 'aggregate', groupBy: ['movie_title'], summaries: [{ fn: 'highest', column: 'gross_millions' }] },
      ] } },
    ],
```

**Row requirements:**
- **Studios:** 8 rows: Warner Bros. (Burbank, CA), Disney (Burbank, CA), Universal (Universal City, CA), Paramount (Hollywood, CA), Sony Pictures (Culver City, CA), Lionsgate (Santa Monica, CA), A24 (New York, NY), Neon (New York, NY). Lionsgate, A24, and Neon have no movies.
- **Movies:** these 10 real 2025 films. Check each release date before committing.

| Film | Studio | Rating | Release date |
|---|---|---|---|
| A Minecraft Movie | Warner Bros. | PG | 2025-04-04 |
| Sinners | Warner Bros. | R | 2025-04-18 |
| Lilo & Stitch | Disney | PG | 2025-05-23 |
| Mission: Impossible – The Final Reckoning | Paramount | PG-13 | 2025-05-23 |
| How to Train Your Dragon | Universal | PG | 2025-06-13 |
| 28 Years Later | Sony Pictures | R | 2025-06-20 |
| Jurassic World Rebirth | Universal | PG-13 | 2025-07-02 |
| Superman | Warner Bros. | PG-13 | 2025-07-11 |
| The Fantastic Four: First Steps | Disney | PG-13 | 2025-07-25 |
| Weapons | Warner Bros. | R | 2025-08-08 |

- **WeekendGrosses:** 20–25 rows, 2–3 weekends per film. `weekend_date` is the Friday of that weekend, starting with the release weekend. Grosses drop each weekend. Use one decimal, from 5.0 to 170.0. At least 3 PG-13 rows over 50.

- [ ] **Step 4: Run the data set tests**

Run: `node --test tools/query-explorer/test/datasets.test.js`
Expected: PASS, 36 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer/src/datasets/05-dining.js tools/query-explorer/src/datasets/06-fantasy.js tools/query-explorer/src/datasets/07-boxoffice.js
git commit -m "Query Explorer: add Campus Dining, Fantasy Football, and Box Office data sets"
```

---

### Task 10: Data sets 8–10 (Esports Tournament, TikTok Creators & Memes, Music Festival Lineup)

**Files:**
- Create: `tools/query-explorer/src/datasets/08-esports.js`
- Create: `tools/query-explorer/src/datasets/09-tiktok.js`
- Create: `tools/query-explorer/src/datasets/10-festival.js`
- Modify: `tools/query-explorer/test/datasets.test.js` (add the count check)

**Interfaces:**
- Consumes: the data set file pattern from Task 7.

- [ ] **Step 1: Add the failing count check**

Add to `datasets.test.js`, right after the `data set ids are unique` test:

```js
test('there are exactly 10 data sets', () => {
  assert.equal(DATASETS.length, 10);
});
```

Run: `node --test tools/query-explorer/test/datasets.test.js`
Expected: FAIL with `7 !== 10`

- [ ] **Step 2: Write `08-esports.js`**

`id: 'esports'`, `name: 'Esports Tournament'`, `description: 'Teams · Gamers · MatchStats'`, `start: 'MatchStats'`.

```js
    tables: [
      { name: 'Teams', columns: [
        { name: 'team_id', type: 'number', key: 'pk' },
        { name: 'team_name', type: 'text' },
        { name: 'region', type: 'text' },
      ], rows: [] },
      { name: 'Gamers', columns: [
        { name: 'gamer_id', type: 'number', key: 'pk' },
        { name: 'gamertag', type: 'text' },
        { name: 'team_id', type: 'number', key: 'fk', ref: 'Teams' },
        { name: 'role', type: 'text' },
      ], rows: [] },
      { name: 'MatchStats', columns: [
        { name: 'stat_id', type: 'number', key: 'pk' },
        { name: 'gamer_id', type: 'number', key: 'fk', ref: 'Gamers' },
        { name: 'match_date', type: 'date' },
        { name: 'map_name', type: 'text' },
        { name: 'kills', type: 'number' },
        { name: 'deaths', type: 'number' },
        { name: 'assists', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'Which team got the most total kills?', recipe: { start: 'MatchStats', steps: [
        { op: 'join', table: 'Gamers', leftColumn: 'gamer_id', rightColumn: 'gamer_id' },
        { op: 'join', table: 'Teams', leftColumn: 'team_id', rightColumn: 'team_id' },
        { op: 'aggregate', groupBy: ['team_name'], summaries: [{ fn: 'total', column: 'kills' }] },
      ] } },
      { text: 'Which gamers had 20 or more kills in a match?', recipe: { start: 'MatchStats', steps: [
        { op: 'filter', column: 'kills', condition: 'at_least', value: '20' },
        { op: 'join', table: 'Gamers', leftColumn: 'gamer_id', rightColumn: 'gamer_id' },
        { op: 'project', columns: ['gamertag', 'map_name', 'kills'] },
      ] } },
      { text: 'What is the average number of assists for each role?', recipe: { start: 'MatchStats', steps: [
        { op: 'join', table: 'Gamers', leftColumn: 'gamer_id', rightColumn: 'gamer_id' },
        { op: 'aggregate', groupBy: ['role'], summaries: [{ fn: 'average', column: 'assists' }] },
      ] } },
    ],
```

**Row requirements:**
- **Teams:** 8 invented college-club team names, such as "Herd Esports" and "Ridge Runners GG". `region` is `East`, `West`, `South`, or `Midwest`.
- **Gamers:** 17 invented, clean gamertags, 2 per team plus 1 substitute. `role` is `Duelist`, `Controller`, `Sentinel`, or `Initiator`. The substitute has no match stats.
- **MatchStats:** 25 rows on 2026-03-07 and 2026-03-08. `map_name` is a real Valorant map: Ascent, Bind, Haven, Lotus, Split, or Sunset. Kills 4–28, deaths 5–22, assists 1–15. At least 3 rows have 20+ kills.

- [ ] **Step 3: Write `09-tiktok.js`**

`id: 'tiktok'`, `name: 'TikTok Creators & Memes'`, `description: 'Creators · Videos · DailyViews'`, `start: 'DailyViews'`.

```js
    tables: [
      { name: 'Creators', columns: [
        { name: 'creator_id', type: 'number', key: 'pk' },
        { name: 'handle', type: 'text' },
        { name: 'niche', type: 'text' },
        { name: 'follower_count', type: 'number' },
      ], rows: [] },
      { name: 'Videos', columns: [
        { name: 'video_id', type: 'number', key: 'pk' },
        { name: 'creator_id', type: 'number', key: 'fk', ref: 'Creators' },
        { name: 'caption', type: 'text' },
        { name: 'meme_format', type: 'text' },
        { name: 'post_date', type: 'date' },
      ], rows: [] },
      { name: 'DailyViews', columns: [
        { name: 'view_id', type: 'number', key: 'pk' },
        { name: 'video_id', type: 'number', key: 'fk', ref: 'Videos' },
        { name: 'view_date', type: 'date' },
        { name: 'views', type: 'number' },
        { name: 'likes', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'Which meme format gets the most views?', recipe: { start: 'DailyViews', steps: [
        { op: 'join', table: 'Videos', leftColumn: 'video_id', rightColumn: 'video_id' },
        { op: 'aggregate', groupBy: ['meme_format'], summaries: [{ fn: 'total', column: 'views' }] },
      ] } },
      { text: 'How many total likes did each creator get?', recipe: { start: 'DailyViews', steps: [
        { op: 'join', table: 'Videos', leftColumn: 'video_id', rightColumn: 'video_id' },
        { op: 'join', table: 'Creators', leftColumn: 'creator_id', rightColumn: 'creator_id' },
        { op: 'aggregate', groupBy: ['handle'], summaries: [{ fn: 'total', column: 'likes' }] },
      ] } },
      { text: 'What did comedy creators post in the first half of April 2026?', recipe: { start: 'Videos', steps: [
        { op: 'filter', column: 'post_date', condition: 'between', value: '2026-04-01', value2: '2026-04-15' },
        { op: 'join', table: 'Creators', leftColumn: 'creator_id', rightColumn: 'creator_id' },
        { op: 'filter', column: 'niche', condition: 'is', value: 'Comedy' },
        { op: 'project', columns: ['handle', 'caption', 'post_date'] },
      ] } },
    ],
```

**Row requirements:**
- **Creators:** 8 invented handles starting with `@`, such as `@dormroomchef`. `niche` is `Comedy`, `Dance`, `Food`, or `Gaming`, with at least 2 Comedy creators. Followers 2,000–900,000. One creator has no videos.
- **Videos:** 12 rows in April 2026 with short, clean captions. `meme_format` is `POV`, `Get Ready With Me`, `Day in the Life`, `Duet`, `Storytime`, or `Tutorial`. At least 2 Comedy creators' videos are posted April 1–15.
- **DailyViews:** 25 rows. Each `view_date` is on or after its video's `post_date`. Views 1,000–2,500,000. Likes 3–15% of views.

- [ ] **Step 4: Write `10-festival.js`**

`id: 'festival'`, `name: 'Music Festival Lineup'`, `description: 'Stages · Acts · SetTimes'`, `start: 'SetTimes'`.

```js
    tables: [
      { name: 'Stages', columns: [
        { name: 'stage_id', type: 'number', key: 'pk' },
        { name: 'stage_name', type: 'text' },
        { name: 'stage_capacity', type: 'number' },
      ], rows: [] },
      { name: 'Acts', columns: [
        { name: 'act_id', type: 'number', key: 'pk' },
        { name: 'act_name', type: 'text' },
        { name: 'genre', type: 'text' },
        { name: 'headliner', type: 'text' },
      ], rows: [] },
      { name: 'SetTimes', columns: [
        { name: 'set_id', type: 'number', key: 'pk' },
        { name: 'act_id', type: 'number', key: 'fk', ref: 'Acts' },
        { name: 'stage_id', type: 'number', key: 'fk', ref: 'Stages' },
        { name: 'festival_date', type: 'date' },
        { name: 'set_length_min', type: 'number' },
      ], rows: [] },
    ],
    questions: [
      { text: 'How many minutes of music does each stage host?', recipe: { start: 'SetTimes', steps: [
        { op: 'join', table: 'Stages', leftColumn: 'stage_id', rightColumn: 'stage_id' },
        { op: 'aggregate', groupBy: ['stage_name'], summaries: [{ fn: 'total', column: 'set_length_min' }] },
      ] } },
      { text: 'Which acts play the Main Stage on Saturday?', recipe: { start: 'SetTimes', steps: [
        { op: 'filter', column: 'festival_date', condition: 'on', value: '2026-04-11' },
        { op: 'join', table: 'Stages', leftColumn: 'stage_id', rightColumn: 'stage_id' },
        { op: 'filter', column: 'stage_name', condition: 'is', value: 'Main Stage' },
        { op: 'join', table: 'Acts', leftColumn: 'act_id', rightColumn: 'act_id' },
        { op: 'project', columns: ['act_name', 'set_length_min'] },
      ] } },
      { text: 'How many headliners play each day?', recipe: { start: 'SetTimes', steps: [
        { op: 'join', table: 'Acts', leftColumn: 'act_id', rightColumn: 'act_id' },
        { op: 'filter', column: 'headliner', condition: 'is', value: 'Yes' },
        { op: 'aggregate', groupBy: ['festival_date'], summaries: [{ fn: 'count' }] },
      ] } },
    ],
```

**Row requirements:**
- **Stages:** 8 invented stages: `Main Stage`, `Sahara Tent`, `Riverside Stage`, `Garden Stage`, `The Dome`, `Lakeside Stage`, `Forest Stage`, `Pier Stage`. Capacity 1,500–60,000.
- **Acts:** 15 real artists, such as Sabrina Carpenter, Tyler, The Creator, Chappell Roan, Fred again.., Billie Eilish, Charli xcx, Zach Bryan, Doja Cat, Tems, Gracie Abrams, Benson Boone, Kaytranada, Remi Wolf, and Djo. `headliner` is `Yes` for 3–4 acts and `No` for the rest. One act (not a headliner) has no set yet.
- **SetTimes:** 14 rows, one per scheduled act. `festival_date` is `2026-04-10`, `2026-04-11`, or `2026-04-12`. Main Stage has at least 2 sets on 2026-04-11. Headliners play on at least 2 different days. Set lengths 45–105 minutes.

- [ ] **Step 5: Run the data set tests**

Run: `node --test tools/query-explorer/test/datasets.test.js`
Expected: PASS, 52 tests

- [ ] **Step 6: Commit**

```bash
git add tools/query-explorer/src/datasets/08-esports.js tools/query-explorer/src/datasets/09-tiktok.js tools/query-explorer/src/datasets/10-festival.js tools/query-explorer/test/datasets.test.js
git commit -m "Query Explorer: add Esports, TikTok, and Music Festival data sets"
```

---

### Task 11: Page shell, styles, DOM helpers, table view, and build script

**Files:**
- Create: `tools/query-explorer/src/index.html`
- Create: `tools/query-explorer/src/styles.css`
- Create: `tools/query-explorer/src/dom.js`
- Create: `tools/query-explorer/src/table-view.js`
- Create: `tools/query-explorer/build.js`
- Test: `tools/query-explorer/test/build.test.js`

**Interfaces:**
- Consumes: `parseRich`, `formatValue` (describe).
- Produces:
  - `h(tag, attrs, ...children) → Element`. Attrs: `class`; `on<event>` listeners; boolean `true` sets an empty attribute; `false`, `null`, and `undefined` are skipped. Children arrays are flattened.
  - `rich(str) → (Node|string)[]`
  - `renderTable(table, opts) → div.table-wrap`. Opts: `rowClass(i)`, `colClass(name)`, `rowTag(i) → Node|null`, `rowKey(i)`, `afterRow(i) → tr[]`, `emptyMessage`, `wrapClass`.
  - `sizeText(table) → '4 rows × 3 columns'`
  - `renderCounter(before, after) → p.counter`
  - `build() → outPath`; `SCRIPT_ORDER` (array; later tasks insert into it).

- [ ] **Step 1: Write the failing build test**

`tools/query-explorer/test/build.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { build } = require('../build.js');
const { loadDatasets } = require('./helpers.js');

test('build makes one self-contained HTML file', () => {
  const out = build();
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(!html.includes('INLINE_CSS') && !html.includes('INLINE_JS'), 'markers are replaced');
  assert.ok(!/<script[^>]+src=/.test(html), 'no external scripts');
  assert.ok(html.includes('--teal:#117c70'), 'styles are inlined');
  for (const ds of loadDatasets()) assert.ok(html.includes(`name: '${ds.name}'`) || html.includes(`name: "${ds.name}"`), `${ds.name} is inlined`);
  assert.ok(html.indexOf('---- engine.js') < html.indexOf('---- datasets/01-spotify.js'), 'engine loads before data');
});
```

Run: `node --test tools/query-explorer/test/build.test.js`
Expected: FAIL with `Cannot find module '../build.js'`

- [ ] **Step 2: Write `build.js`**

`tools/query-explorer/build.js`:

```js
// Combines src/ into one self-contained file: dist/query-explorer.html
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'dist', 'query-explorer.html');

// Load order matters: each file reads what earlier files put on window.QE.
const SCRIPT_ORDER = ['engine.js', 'describe.js', 'visual.js', 'DATASETS', 'dom.js', 'table-view.js'];

function datasetFiles() {
  return fs.readdirSync(path.join(SRC, 'datasets')).filter(f => f.endsWith('.js')).sort().map(f => `datasets/${f}`);
}

function build() {
  const files = SCRIPT_ORDER.flatMap(f => (f === 'DATASETS' ? datasetFiles() : [f]));
  const js = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  if (/<\/script/i.test(js)) throw new Error('A source file contains "</script", which would break the page.');
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8')
    .replace('/* INLINE_CSS */', () => css)
    .replace('// INLINE_JS', () => js);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return OUT;
}

if (require.main === module) console.log('Built ' + build());
module.exports = { build, OUT, SCRIPT_ORDER };
```

- [ ] **Step 3: Write `index.html`**

`tools/query-explorer/src/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Query Explorer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Nunito+Sans:wght@300;400;600;700;800&display=swap">
<style>
/* INLINE_CSS */
</style>
</head>
<body>
<div id="app"></div>
<noscript>This tool needs JavaScript turned on.</noscript>
<script>
// INLINE_JS
</script>
</body>
</html>
```

- [ ] **Step 4: Write `styles.css`**

`tools/query-explorer/src/styles.css`:

```css
:root{
  --bg:#FFFDFB; --card:#f7f7f6; --card-2:#efece6; --line:#e5e2da;
  --ink:#121417; --body:#2b2e33; --muted:#6f6357;
  --teal:#117c70; --teal-soft:#e3efec; --teal-ink:#0c5850;
  --amber:#a15c00; --amber-soft:#fbeed9; --amber-ink:#7a4600;
  --indigo:#4d4f8f; --indigo-soft:#e7e7f5; --indigo-ink:#37395f;
  --rose:#a24a63; --rose-soft:#f6e5ea; --rose-ink:#7a374a;
  --good:#166b45; --good-soft:#e0f2e8;
  --bad:#b3261e; --bad-soft:#fbe4e2;
  --warn:#a15c00; --warn-soft:#fbeed9;
  --radius:14px;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#18191b; --card:#212327; --card-2:#26282d; --line:#34373d;
    --ink:#f2f1ee; --body:#d7d4cd; --muted:#a8a296;
    --teal:#3fc1af; --teal-soft:rgba(63,193,175,.14); --teal-ink:#8fe3d6;
    --amber:#e3a13d; --amber-soft:rgba(227,161,61,.14); --amber-ink:#f0bd6f;
    --indigo:#9497e0; --indigo-soft:rgba(148,151,224,.16); --indigo-ink:#b6b8ec;
    --rose:#e28aa0; --rose-soft:rgba(226,138,160,.16); --rose-ink:#eeb0bf;
    --good:#5cd196; --good-soft:rgba(92,209,150,.14);
    --bad:#f2897f; --bad-soft:rgba(242,137,127,.16);
    --warn:#e3a13d; --warn-soft:rgba(227,161,61,.14);
  }
}
:root[data-theme="dark"]{
  --bg:#18191b; --card:#212327; --card-2:#26282d; --line:#34373d;
  --ink:#f2f1ee; --body:#d7d4cd; --muted:#a8a296;
  --teal:#3fc1af; --teal-soft:rgba(63,193,175,.14); --teal-ink:#8fe3d6;
  --amber:#e3a13d; --amber-soft:rgba(227,161,61,.14); --amber-ink:#f0bd6f;
  --indigo:#9497e0; --indigo-soft:rgba(148,151,224,.16); --indigo-ink:#b6b8ec;
  --rose:#e28aa0; --rose-soft:rgba(226,138,160,.16); --rose-ink:#eeb0bf;
  --good:#5cd196; --good-soft:rgba(92,209,150,.14);
  --bad:#f2897f; --bad-soft:rgba(242,137,127,.16);
  --warn:#e3a13d; --warn-soft:rgba(227,161,61,.14);
}

*{box-sizing:border-box;}
body{margin:0; background:var(--bg); color:var(--body); font-family:'Nunito Sans',system-ui,sans-serif; font-size:16px; line-height:1.5;}
h1,h2,h3{font-family:'Montserrat',system-ui,sans-serif; color:var(--ink); margin:0;}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.88em; background:var(--card-2); color:var(--ink); padding:.05em .35em; border-radius:4px;}
button,select,input{font:inherit; color:inherit;}
:focus-visible{outline:3px solid var(--indigo); outline-offset:2px;}
.sr-only{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap;}
select,input[type=text],input[type=number],input[type=date]{background:var(--card); border:1px solid var(--line); border-radius:8px; padding:6px 10px; max-width:100%;}
input[type=checkbox]{accent-color:var(--teal); width:16px; height:16px;}

/* header */
.top{padding:20px 24px 14px; border-bottom:1px solid var(--line);}
.top-row{display:flex; flex-wrap:wrap; align-items:center; gap:12px 20px;}
.top h1{font-weight:300; font-size:1.8rem; letter-spacing:-.01em;}
.picker{display:flex; align-items:center; gap:8px;}
.picker label{font-family:'Montserrat',sans-serif; font-weight:600; font-size:.75rem; text-transform:uppercase; letter-spacing:.12em; color:var(--muted);}
.picker select{font-weight:700;}
.motion{margin-left:auto; display:flex; align-items:center; gap:6px; font-size:.92rem;}
.subline{margin:6px 0 0; color:var(--body);}
.note{color:var(--muted); font-size:.88rem;}
details.try{margin-top:12px; max-width:920px; background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:10px 14px;}
details.try summary{cursor:pointer; font-family:'Montserrat',sans-serif; font-weight:600; color:var(--ink);}
.try ol{margin:10px 0 4px; padding-left:1.4em;}
.try li{margin-bottom:10px;}
.hint{margin:6px 0 0; padding:8px 12px; background:var(--teal-soft); border-left:4px solid var(--teal); border-radius:6px;}

/* buttons */
.btn{border:1px solid var(--line); background:var(--card); border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:600;}
.btn:hover{background:var(--card-2);}
.btn.primary{background:var(--teal); border-color:var(--teal); color:#fff;}
.btn.primary:disabled{opacity:.45; cursor:not-allowed;}
.btn.small{padding:3px 9px; font-size:.85rem;}

/* layout */
.layout{display:grid; grid-template-columns:minmax(300px,390px) minmax(0,1fr); gap:24px; padding:20px 24px 60px; align-items:start;}
.recipe h2,.result h2{font-size:.78rem; text-transform:uppercase; letter-spacing:.14em; color:var(--muted); font-weight:600; margin-bottom:10px;}

/* recipe */
.steps{list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:8px;}
.step{background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px 12px;}
.step.selected{border-color:var(--teal); box-shadow:0 0 0 2px var(--teal-soft);}
.step.off .step-main{opacity:.55;}
.step-main{display:flex; gap:10px; align-items:flex-start; width:100%; text-align:left; background:none; border:0; padding:0; cursor:pointer;}
.step-num{flex:none; width:26px; height:26px; border-radius:50%; border:0; background:var(--card-2); display:grid; place-items:center; font-family:'Montserrat',sans-serif; font-weight:700; font-size:.8rem; color:var(--ink); cursor:pointer;}
.step-op{display:flex; align-items:center; gap:5px; font-family:'Montserrat',sans-serif; font-weight:600; font-size:.72rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted);}
.step-text{display:block;}
.step-tools{display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; padding-left:36px;}
.warn-badge{display:block; margin:8px 0 0 36px; padding:6px 10px; background:var(--warn-soft); color:var(--amber-ink); border-radius:6px; font-size:.9rem;}
.ops{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
.op-btn{display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border-radius:10px; border:1px solid var(--line); background:var(--card); font-family:'Montserrat',sans-serif; font-weight:600; color:var(--ink); cursor:pointer;}
.op-btn:hover{background:var(--teal-soft); border-color:var(--teal);}
.icon{width:16px; height:16px; flex:none;}
.editor{margin-top:10px; padding:10px 0 0 36px; border-top:1px dashed var(--line); display:flex; flex-direction:column; gap:10px;}
.editor .row{display:flex; flex-wrap:wrap; align-items:center; gap:8px;}
.editor fieldset{border:1px solid var(--line); border-radius:8px; padding:8px 10px; margin:0;}
.editor legend{font-size:.85rem; color:var(--muted); padding:0 4px;}
.checks{display:flex; flex-direction:column; gap:4px; max-height:220px; overflow:auto;}
.checks label{display:flex; align-items:center; gap:6px;}
.reason{font-size:.88rem; color:var(--muted); margin:0;}
.suggested{font-size:.82rem; color:var(--good); font-weight:700;}

/* result */
.tabs{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;}
.tab{border:1px solid var(--line); background:var(--card); border-radius:999px; padding:4px 12px; cursor:pointer; font-size:.9rem;}
.tab[aria-selected="true"]{background:var(--ink); color:var(--bg); border-color:var(--ink);}
.counter-row{display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin-bottom:10px;}
.counter{margin:0; font-family:'Montserrat',sans-serif; color:var(--muted);}
.counter strong{color:var(--ink);}
.alert{margin:0 0 10px; padding:8px 12px; border-radius:8px; background:var(--warn-soft); color:var(--amber-ink);}
.alert.bad{background:var(--bad-soft); color:var(--bad);}
.table-wrap{overflow:auto; max-height:70vh; border:1px solid var(--line); border-radius:10px; background:var(--bg);}
table.data{border-collapse:collapse; width:max-content; min-width:100%; font-size:.92rem;}
table.data th{position:sticky; top:0; z-index:1; background:var(--card-2); color:var(--ink); text-align:left; padding:8px 12px; border-bottom:1px solid var(--line); white-space:nowrap;}
table.data td{padding:6px 12px; border-bottom:1px solid var(--line); white-space:nowrap; transition:background-color .6s, opacity .4s, padding .4s, font-size .4s, line-height .4s;}
table.data .num{text-align:right; font-variant-numeric:tabular-nums;}
table.data td.empty{text-align:center; color:var(--muted); padding:24px; white-space:normal;}
.badge{font-size:.8em; margin-left:4px;}
.tag{display:inline-block; font-size:.72rem; font-weight:700; padding:1px 7px; border-radius:999px; margin-right:6px; background:var(--card-2); color:var(--ink); text-decoration:none;}

/* highlight and animation states */
tr.keep td{background:var(--good-soft);}
tr.drop td{background:var(--bad-soft); color:var(--bad); text-decoration:line-through;}
tr.collapse td{padding-top:0; padding-bottom:0; font-size:0; line-height:0; opacity:0; border-bottom-width:0;}
.col-drop{background:var(--card-2) !important; color:var(--muted) !important; text-decoration:line-through;}
.col-collapse{font-size:0 !important; padding-left:0 !important; padding-right:0 !important; opacity:0;}
tr.nomatch td{outline:2px dashed var(--bad); outline-offset:-2px;}
tr.fade td{opacity:.15;}
tr.c0 td{background:var(--teal-soft);}
tr.c1 td{background:var(--amber-soft);}
tr.c2 td{background:var(--indigo-soft);}
tr.c3 td{background:var(--rose-soft);}
tr.c4 td{background:var(--good-soft);}
.table-wrap:not(.highlight) tr.hl td{background:transparent; transition:background-color 1.2s;}
.join-stage{display:grid; grid-template-columns:1fr 1fr; gap:12px;}
.join-stage h3{font-size:.85rem; margin:0 0 6px;}
.join-stage .right{transition:transform .5s, opacity .5s;}
.join-stage.merge .right{transform:translateX(-40px); opacity:.35;}
tr.detail > td{background:var(--card); padding:6px 12px 10px 32px;}
tr.detail .table-wrap{max-height:none; opacity:.8;}
.reduce-motion table.data td{transition:background-color 1.2s;}
.reduce-motion .join-stage .right{transition:none;}

@media (max-width:900px){
  .top{padding:16px;}
  .layout{grid-template-columns:1fr; padding:16px;}
  .motion{margin-left:0;}
  .join-stage{grid-template-columns:1fr;}
}
```

`--muted` is darkened from the splitter's `#8b7e71` to `#6f6357` in light mode and `#a8a296` in dark mode, so small text meets WCAG AA contrast.

- [ ] **Step 5: Write `dom.js`**

`tools/query-explorer/src/dom.js`:

```js
// Query Explorer: tiny DOM helpers. Never uses innerHTML.
(function (root) {
  'use strict';
  const QE = root.QE;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : String(c));
    }
    return el;
  }

  function rich(str) {
    return QE.parseRich(str).map(p => (p.kind === 'strong' ? h('strong', null, p.text) : p.kind === 'code' ? h('code', null, p.text) : p.text));
  }

  const ICON_PATHS = {
    filter: 'M3 4h18l-7 9v6l-4 2v-8z',
    project: 'M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z',
    join: 'M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6l-1.5 1.5M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6l1.5-1.5',
    aggregate: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  };

  function icon(op) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICON_PATHS[op]);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  root.QE = Object.assign(QE, { h, rich, icon });
})(this);
```

- [ ] **Step 6: Write `table-view.js`**

`tools/query-explorer/src/table-view.js`:

```js
// Query Explorer: draws a table and the size counter.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h } = QE;

  function keyBadge(col) {
    if (col.key === 'pk') return h('span', { class: 'badge', title: 'Primary key', 'aria-label': 'primary key' }, '🔑');
    if (col.key === 'fk') return h('span', { class: 'badge', title: `Foreign key to ${col.ref}`, 'aria-label': `foreign key to ${col.ref}` }, '🔗');
    return null;
  }

  function cls(...names) {
    const s = names.filter(Boolean).join(' ');
    return s || null;
  }

  function renderTable(table, opts = {}) {
    const colClass = name => (opts.colClass ? opts.colClass(name) : null);
    const head = h('tr', null, table.columns.map(c =>
      h('th', { scope: 'col', class: cls(c.type === 'number' && 'num', colClass(c.name)) }, h('code', null, c.name), keyBadge(c))));
    const body = [];
    table.rows.forEach((row, i) => {
      body.push(h('tr', { class: opts.rowClass ? opts.rowClass(i) : null, 'data-row': String(opts.rowKey ? opts.rowKey(i) : i) },
        table.columns.map((c, ci) => h('td', { class: cls(c.type === 'number' && 'num', colClass(c.name)) },
          ci === 0 && opts.rowTag ? opts.rowTag(i) : null,
          QE.formatValue(row[c.name], c)))));
      if (opts.afterRow) body.push(...opts.afterRow(i));
    });
    if (!table.rows.length) {
      body.push(h('tr', null, h('td', { class: 'empty', colspan: String(Math.max(1, table.columns.length)) }, opts.emptyMessage || 'No rows.')));
    }
    return h('div', { class: cls('table-wrap', opts.wrapClass) },
      h('table', { class: 'data' }, h('thead', null, head), h('tbody', null, body)));
  }

  function sizeText(t) {
    const r = t.rows.length;
    const c = t.columns.length;
    return `${r.toLocaleString('en-US')} ${r === 1 ? 'row' : 'rows'} × ${c} ${c === 1 ? 'column' : 'columns'}`;
  }

  function renderCounter(before, after) {
    if (!before) return h('p', { class: 'counter' }, h('strong', null, sizeText(after)));
    return h('p', { class: 'counter', 'aria-live': 'polite' },
      sizeText(before), h('span', { 'aria-hidden': 'true' }, ' → '), h('span', { class: 'sr-only' }, ' becomes '), h('strong', null, sizeText(after)));
  }

  root.QE = Object.assign(QE, { renderTable, sizeText, renderCounter });
})(this);
```

- [ ] **Step 7: Run all tests**

Run: `node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 91 tests

- [ ] **Step 8: Commit**

```bash
git add tools/query-explorer/build.js tools/query-explorer/src/index.html tools/query-explorer/src/styles.css tools/query-explorer/src/dom.js tools/query-explorer/src/table-view.js tools/query-explorer/test/build.test.js tools/query-explorer/dist/query-explorer.html
git commit -m "Query Explorer: add page shell, styles, table view, and build script"
```

---

### Task 12: Recipe panel, step editors, and the app

**Files:**
- Create: `tools/query-explorer/src/recipe-view.js`
- Create: `tools/query-explorer/src/app.js`
- Modify: `tools/query-explorer/build.js` (`SCRIPT_ORDER`)

**Interfaces:**
- Consumes: everything on `window.QE` from Tasks 1–11, and `window.QE_DATASETS`.
- Produces:
  - `newDraft(op, inputTable) → Step`
  - `renderRecipePanel(ctx) → section`, where `ctx = { state, dataset, results, actions }`
  - In `app.js`: `state`, `actions`, `render()`, and `finalTable(d, results, i, highlight)`, which Task 13 calls.

- [ ] **Step 1: Write `recipe-view.js`**

`tools/query-explorer/src/recipe-view.js`:

```js
// Query Explorer: the recipe panel (step cards and step editors).
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, rich, icon } = QE;

  const OPS = [
    { op: 'filter', label: 'Filter' },
    { op: 'project', label: 'Project' },
    { op: 'join', label: 'Join' },
    { op: 'aggregate', label: 'Aggregate' },
  ];
  const opLabel = op => OPS.find(o => o.op === op).label;

  function newDraft(op, input) {
    if (op === 'filter') return { op, column: '', condition: '', value: '', value2: '', values: [] };
    if (op === 'project') return { op, columns: input.columns.map(c => c.name) };
    if (op === 'join') return { op, table: '', leftColumn: '', rightColumn: '', cartesian: false };
    return { op, groupBy: [], summaries: [{ fn: 'count', column: '' }] };
  }

  function select(key, value, options, onchange, label, disabled) {
    return h('select', { 'data-focus-key': key, 'aria-label': label, disabled: !!disabled, onchange: e => onchange(e.target.value) },
      h('option', { value: '', disabled: true, selected: value === '' }, 'Choose…'),
      options.map(o => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  }

  function distinct(input, name) {
    return [...new Set(input.rows.map(r => r[name]))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  // Typing in a box updates the draft without redrawing, so the cursor stays put.
  function liveUpdate(ctx, input, patch) {
    Object.assign(ctx.state.draft, patch);
    const reason = QE.incompleteReason(ctx.state.draft, input);
    const btn = document.getElementById('apply-btn');
    if (btn) btn.disabled = !!reason;
    const note = document.getElementById('apply-reason');
    if (note) note.textContent = reason || '';
  }

  function onEnter(ctx, input) {
    return e => {
      if (e.key === 'Enter' && !QE.incompleteReason(ctx.state.draft, input)) ctx.actions.applyDraft();
    };
  }

  function valueControl(d, col, input, ctx) {
    const { actions } = ctx;
    if (col.type === 'text' && d.condition === 'is_one_of') {
      return h('fieldset', null, h('legend', null, 'Pick one or more'), h('div', { class: 'checks' },
        distinct(input, col.name).map(v => h('label', null,
          h('input', { type: 'checkbox', 'data-focus-key': 'f-one-' + v, checked: d.values.includes(v),
            onchange: e => actions.updateDraft({ values: e.target.checked ? [...d.values, v] : d.values.filter(x => x !== v) }) }),
          v))));
    }
    if (col.type === 'text' && d.condition === 'contains') {
      return h('div', { class: 'row' }, h('input', { type: 'text', 'data-focus-key': 'f-val', 'aria-label': 'Text to look for', value: d.value,
        oninput: e => liveUpdate(ctx, input, { value: e.target.value }), onkeydown: onEnter(ctx, input) }));
    }
    if (col.type === 'text') {
      return h('div', { class: 'row' }, select('f-val', d.value, distinct(input, col.name).map(v => ({ value: v, label: v })), v => actions.updateDraft({ value: v }), 'Value'));
    }
    const type = col.type === 'number' ? 'number' : 'date';
    const box = (key, field, label) => h('input', { type, 'data-focus-key': key, 'aria-label': label, value: d[field],
      oninput: e => liveUpdate(ctx, input, { [field]: e.target.value }), onkeydown: onEnter(ctx, input) });
    return d.condition === 'between'
      ? h('div', { class: 'row' }, box('f-val', 'value', 'From'), 'and', box('f-val2', 'value2', 'To'))
      : h('div', { class: 'row' }, box('f-val', 'value', 'Value'));
  }

  function filterEditor(d, input, ctx) {
    const { actions } = ctx;
    const col = QE.getColumn(input, d.column);
    const parts = [h('div', { class: 'row' }, 'Keep only rows where',
      select('f-col', d.column, input.columns.map(c => ({ value: c.name, label: c.name })), v => {
        const type = QE.getColumn(input, v).type;
        actions.updateDraft({ column: v, condition: QE.CONDITIONS[type][0].id, value: '', value2: '', values: [] });
      }, 'Column'),
      col ? select('f-cond', d.condition, QE.CONDITIONS[col.type].map(c => ({ value: c.id, label: c.label })),
        v => actions.updateDraft({ condition: v, value: '', value2: '', values: [] }), 'Condition') : null)];
    if (col && d.condition) parts.push(valueControl(d, col, input, ctx));
    return parts;
  }

  function checkList(legend, input, chosen, keyPrefix, onchange) {
    return h('fieldset', null, h('legend', null, legend), h('div', { class: 'checks' },
      input.columns.map(c => h('label', null,
        h('input', { type: 'checkbox', 'data-focus-key': keyPrefix + c.name, checked: chosen.includes(c.name),
          onchange: e => onchange(input.columns.map(x => x.name).filter(n => (n === c.name ? e.target.checked : chosen.includes(n)))) }),
        h('code', null, c.name)))));
  }

  function projectEditor(d, input, { actions }) {
    return checkList('Keep only these columns', input, d.columns, 'p-', columns => actions.updateDraft({ columns }));
  }

  function joinEditor(d, input, { dataset, actions }) {
    const choices = dataset.tables.filter(t => !input.sources.includes(t.name));
    const parts = [h('div', { class: 'row' }, 'Combine with',
      choices.length
        ? select('j-table', d.table, choices.map(t => ({ value: t.name, label: t.name })), v => {
          const s = QE.suggestJoinKey(input, QE.loadTable(QE.findTableDef(dataset, v)));
          actions.updateDraft({ table: v, leftColumn: s ? s.leftColumn : '', rightColumn: s ? s.rightColumn : '', cartesian: false });
        }, 'Table')
        : h('span', { class: 'reason' }, 'Every table in this data set is already part of the table.'))];
    if (!d.table) return parts;
    const other = QE.loadTable(QE.findTableDef(dataset, d.table));
    const s = QE.suggestJoinKey(input, other);
    const left = QE.getColumn(input, d.leftColumn);
    const isSuggested = s && !d.cartesian && s.leftColumn === d.leftColumn && s.rightColumn === d.rightColumn;
    parts.push(h('div', { class: 'row' }, 'matching',
      select('j-left', d.leftColumn, input.columns.map(c => ({ value: c.name, label: c.name })), v => {
        const type = QE.getColumn(input, v).type;
        const keepRight = other.columns.some(c => c.name === d.rightColumn && c.type === type);
        actions.updateDraft({ leftColumn: v, rightColumn: keepRight ? d.rightColumn : '' });
      }, 'Column in the current table', d.cartesian),
      'equals',
      select('j-right', d.rightColumn, other.columns.filter(c => !left || c.type === left.type).map(c => ({ value: c.name, label: c.name })),
        v => actions.updateDraft({ rightColumn: v }), `Column in ${d.table}`, d.cartesian),
      isSuggested ? h('span', { class: 'suggested' }, '✓ suggested') : null));
    if (!s) parts.push(h('p', { class: 'reason' }, "These tables don't share a key."));
    parts.push(h('label', null,
      h('input', { type: 'checkbox', 'data-focus-key': 'j-cart', checked: d.cartesian, onchange: e => actions.updateDraft({ cartesian: e.target.checked }) }),
      " Don't match on anything"));
    return parts;
  }

  function aggregateEditor(d, input, { actions }) {
    const setSummaries = summaries => actions.updateDraft({ summaries });
    return [
      checkList('Group by (leave all unchecked to summarize the whole table)', input, d.groupBy, 'g-', groupBy => actions.updateDraft({ groupBy })),
      h('fieldset', null, h('legend', null, 'Calculate'),
        d.summaries.map((s, i) => {
          const fn = QE.SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
          const cols = input.columns.filter(c => fn.types.includes(c.type));
          return h('div', { class: 'row' },
            select('s-fn-' + i, s.fn, QE.SUMMARY_FUNCTIONS.map(f => ({ value: f.id, label: f.label })), v => {
              const next = QE.SUMMARY_FUNCTIONS.find(f => f.id === v);
              const keep = input.columns.some(c => c.name === s.column && next.types.includes(c.type));
              setSummaries(d.summaries.map((x, j) => (j === i ? { fn: v, column: keep ? s.column : '' } : x)));
            }, 'Calculation'),
            s.fn === 'count' ? null : ['of', select('s-col-' + i, s.column, cols.map(c => ({ value: c.name, label: c.name })),
              v => setSummaries(d.summaries.map((x, j) => (j === i ? { ...x, column: v } : x))), 'Column')],
            d.summaries.length > 1
              ? h('button', { class: 'btn small', type: 'button', 'data-focus-key': 's-del-' + i, 'aria-label': 'Remove this calculation',
                onclick: () => setSummaries(d.summaries.filter((_, j) => j !== i)) }, '✕')
              : null);
        }),
        d.summaries.length < 3
          ? h('button', { class: 'btn small', type: 'button', 'data-focus-key': 's-add', onclick: () => setSummaries([...d.summaries, { fn: 'count', column: '' }]) }, '+ Add a calculation')
          : null),
    ];
  }

  const EDITORS = { filter: filterEditor, project: projectEditor, join: joinEditor, aggregate: aggregateEditor };

  function editor(ctx, input) {
    const { state, actions } = ctx;
    const reason = QE.incompleteReason(state.draft, input);
    return h('div', { class: 'editor' },
      EDITORS[state.draft.op](state.draft, input, ctx),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', id: 'apply-btn', 'data-focus-key': 'apply', disabled: !!reason, onclick: actions.applyDraft }, 'Apply'),
        h('button', { class: 'btn', type: 'button', 'data-focus-key': 'cancel', onclick: actions.cancelDraft }, 'Cancel'),
        h('span', { class: 'reason', id: 'apply-reason', 'aria-live': 'polite' }, reason || '')));
  }

  function startCard({ state, dataset, actions }) {
    return h('li', { class: 'step' + (state.selected === 0 ? ' selected' : '') },
      h('div', { class: 'step-main' },
        h('button', { class: 'step-num', type: 'button', 'data-focus-key': 'step-0', 'aria-label': 'Show the starting table', onclick: () => actions.selectStep(0) }, '0'),
        h('span', null,
          h('span', { class: 'step-op' }, 'Start'),
          h('label', { class: 'step-text' }, 'Start with ',
            h('select', { 'data-focus-key': 'start', onchange: e => actions.setStart(e.target.value) },
              dataset.tables.map(t => h('option', { value: t.name, selected: t.name === state.recipe.start }, t.name)))))));
  }

  function stepCard(ctx, step, n) {
    const { state, results, actions } = ctx;
    const r = results[n];
    const input = results[n - 1].table;
    const off = step.on === false;
    return h('li', { class: ['step', state.selected === n ? 'selected' : '', off ? 'off' : ''].join(' ') },
      h('button', { class: 'step-main', type: 'button', 'data-focus-key': 'step-' + n, 'aria-pressed': String(state.selected === n), onclick: () => actions.selectStep(n) },
        h('span', { class: 'step-num' }, String(n)),
        h('span', null,
          h('span', { class: 'step-op' }, icon(step.op), opLabel(step.op), off ? ' (turned off)' : ''),
          h('span', { class: 'step-text' }, rich(QE.describeStep(step, input))))),
      r.status === 'invalid' ? h('span', { class: 'warn-badge', role: 'note' }, '⚠ ', rich(r.message)) : null,
      state.editing === n
        ? editor(ctx, input)
        : h('div', { class: 'step-tools' },
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'edit-' + n, onclick: () => actions.editStep(n) }, 'Edit'),
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'toggle-' + n, onclick: () => actions.toggleStep(n) }, off ? 'Turn on' : 'Turn off'),
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'delete-' + n, onclick: () => actions.deleteStep(n) }, 'Delete')));
  }

  function newCard(ctx) {
    const { state, results } = ctx;
    const n = state.recipe.steps.length + 1;
    return h('li', { class: 'step selected' },
      h('div', { class: 'step-main' },
        h('span', { class: 'step-num' }, String(n)),
        h('span', null, h('span', { class: 'step-op' }, icon(state.draft.op), 'New ' + opLabel(state.draft.op).toLowerCase() + ' step'))),
      editor(ctx, results[results.length - 1].table));
  }

  function renderRecipePanel(ctx) {
    const { state, actions } = ctx;
    const items = [startCard(ctx)];
    state.recipe.steps.forEach((step, k) => items.push(stepCard(ctx, step, k + 1)));
    if (state.editing === 'new') items.push(newCard(ctx));
    return h('section', { class: 'recipe', 'aria-label': 'Recipe' },
      h('h2', null, 'Recipe'),
      h('ol', { class: 'steps' }, items),
      h('div', { class: 'ops', role: 'group', 'aria-label': 'Add a step' },
        OPS.map(o => h('button', { class: 'op-btn', type: 'button', 'data-focus-key': 'add-' + o.op, onclick: () => actions.addStep(o.op) }, icon(o.op), o.label))));
  }

  root.QE = Object.assign(QE, { newDraft, renderRecipePanel });
})(this);
```

- [ ] **Step 2: Write `app.js`**

`tools/query-explorer/src/app.js`:

```js
// Query Explorer: app state, actions, and the main render.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, rich } = QE;
  const DATASETS = root.QE_DATASETS || [];
  const appEl = document.getElementById('app');

  let nextId = 1;
  let animToken = 0;
  const reducedByDefault = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const state = {
    datasetId: DATASETS[0].id,
    recipe: { start: DATASETS[0].start, steps: [] },
    selected: 0,
    editing: null, // null | 'new' | step number
    draft: null,
    view: 'result', // 'result' | a table name
    reduceMotion: reducedByDefault,
    showCollapsed: false,
    tryOpen: false,
    openHints: new Set(),
    animate: null, // step number to animate after the next render
    focus: null, // data-focus-key to focus after the next render
  };

  const dataset = () => DATASETS.find(d => d.id === state.datasetId);

  const actions = {
    setDataset(id) {
      if (state.recipe.steps.length && !root.confirm('Switching data sets clears your recipe. Continue?')) { render(); return; }
      const d = DATASETS.find(x => x.id === id);
      Object.assign(state, { datasetId: id, recipe: { start: d.start, steps: [] }, selected: 0, editing: null, draft: null, view: 'result', showCollapsed: false, openHints: new Set() });
      render();
    },
    setStart(name) {
      Object.assign(state, { selected: 0, editing: null, draft: null, view: 'result' });
      state.recipe.start = name;
      render();
    },
    selectStep(n) { state.selected = n; state.view = 'result'; render(); },
    addStep(op) {
      const results = QE.runRecipe(dataset(), state.recipe);
      state.draft = QE.newDraft(op, results[results.length - 1].table);
      state.editing = 'new';
      render();
    },
    editStep(n) {
      state.draft = JSON.parse(JSON.stringify(state.recipe.steps[n - 1]));
      state.editing = n;
      render();
    },
    updateDraft(patch) { Object.assign(state.draft, patch); render(); },
    applyDraft() {
      const steps = state.recipe.steps;
      let n;
      if (state.editing === 'new') {
        steps.push({ ...state.draft, id: nextId++, on: true });
        n = steps.length;
      } else {
        n = state.editing;
        steps[n - 1] = { ...state.draft, id: steps[n - 1].id, on: steps[n - 1].on };
      }
      Object.assign(state, { editing: null, draft: null, selected: n, view: 'result', animate: n, focus: 'step-' + n });
      render();
    },
    cancelDraft() { state.editing = null; state.draft = null; render(); },
    toggleStep(n) {
      const step = state.recipe.steps[n - 1];
      step.on = step.on === false;
      state.selected = n;
      render();
    },
    deleteStep(n) {
      state.recipe.steps.splice(n - 1, 1);
      if (state.selected >= n) state.selected = Math.max(0, state.selected - 1);
      if (typeof state.editing === 'number') { state.editing = null; state.draft = null; }
      state.focus = 'add-filter';
      render();
    },
    setView(v) { state.view = v; render(); },
    toggleHint(key) {
      if (state.openHints.has(key)) state.openHints.delete(key);
      else state.openHints.add(key);
      render();
    },
    setReduceMotion(on) { state.reduceMotion = on; render(); },
    setShowCollapsed(on) { state.showCollapsed = on; render(); },
    replay() { state.animate = state.selected; render(); },
  };

  function tryThis(d) {
    return h('details', { class: 'try', open: state.tryOpen, ontoggle: e => { state.tryOpen = e.target.open; } },
      h('summary', null, `Try this (${d.questions.length} questions)`),
      h('ol', null, d.questions.map((q, i) => {
        const key = d.id + ':' + i;
        const open = state.openHints.has(key);
        return h('li', null, q.text, ' ',
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'hint-' + i, 'aria-expanded': String(open), onclick: () => actions.toggleHint(key) }, open ? 'Hide hint' : 'Show hint'),
          open ? h('p', { class: 'hint' }, rich(QE.describeRecipe(d, q.recipe).join(' → ')), q.note ? ' ' + q.note : '') : null);
      })));
  }

  function header(d) {
    return h('header', { class: 'top' },
      h('div', { class: 'top-row' },
        h('h1', null, 'Query Explorer'),
        h('div', { class: 'picker' },
          h('label', { for: 'dataset' }, 'Data set'),
          h('select', { id: 'dataset', 'data-focus-key': 'dataset', onchange: e => actions.setDataset(e.target.value) },
            DATASETS.map(x => h('option', { value: x.id, selected: x.id === d.id }, x.name)))),
        h('label', { class: 'motion' },
          h('input', { type: 'checkbox', 'data-focus-key': 'motion', checked: state.reduceMotion, onchange: e => actions.setReduceMotion(e.target.checked) }),
          'Reduce motion')),
      h('p', { class: 'subline' }, d.description, h('span', { class: 'note' }, ' · Real names, made-up numbers. All data is invented for practice.')),
      tryThis(d));
  }

  function emptyMessage(results, i) {
    let k = i;
    while (k > 0 && results[k - 1].table.rows.length === 0) k--;
    return k === 0 ? 'This table has no rows.' : `No rows left. Step ${k} removed them all. Try changing it.`;
  }

  function finalTable(d, results, i, highlight) {
    const r = results[i];
    const step = i > 0 ? state.recipe.steps[i - 1] : null;
    const ok = step && r.status === 'ok';
    const opts = { emptyMessage: emptyMessage(results, i) };
    if (highlight && ok) {
      const before = results[i - 1].table;
      const other = step.op === 'join' ? QE.loadTable(QE.findTableDef(d, step.table)) : null;
      const plan = QE.visualPlan(step, before, r, other);
      opts.rowClass = k => (plan.afterRows[k] ? 'hl ' + plan.afterRows[k] : null);
      opts.wrapClass = 'highlight';
    }
    if (ok && step.op === 'aggregate' && state.showCollapsed) {
      const before = results[i - 1].table;
      opts.afterRow = k => [h('tr', { class: 'detail' }, h('td', { colspan: String(r.table.columns.length) },
        QE.renderTable({ ...before, rows: r.trace.groups[k].map(j => before.rows[j]) }, { emptyMessage: 'No rows went into this summary.' })))];
    }
    const view = QE.renderTable(r.table, opts);
    if (opts.wrapClass) setTimeout(() => view.classList.remove('highlight'), 2000);
    return view;
  }

  function resultPanel(d, results) {
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'What to show' },
      [['result', 'Recipe result'], ...d.tables.map(t => [t.name, t.name])].map(([v, label]) =>
        h('button', { class: 'tab', role: 'tab', type: 'button', 'data-focus-key': 'tab-' + v, 'aria-selected': String(state.view === v), onclick: () => actions.setView(v) }, label)));
    const body = [];
    if (state.view !== 'result') {
      const t = QE.loadTable(QE.findTableDef(d, state.view));
      body.push(h('p', { class: 'counter' }, h('strong', null, QE.sizeText(t)), ` · the original ${t.name} table`),
        h('div', { id: 'table-holder' }, QE.renderTable(t)));
    } else {
      const i = state.selected;
      const r = results[i];
      const step = i > 0 ? state.recipe.steps[i - 1] : null;
      const ok = step && r.status === 'ok';
      body.push(h('div', { class: 'counter-row' },
        h('strong', null, `Step ${i}`),
        QE.renderCounter(ok ? results[i - 1].table : null, r.table),
        ok ? h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'replay', onclick: actions.replay }, '↻ Replay') : null,
        ok && step.op === 'aggregate'
          ? h('label', null, h('input', { type: 'checkbox', 'data-focus-key': 'collapsed', checked: state.showCollapsed, onchange: e => actions.setShowCollapsed(e.target.checked) }), ' Show what was collapsed')
          : null));
      if (r.status === 'off') body.push(h('p', { class: 'alert' }, 'This step is turned off, so the table is unchanged.'));
      if (r.status === 'invalid') body.push(h('p', { class: 'alert' }, '⚠ ', rich(r.message), ' This step was skipped.'));
      if (ok && r.trace.cartesian) body.push(h('p', { class: 'alert bad' }, 'Every row was paired with every other row. Most of these rows are meaningless.'));
      body.push(h('div', { id: 'table-holder' }, finalTable(d, results, i, false)));
    }
    return h('section', { class: 'result', 'aria-label': 'Result' }, h('h2', null, 'Result'), tabs, body);
  }

  function render() {
    animToken++;
    const active = document.activeElement;
    const focusKey = state.focus || (active && active.dataset ? active.dataset.focusKey : null);
    state.focus = null;
    const d = dataset();
    const results = QE.runRecipe(d, state.recipe);
    if (state.selected > results.length - 1) state.selected = results.length - 1;
    document.body.classList.toggle('reduce-motion', state.reduceMotion);
    appEl.replaceChildren(header(d), h('main', { class: 'layout' },
      QE.renderRecipePanel({ state, dataset: d, results, actions }),
      resultPanel(d, results)));
    if (focusKey) {
      const el = appEl.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (el) el.focus();
    }
    if (state.animate !== null) {
      const n = state.animate;
      state.animate = null;
      afterRender(d, results, n);
    }
  }

  // Task 13 replaces this with the animation player.
  function afterRender(d, results, n) {
    const holder = document.getElementById('table-holder');
    if (holder && state.view === 'result' && n > 0 && results[n].status === 'ok') holder.replaceChildren(finalTable(d, results, n, true));
  }

  render();
})(this);
```

- [ ] **Step 3: Add the new files to the build order**

In `build.js`, change `SCRIPT_ORDER` to:

```js
const SCRIPT_ORDER = ['engine.js', 'describe.js', 'visual.js', 'DATASETS', 'dom.js', 'table-view.js', 'recipe-view.js', 'app.js'];
```

- [ ] **Step 4: Build and run all tests**

Run: `node tools/query-explorer/build.js && node --test tools/query-explorer/test/*.test.js`
Expected: `Built …/dist/query-explorer.html`, then PASS, 91 tests

- [ ] **Step 5: Check it in the browser**

Open `tools/query-explorer/dist/query-explorer.html` in the built-in browser using `mcp__Claude_Browser__preview_start` with `url: file:///Users/david/Documents/Claude/Projects/Intro%20to%20DBs/tools/query-explorer/dist/query-explorer.html`. Then:

1. Check `read_console_messages` with `onlyErrors: true`. Expected: none.
2. Spotify Streams loads, step 0 shows `Streams`, and the counter reads "24 rows × 4 columns".
3. Build Spotify question 1 by hand: Filter, Join, Join, Aggregate. After each Apply, the counter changes. The final table shows Bad Bunny with 5,950,000 and Kendrick Lamar with 5,390,000. The step sentences match the hint text.
4. Add a Join to Artists starting from `Streams` (before Songs). Expected: "These tables don't share a key." Check "Don't match on anything": the red Cartesian warning appears and the counter shows 192 rows.
5. Add a Project that keeps every column, then an Aggregate with the total of `stream_count`. Edit the Project to uncheck `stream_count`: the Aggregate step shows the ⚠ badge. Turn the Project off and the badge clears.
6. Filter `stream_count` more than `99999999`, then Aggregate count with no group-by: one row with 0. With a group-by: the "No rows left. Step N removed them all" message.
7. Open Try this, click Show hint, and confirm the hint appears only after the click.
8. Switch data sets with steps in the recipe. A confirmation appears, and Cancel keeps the recipe.
9. Use only the keyboard (Tab, Space, Enter) to add and apply a Filter step.

Fix anything that fails before committing.

- [ ] **Step 6: Commit**

```bash
git add tools/query-explorer/src/recipe-view.js tools/query-explorer/src/app.js tools/query-explorer/build.js tools/query-explorer/dist/query-explorer.html
git commit -m "Query Explorer: add recipe panel, step editors, and app"
```

---

### Task 13: Animations

**Files:**
- Create: `tools/query-explorer/src/animate.js`
- Modify: `tools/query-explorer/src/app.js` (replace `afterRender`)
- Modify: `tools/query-explorer/build.js` (`SCRIPT_ORDER`)

**Interfaces:**
- Consumes: `h`, `renderTable`, `visualPlan`, `colorClass`, `loadTable`, `findTableDef`.
- Produces: `playStep(holder, { before, result, step, dataset, reduceMotion, isCurrent }) → Promise<boolean>`. It resolves `true` when the animation finishes, or `false` if a newer render took over. With `reduceMotion`, it resolves `true` right away.

- [ ] **Step 1: Write `animate.js`**

`tools/query-explorer/src/animate.js`:

```js
// Query Explorer: short animations that show what each step did.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, renderTable, visualPlan, colorClass } = QE;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Slide rows from their old spots to their new ones after `change` redraws them.
  function flip(holder, change) {
    const old = new Map();
    holder.querySelectorAll('tbody tr').forEach(tr => old.set(tr.dataset.row, tr.getBoundingClientRect().top));
    change();
    holder.querySelectorAll('tbody tr').forEach(tr => {
      const top = old.get(tr.dataset.row);
      if (top === undefined) return;
      const dy = top - tr.getBoundingClientRect().top;
      if (!dy) return;
      tr.style.transition = 'none';
      tr.style.transform = `translateY(${dy}px)`;
      tr.getBoundingClientRect();
      requestAnimationFrame(() => {
        tr.style.transition = 'transform .6s ease';
        tr.style.transform = '';
      });
    });
  }

  const PLAYERS = {
    filter(holder, before, plan) {
      return [
        [() => holder.replaceChildren(renderTable(before, {
          rowClass: i => plan.beforeRows[i],
          rowTag: i => (plan.beforeRows[i] === 'drop' ? h('span', { class: 'tag', 'aria-label': 'removed' }, '✕') : null),
        })), 700],
        [() => holder.querySelectorAll('tr.drop').forEach(tr => tr.classList.add('collapse')), 450],
      ];
    },

    project(holder, before, plan) {
      const dropped = new Set(plan.dropped);
      return [
        [() => holder.replaceChildren(renderTable(before, { colClass: name => (dropped.has(name) ? 'col-drop' : null) })), 700],
        [() => holder.querySelectorAll('.col-drop').forEach(el => el.classList.add('col-collapse')), 450],
      ];
    },

    join(holder, before, plan, other, step) {
      const tag = id => h('span', { class: 'tag' }, id === null ? 'no match — dropped' : '#' + (id + 1));
      const side = (title, table, match, cls) => h('div', { class: cls }, h('h3', null, title),
        renderTable(table, plan.cartesian ? {} : {
          rowClass: i => (match[i] === null ? 'nomatch' : colorClass(match[i])),
          rowTag: i => tag(match[i]),
        }));
      let stage;
      return [
        [() => {
          stage = h('div', { class: 'join-stage' }, side('Current table', before, plan.leftMatch, 'left'), side(step.table, other, plan.rightMatch, 'right'));
          holder.replaceChildren(stage);
        }, plan.cartesian ? 900 : 1100],
        [() => {
          stage.classList.add('merge');
          stage.querySelectorAll('tr.nomatch').forEach(tr => tr.classList.add('fade'));
        }, 500],
      ];
    },

    aggregate(holder, before, plan) {
      const view = order => renderTable({ ...before, rows: order.map(i => before.rows[i]) }, {
        rowKey: k => order[k],
        rowClass: k => colorClass(plan.rowGroup[order[k]]),
        rowTag: k => h('span', { class: 'tag' }, plan.labels[plan.rowGroup[order[k]]]),
      });
      const firsts = new Set(plan.order.filter((i, k) => k === 0 || plan.rowGroup[plan.order[k - 1]] !== plan.rowGroup[i]));
      return [
        [() => holder.replaceChildren(view(before.rows.map((_, i) => i))), 600],
        [() => flip(holder, () => holder.replaceChildren(view(plan.order))), 750],
        [() => holder.querySelectorAll('tbody tr').forEach(tr => { if (!firsts.has(Number(tr.dataset.row))) tr.classList.add('collapse'); }), 450],
      ];
    },
  };

  async function playStep(holder, { before, result, step, dataset, reduceMotion, isCurrent }) {
    if (reduceMotion) return true;
    const other = step.op === 'join' ? QE.loadTable(QE.findTableDef(dataset, step.table)) : null;
    const plan = visualPlan(step, before, result, other);
    const phases = PLAYERS[step.op](holder, before, plan, other, step);
    for (const [run, ms] of phases) {
      if (!isCurrent()) return false;
      run();
      await wait(ms);
    }
    return isCurrent();
  }

  root.QE = Object.assign(QE, { playStep });
})(this);
```

- [ ] **Step 2: Replace `afterRender` in `app.js`**

Replace the whole `afterRender` function (including its comment) with:

```js
  function afterRender(d, results, n) {
    const holder = document.getElementById('table-holder');
    if (!holder || state.view !== 'result' || n === 0 || results[n].status !== 'ok') return;
    const token = animToken;
    QE.playStep(holder, {
      before: results[n - 1].table,
      result: results[n],
      step: state.recipe.steps[n - 1],
      dataset: d,
      reduceMotion: state.reduceMotion,
      isCurrent: () => token === animToken,
    }).then(done => {
      if (done) holder.replaceChildren(finalTable(d, results, n, true));
    });
  }
```

- [ ] **Step 3: Add `animate.js` to the build order**

```js
const SCRIPT_ORDER = ['engine.js', 'describe.js', 'visual.js', 'DATASETS', 'dom.js', 'table-view.js', 'recipe-view.js', 'animate.js', 'app.js'];
```

- [ ] **Step 4: Build and run all tests**

Run: `node tools/query-explorer/build.js && node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 91 tests

- [ ] **Step 5: Check the animations in the browser**

Reload the page in the built-in browser, then check:

1. **Filter:** dropped rows turn red with ✕ and strikethrough, then collapse. Kept rows flash green. The final table keeps a green tint that fades after about 2 seconds.
2. **Project:** dropped columns gray out, get struck through, and close up.
3. **Join** (Streams → Songs): the two tables appear side by side with matching `#n` tags and colors. Saturn is outlined "no match — dropped" and fades. The right side slides left. The final rows have color bands that fade.
4. **Aggregate:** rows get group tints and labels, slide together by group, then fold to one row per group.
5. **Replay** replays the animation. Clicking a step card shows its result with no animation.
6. With **Reduce motion** on: no movement, but the final highlight still appears and fades.
7. Starting a new action during an animation (for example, clicking another step) stops the animation cleanly, with no leftover partial view.
8. `read_console_messages` with `onlyErrors: true` shows nothing.

- [ ] **Step 6: Commit**

```bash
git add tools/query-explorer/src/animate.js tools/query-explorer/src/app.js tools/query-explorer/build.js tools/query-explorer/dist/query-explorer.html
git commit -m "Query Explorer: add step animations"
```

---

### Task 14: Final walkthrough

**Files:**
- Modify: any `src/` file needed to fix problems found here
- Rebuild: `tools/query-explorer/dist/query-explorer.html`

- [ ] **Step 1: Check every data set's hints**

For each of the 10 data sets, build each of the 3 "Try this" questions by hand by following its hint. Confirm the answer is sensible, for example that the "most" question has a clear winner. If a result looks odd, adjust that data set's rows and re-run `node --test tools/query-explorer/test/datasets.test.js`.

- [ ] **Step 2: Check layouts and themes**

Use `mcp__Claude_Browser__resize_window`:

1. `preset: 'mobile'`: the layout stacks, the page itself doesn't scroll sideways, and tables scroll inside their box.
2. `preset: 'desktop'` with `colorScheme: 'dark'`: all text is readable, and highlight colors are visible.
3. `colorScheme: 'light'`, then reset with `preset: 'desktop'`.

- [ ] **Step 3: Check the wording**

Read every on-screen string in `recipe-view.js`, `app.js`, and `engine.js` messages. Confirm there is no SQL wording and everything is at a 10th-grade reading level.

- [ ] **Step 4: Run everything one last time**

Run: `node tools/query-explorer/build.js && node --test tools/query-explorer/test/*.test.js`
Expected: PASS, 91 tests

- [ ] **Step 5: Commit**

```bash
git add tools/query-explorer
git commit -m "Query Explorer: final walkthrough fixes"
```
