# Constraint Gauntlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Constraint Gauntlet, a single-file browser tool where students add, change, and delete rows in a small campus-ticketing database (SQLite in WebAssembly) that has constraints on it. It has eight levels for Chapter 11 sections 11.1 and 11.2, a Row form input (the default) and a SQL tab, plain-words constraint errors, "slipped through" detection, Fix the rule, and a blast-radius view for deletes.

**Architecture:** Plain JavaScript files in `tools/constraint-gauntlet/src/`, sharing one namespace, `window.CG`. A few SQL Studio files (`dom.js`, `icons.js`, `panels.js`, `editor.js`, `sql-text.js`, `errors.js`) are inlined unchanged from `tools/sql-studio/src/` and keep their own namespace, `window.SS`. The logic files are pure and also load in Node, where `node:test` tests them against SQL Studio's vendored sql.js. The DOM files build the screen with `SS.h()` (no `innerHTML`). `build.js` inlines everything into `dist/constraint-gauntlet.html`.

**Tech Stack:** Plain JavaScript (ES2020), HTML, and CSS. Node 22 for the build and tests (`node:test`, `node:assert/strict`). sql.js 1.14.2 and CodeMirror 5.65.21, both read from `tools/sql-studio/vendor/` (no second copy). No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-10-constraint-gauntlet-design.md`

## Global Constraints

- The deliverable is one file, `tools/constraint-gauntlet/dist/constraint-gauntlet.html`. It works from `file://` and from `https://kalendar.github.io/relational-thinking/constraint-gauntlet.html`. Its only network request is the Google Fonts `<link>`.
- **Vendored files are never copied.** `build.js` and the tests read `tools/sql-studio/vendor/` in place, and a test checks their SHA-256 against `tools/sql-studio/vendor/VERSIONS.md`.
- **Shared SQL Studio source files are never edited for the Gauntlet's sake.** If one needs a change, stop and ask: it would change SQL Studio too. The one gap (`SS.stepZoom` for `panels.js`) is filled by the Gauntlet's own `shim.js` (Task 14).
- Tests live in `tools/constraint-gauntlet/test/`, use `node:test`, and need nothing but the vendored sql.js. The CI already runs every `tools/*/test/*.test.js` and rebuilds every `tools/*/build.js`, and it fails if a committed `dist/` file is out of date. **Commit the rebuilt `dist/` file with every task that changes `src/`.**
- Every logic file follows the dual-load pattern below. DOM files are browser-only.
- Never put data into `innerHTML`. Build all DOM with `SS.h()`.
- Colors use the `:root` tokens copied exactly from `tools/sql-studio/src/styles.css`. The only filled buttons are the Level picker and the main action in the input panel (`--teal`).
- All on-screen text is at a 10th-grade reading level: short and friendly, and any jargon is explained.
- **Every database is opened by `CG.openLevel` (Task 3)**, which turns foreign keys on first and checks them. No other code calls `new SQL.Database()`.
- **Students' statements run one at a time and never inside a transaction.** `BEGIN`/`COMMIT`/`ROLLBACK` are blocked (spec §4, "What may run"). The tool's own internal transactions (Fix the rule, test replays) never span a student statement.
- `localStorage` keys: `constraintGauntlet.layout.v1` (panel sizes, zoom) and `constraintGauntlet.progress.v1` (goals done, input mode). Every access is wrapped in try/catch.
- Spec section numbers (§N) refer to the spec file above.
- **Git:** work on a branch, `constraint-gauntlet`. Commit after every task with a message starting `Constraint Gauntlet: `, ending with the attribution lines below. `master` only takes changes through a PR (Task 23). Git in this folder needs delete permission for `.git/index.lock`: ask for it with `device_request_delete_permission` at the first commit that fails, not before.
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Review Focus

These are the places where a quiet bug would teach students something false. Each has a named test.

1. **Foreign keys must really be on.** If `PRAGMA foreign_keys` silently stays off (for example, it ran inside a transaction), every Level 6–8 lesson is wrong and nothing errors. `openLevel` checks the pragma after setting it, and a test proves an orphan insert is rejected. Tested in Task 3.
2. **Conflict clauses would hide constraint errors.** `INSERT OR REPLACE`, `INSERT OR IGNORE`, `REPLACE INTO`, `UPDATE OR REPLACE`, and `ON CONFLICT … DO` make SQLite skip or delete rows instead of raising the error. That would turn "the database stopped you" into "your row vanished, or someone else's did". All of these are blocked in SQL mode with a friendly message. Tested in Task 4.
3. **Hidden type checks must not block NULL.** `typeof(NULL)` is `'null'`, so a hidden check without `col IS NULL OR …` would reject blanks that the visible rules allow, and Level 2 would give wrong answers. Tested in Task 2.
4. **Primary keys must reject NULL.** SQLite lets `INT PRIMARY KEY` hold NULL, more than once. `schema.js` always adds `NOT NULL`. Tested in Tasks 1 and 2.
5. **The FK explanation must match what SQLite actually did.** The diagnosis runs only after SQLite rejects a statement, and it follows cascades (a CASCADE from Student to Ticket can be blocked by a RESTRICT from Ticket to Scan). A test compares the simulated delete with the real one for every Level 8 policy combination. Tested in Task 8.
6. **Fix the rule must never lose rows.** A rebuild either keeps every row or changes nothing. Tested in Task 10.
7. **Empty text is not NULL.** `''` passes NOT NULL. In SQL mode a student can type it. The business rules treat `''` and all-space text as blank, so `''` in a required name field shows as "slipped through", not as a success. Tested in Task 9.

---

## File Structure

```
tools/constraint-gauntlet/
  build.js                      # Task 15
  src/
    index.html  styles.css      # Task 15
    -- pure (Node-testable) --
    schema.js        # Task 2: column types, DDL (shown + hidden checks), seed order, probe tables, SQL Studio schema adapter
    db.js            # Task 3: openLevel, closeLevel, readQuery, countRows
    statement.js     # Task 4: classify a statement; allowlist; target table
    rowform-sql.js   # Task 5: validate form values; build INSERT / UPDATE / DELETE text
    probe.js         # Task 6: find the rows a statement would add, change, or remove
    constraint-errors.js  # Task 7: SQLite constraint errors -> plain words + chips
    blast.js         # Task 8: simulateDelete (with cascade), measureDelete
    rules.js         # Task 9: business rules, isBlank, brokenRules
    goals.js         # Task 9: evaluate goals against state
    rebuild.js       # Task 10: rebuildTable, fixTest
    session.js       # Task 11: every student action: classify -> probe -> rules -> run -> explain -> log
    levels/          # Tasks 12-13: one file per level
      01-required.js  02-blank-on-purpose.js  03-duplicates.js  04-double-booked.js
      05-price-rules.js  06-ghost-ticket.js  07-load-day.js  08-delete-policies.js
    levels-index.js  # Task 12: CG.levels sorted by id
    export.js        # Task 14: homeworkText
    progress.js      # Task 14: load/save goals done and input mode
    shim.js          # Task 14: SS.stepZoom for panels.js
    -- DOM --
    layout.js        # Task 16: header, goals strip, panels, splitters
    rowform-view.js  # Task 16
    sql-view.js      # Task 16
    tables-view.js   # Task 17: grids, bounced/slipped rows, report cards
    result-view.js   # Task 17
    goals-view.js    # Task 17: goals strip, predict cards
    rules-view.js    # Task 18: Rules panel (shown DDL)
    fix-view.js      # Task 18: Fix the rule
    boards-view.js   # Task 19: Level 2 decision board, Level 7 card stack, Level 8 policy board
    blast-view.js    # Task 19
    export-dialog.js # Task 20
    app.js           # Task 21
  test/
    helpers.js  index.js  drive.js      # drive.js: plays a level's scripted solution (Task 12)
    vendor.test.js  sqlite-behaviors.test.js  schema.test.js  db.test.js  statement.test.js
    rowform-sql.test.js  probe.test.js  constraint-errors.test.js  blast.test.js
    rules.test.js  goals.test.js  rebuild.test.js  session.test.js  levels.test.js
    export.test.js  progress.test.js  build.test.js
  dist/constraint-gauntlet.html
tools/index.html        # Task 23: Chapter 11 card
chapter-11.md           # Task 23: Activity 11.0
```

### The dual-load pattern (every pure `src/*.js` file)

```js
// Constraint Gauntlet: <one-line purpose>.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? require('./schema.js') : root.CG;                       // own modules
  const SST = isNode ? require('../../sql-studio/src/sql-text.js') : root.SS; // shared, only if needed

  // ... code ...

  const api = { /* exported names */ };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
```

Level files use the same wrapper. They export `{ level }` in Node and push onto `root.CG.LEVELS` in the browser. `levels-index.js` sorts `CG.LEVELS` by id.

### Shared shapes

**Table definition** (written in level files, read by `schema.js`):

```js
{
  name: 'Ticket',
  columns: [
    { name: 'ticket_id',  type: 'int', pk: true },                       // pk implies NOT NULL (Review Focus 4)
    { name: 'student_id', type: 'int', notNull: true,
      fk: { table: 'Student', column: 'student_id', onDelete: 'RESTRICT' } }, // RESTRICT | CASCADE | SET NULL
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true,
      check: { expr: 'price_paid >= 0', text: '`price_paid` must be 0 or more.' } },
    { name: 'email', type: 'varchar', size: 255, notNull: true, unique: true, collate: 'NOCASE' },
    { name: 'is_active', type: 'boolean', notNull: true, default: true },
  ],
  constraints: [                                                          // table-level, optional
    { kind: 'unique', columns: ['venue_id', 'concert_date'],
      text: 'One show per venue per night.' },
    { kind: 'check', name: 'ends_after_start', expr: 'end_time > start_time', columns: ['start_time', 'end_time'],
      text: 'The concert has to end after it starts.' },
  ],
}
```

`type` is one of `'int' | 'decimal' | 'varchar' | 'date' | 'time' | 'boolean'`. Booleans are stored as `1`/`0` and shown as `true`/`false`.

**Level** (one per file; see Task 11 for a complete example):

```js
{
  id: 3, title: 'Duplicate Accounts', section: '11.1',
  mission: 'Make each email belong to just one student.',
  tables: [ /* table definitions, in display order */ ],
  variants: { loose: { tables: [ ... ] } },          // optional alternate table sets (Level 1 "Loose version", Level 6 "No FK")
  startVariant: null,                               // or 'nofk'
  seed: { Student: [ { student_id: 1, ... } ] },     // rows as objects
  formTables: ['Student'],                          // tables the Row form may target (default: all)
  reports: [ { id, title, sql, note } ],            // read-only report cards
  rules: [ { id, table, text, check: (row, ctx) => true /* true = OK */ } ],
  legitRows: [ { table, row, note } ], badRows: [ { table, row, note } ],
  predict: [ { id, before: { table, kind, row }, question, choices, answer, why } ],
  goals: [ { id, text, kind, optional, ... } ],     // Task 9
  fix: { table, unlock: 'slipped' | 'too-strict' | 'always', options: [ ... ], builder: false, test: true }, // Task 10; or an array of these
  solution: [ ... ],                                // Task 12: scripted steps for the levels test
  sqlStart: '-- ...',                               // SQL tab starting text
  done: 'Takeaway shown when the level is complete.',
}
```

**Game** (returned by `openLevel`, Task 3):

```js
{ db, SQL, level, tables /* the definitions in use now */, variant /* null or a name */ }
```

**Attempt** (made by `session.run`, Task 11; the attempt log is an array of these):

```js
{
  n: 7,                                    // 1, 2, 3 … within the level
  source: 'form' | 'sql' | 'card' | 'batch' | 'replay',
  kind: 'insert' | 'update' | 'delete',
  table: 'Student',
  sql: "INSERT INTO Student (...) VALUES (...);",
  rows: [ { student_id: 4, email: 'Taylor@marshall.edu', ... } ], // new or changed rows (insert/update), removed rows (delete)
  outcome: 'accepted' | 'rejected' | 'slipped',
  error: null | Explained,                 // Task 7
  broken: [],                              // ids of business rules the rows break, judged before the run (so rejected attempts have it too)
  policies: null,                          // Level 8: the ON DELETE policies in effect
  blast: null | Blast,                     // Task 8, deletes only
  variant: null | 'loose' | ...,
}
```

**Explained error** (made by `explainConstraint`, Task 7):

```js
{
  kind: 'notnull' | 'unique' | 'pk' | 'check' | 'type' | 'fk-parent' | 'fk-child' | 'other',
  headline: 'Another student already has the email `taylor@marshall.edu`. Each email can belong to only one student.',
  chips: { table: 'Student', rule: 'UNIQUE (email)', value: 'Taylor@marshall.edu' },
  columns: ['email'],                      // fields to outline in the Row form
  raw: 'UNIQUE constraint failed: Student.email',
}
```

---

### Task 1: Scaffold, test helpers, vendor check, and the SQLite behavior tests

These tests pin down the SQLite behaviors in spec §4. They come first because every later task depends on them. If a future sql.js upgrade changes one, this file fails before students see a wrong lesson.

**Files:**
- Create: `tools/constraint-gauntlet/test/helpers.js`, `test/index.js`, `test/vendor.test.js`, `test/sqlite-behaviors.test.js`

- [ ] **Step 1: Helpers and runner**

`test/helpers.js`:

```js
// Shared test helpers: SQL Studio's vendored sql.js, read in place.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STUDIO = path.join(ROOT, '..', 'sql-studio');
const VENDOR = path.join(STUDIO, 'vendor');

let sqlPromise = null;
function getSQL() {
  if (!sqlPromise) {
    const initSqlJs = require(path.join(VENDOR, 'sql.js', 'sql-wasm.js'));
    const wasmBinary = fs.readFileSync(path.join(VENDOR, 'sql.js', 'sql-wasm.wasm'));
    sqlPromise = initSqlJs({ wasmBinary });
  }
  return sqlPromise;
}

// Runs a statement; returns 'OK' or the error message. For behavior tests only.
function attempt(db, sql) {
  try { db.run(sql); return 'OK'; } catch (e) { return e.message; }
}
const one = (db, sql) => db.exec(sql)[0].values[0][0];

module.exports = { ROOT, STUDIO, VENDOR, getSQL, attempt, one };
```

`test/index.js`: copy `tools/sql-studio/test/index.js` exactly (it loads every `*.test.js` next to it).

- [ ] **Step 2: Vendor check**

`test/vendor.test.js` reads `tools/sql-studio/vendor/VERSIONS.md`, finds the rows for `sql.js/sql-wasm.js`, `sql.js/sql-wasm.wasm`, and the six CodeMirror files listed in `build.js` (Task 15), and checks each SHA-256 with `crypto.createHash('sha256')`. It parses the table with `/^\| ([^|]+) \| [^|]+ \| [^|]+ \| [^|]+ \| ([0-9a-f]{64}) \|$/gm`.

- [ ] **Step 3: SQLite behavior tests (write them, run them, they should pass at once)**

`test/sqlite-behaviors.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getSQL, attempt, one } = require('./helpers.js');

async function fresh() { const SQL = await getSQL(); return new SQL.Database(); }

test('foreign keys are off until turned on, and the pragma is ignored inside a transaction', async () => {
  const db = await fresh();
  assert.equal(one(db, 'PRAGMA foreign_keys'), 0);
  db.run('BEGIN'); db.run('PRAGMA foreign_keys = ON');
  assert.equal(one(db, 'PRAGMA foreign_keys'), 0, 'ignored inside a transaction');
  db.run('ROLLBACK'); db.run('PRAGMA foreign_keys = ON');
  assert.equal(one(db, 'PRAGMA foreign_keys'), 1);
});

test('the foreign key error names nothing', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE P(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE C(id INT NOT NULL PRIMARY KEY, p INT REFERENCES P(id))');
  assert.equal(attempt(db, 'INSERT INTO C VALUES (1, 99)'), 'FOREIGN KEY constraint failed');
});

test('text goes into DECIMAL and passes CHECK (x >= 0); the hidden type check stops it but allows NULL', async () => {
  const db = await fresh();
  db.run('CREATE TABLE A(p DECIMAL(8,2) CHECK (p >= 0))');
  assert.equal(attempt(db, "INSERT INTO A VALUES ('free')"), 'OK');
  db.run("CREATE TABLE B(p DECIMAL(8,2) CONSTRAINT cg_type_p CHECK (p IS NULL OR typeof(p) IN ('integer','real')))");
  assert.equal(attempt(db, "INSERT INTO B VALUES ('free')"), 'CHECK constraint failed: cg_type_p');
  assert.equal(attempt(db, 'INSERT INTO B VALUES (NULL)'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO B VALUES (12.5)'), 'OK');
});

test('changes() counts only the parent row of a cascade', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE P(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE C(id INT NOT NULL PRIMARY KEY, p INT REFERENCES P(id) ON DELETE CASCADE)');
  db.run('INSERT INTO P VALUES (1)'); db.run('INSERT INTO C VALUES (1,1),(2,1),(3,1)');
  db.run('DELETE FROM P WHERE id = 1');
  assert.equal(db.getRowsModified(), 1);
  assert.equal(one(db, 'SELECT COUNT(*) FROM C'), 0);
});

test('UNIQUE allows many NULLs, is case-sensitive, and COLLATE NOCASE fixes that', async () => {
  const db = await fresh();
  db.run('CREATE TABLE S(e TEXT UNIQUE)');
  assert.equal(attempt(db, 'INSERT INTO S VALUES (NULL)'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO S VALUES (NULL)'), 'OK');
  db.run("INSERT INTO S VALUES ('taylor@marshall.edu')");
  assert.equal(attempt(db, "INSERT INTO S VALUES ('Taylor@marshall.edu')"), 'OK');
  db.run('CREATE TABLE N(e TEXT UNIQUE COLLATE NOCASE)');
  db.run("INSERT INTO N VALUES ('taylor@marshall.edu')");
  assert.equal(attempt(db, "INSERT INTO N VALUES ('Taylor@marshall.edu')"), 'UNIQUE constraint failed: N.e');
});

test("LIKE '%@%' accepts a lone @; '_%@_%._%' does not", async () => {
  const db = await fresh();
  assert.equal(one(db, "SELECT '@' LIKE '%@%'"), 1);
  assert.equal(one(db, "SELECT '@' LIKE '_%@_%._%'"), 0);
  assert.equal(one(db, "SELECT 'a@b' LIKE '_%@_%._%'"), 0);
  assert.equal(one(db, "SELECT 'jlee@marshall.edu' LIKE '_%@_%._%'"), 1);
});

test('IN is case-sensitive', async () => {
  const db = await fresh();
  db.run("CREATE TABLE T(s TEXT CHECK (s IN ('Floor','Lawn')))");
  assert.match(attempt(db, "INSERT INTO T VALUES ('floor')"), /^CHECK constraint failed/);
});

test('INT PRIMARY KEY accepts NULL twice unless NOT NULL is written', async () => {
  const db = await fresh();
  db.run('CREATE TABLE A(id INT PRIMARY KEY)');
  assert.equal(attempt(db, 'INSERT INTO A VALUES (NULL)'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO A VALUES (NULL)'), 'OK');
  db.run('CREATE TABLE B(id INT NOT NULL PRIMARY KEY)');
  assert.equal(attempt(db, 'INSERT INTO B VALUES (NULL)'), 'NOT NULL constraint failed: B.id');
});

test('error message formats the tool relies on', async () => {
  const db = await fresh();
  db.run(`CREATE TABLE Concert(concert_id INT NOT NULL PRIMARY KEY, venue_id INT, concert_date TEXT,
    start_time TEXT, end_time TEXT, UNIQUE (venue_id, concert_date),
    CONSTRAINT ends_after_start CHECK (end_time > start_time))`);
  db.run("INSERT INTO Concert VALUES (1, 3, '2027-02-14', '19:00', '22:00')");
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (1, 4, '2027-02-15', '19:00', '22:00')"), 'UNIQUE constraint failed: Concert.concert_id');
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (2, 3, '2027-02-14', '19:00', '22:00')"), 'UNIQUE constraint failed: Concert.venue_id, Concert.concert_date');
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (3, 3, '2027-02-15', '19:00', '18:00')"), 'CHECK constraint failed: ends_after_start');
  db.run('CREATE TABLE P(price DECIMAL(8,2) NOT NULL CHECK (price >= 0))');
  assert.equal(attempt(db, 'INSERT INTO P VALUES (-5)'), 'CHECK constraint failed: price >= 0');
  assert.equal(attempt(db, 'INSERT INTO P VALUES (NULL)'), 'NOT NULL constraint failed: P.price');
});

test('the rebuild procedure keeps rows, and foreign_key_check finds orphans before commit', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE P(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE C(id INT NOT NULL PRIMARY KEY, p INT NOT NULL)');
  db.run('INSERT INTO P VALUES (1)'); db.run('INSERT INTO C VALUES (1, 1), (2, 99)');
  db.run('PRAGMA foreign_keys = OFF'); db.run('BEGIN');
  db.run('CREATE TABLE cg_new_C(id INT NOT NULL PRIMARY KEY, p INT NOT NULL REFERENCES P(id))');
  db.run('INSERT INTO cg_new_C SELECT * FROM C'); db.run('DROP TABLE C'); db.run('ALTER TABLE cg_new_C RENAME TO C');
  const bad = db.exec('PRAGMA foreign_key_check')[0].values;
  assert.deepEqual(bad.map(r => [r[0], r[2]]), [['C', 'P']]);
  db.run('ROLLBACK'); db.run('PRAGMA foreign_keys = ON');
  assert.equal(one(db, 'SELECT COUNT(*) FROM C'), 2);
  assert.doesNotMatch(one(db, "SELECT sql FROM sqlite_master WHERE name = 'C'"), /REFERENCES/);
});
```

- [ ] **Step 4: Run** `node --test tools/constraint-gauntlet/test/`. Expected: all pass. If one fails, **stop**: the vendored SQLite behaves differently from the spec, and the spec needs updating before anything is built on it.

- [ ] **Step 5: Commit** `Constraint Gauntlet: test helpers and pinned SQLite behaviors`.

---

### Task 2: Schema: types, DDL, seed order, probe tables

**Files:**
- Create: `src/schema.js`
- Test: `test/schema.test.js`

**Interfaces (produces):**
- `TYPES`: per type, `{ sql(col) → 'DECIMAL(8,2)', hidden(colName) → SQL condition or null, parse(text) → value | Error, show(value) → text }`.
- `columnSql(col, { hidden }) → string`: one column line.
- `createTableSql(table, { hidden = true } = {}) → string`: the full CREATE TABLE. With `hidden: false` it is the version shown to students, formatted the book's way (column names padded to the longest, types padded, two-space indent).
- `seedOrder(tables) → [tableName]`: parents before children. FKs to tables in no seed, and self- or cycle-references, are ignored for ordering (Level 7 bonus starts empty).
- `rowToValues(table, row) → [values in column order]` (booleans to 1/0).
- `valuesToRow(table, values) → object` (1/0 to booleans for boolean columns).
- `probeTableSql(table, name) → string`: the same columns and defaults, with **no** constraints.
- `toStudioSchema(tables) → { tables: [{ name, columns: [{ name }] }] }`: the shape SQL Studio's `errors.js` and `editor.js` need for autocomplete and syntax messages.
- `describeConstraint(table, which) → string`: the label used in the "rule" chip, for example `UNIQUE (email)`, `NOT NULL`, `CHECK (price_paid >= 0)`, `REFERENCES Student(student_id)`.

**Hidden type checks** (named `cg_type_<column>`, so their errors are easy to recognize):

| type | condition (always wrapped as `<col> IS NULL OR (…)`) |
|---|---|
| int | `typeof(<col>) = 'integer'` |
| decimal | `typeof(<col>) IN ('integer','real')` |
| boolean | `<col> IN (0, 1)` |
| date | `typeof(<col>) = 'text' AND <col> GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'` |
| time | `typeof(<col>) = 'text' AND <col> GLOB '[0-2][0-9]:[0-5][0-9]'` |
| varchar | none |

Column line order (hidden): `name TYPE [NOT NULL] [PRIMARY KEY] [UNIQUE] [COLLATE X] [DEFAULT v] [CHECK (…)] [REFERENCES T(c) ON DELETE …] [CONSTRAINT cg_type_name CHECK (…)]`. A `pk` column always gets `NOT NULL` (Review Focus 4).

- [ ] **Step 1: Write the failing tests.** Cover:
  - The book's Chapter 11 Ticket table round-trips: `createTableSql(ticket, { hidden: false })` equals this exact text (it is the chapter's example plus `NOT NULL` on the key):
    ```sql
    CREATE TABLE Ticket (
        ticket_id     INT          NOT NULL PRIMARY KEY,
        student_id    INT          NOT NULL REFERENCES Student(student_id) ON DELETE RESTRICT,
        concert_id    INT          NOT NULL REFERENCES Concert(concert_id) ON DELETE RESTRICT,
        price_paid    DECIMAL(8,2) NOT NULL CHECK (price_paid >= 0),
        purchase_date DATE         NOT NULL
    );
    ```
  - The hidden version contains `CONSTRAINT cg_type_price_paid CHECK (price_paid IS NULL OR typeof(price_paid) IN ('integer','real'))`, and the shown version contains no `cg_type_`.
  - In sql.js: a hidden-version table accepts NULL in a nullable decimal, and rejects `'free'`, `'2026-13-45x'` in a date, `'7pm'` in a time, and `2` in a boolean (Review Focus 3).
  - `pk: true` without `notNull` still produces `NOT NULL`, and inserting NULL fails.
  - Table-level constraints: composite UNIQUE and named CHECK appear after the columns, in both versions.
  - `seedOrder` on Venue, Concert(→Venue), Student, Ticket(→Student, →Concert) puts Venue before Concert and both parents before Ticket. On Team(→Player) and Player(→Team) it returns both without throwing.
  - `probeTableSql` keeps `DEFAULT 1` on a boolean and has no `NOT NULL`, `UNIQUE`, `CHECK`, or `REFERENCES`.
  - `describeConstraint` labels for each constraint kind.
- [ ] **Step 2: Run the tests; they fail.**
- [ ] **Step 3: Write `schema.js`.** Pad shown DDL with `name.padEnd(longestName + 1)` and `type.padEnd(longestType + 1)`, trimming trailing spaces. Quote text defaults with `'`, doubling inner quotes. Booleans default to `1`/`0` in hidden DDL and `true`/`false` in shown DDL. (SQLite accepts `true`/`false` as keywords since 3.23, but the hidden version uses numbers to be safe.)
- [ ] **Step 4: Run the tests; they pass.**
- [ ] **Step 5: Commit** `Constraint Gauntlet: schema and DDL`.

---

### Task 3: Opening a level

**Files:**
- Create: `src/db.js`
- Test: `test/db.test.js`

**Interfaces:**
- Consumes: `schema.createTableSql`, `seedOrder`, `rowToValues`, `valuesToRow`.
- Produces:
  - `openLevel(SQL, level, { variant = level.startVariant || null, tables = null } = {}) → Game`. Uses `tables` if given (Level 2 builds its own), else the variant's tables, else `level.tables`.
  - `closeLevel(game)`.
  - `readQuery(game, sql, params = []) → { columns, rows }` (rows as objects). Read-only use: reports, lookups, counts.
  - `countRows(game) → { [table]: n }`.
  - `tableRows(game, tableName) → [row objects]` in primary key order, with `_rowid` added.

```js
function openLevel(SQL, level, opts = {}) {
  const variant = opts.variant !== undefined ? opts.variant : (level.startVariant || null);
  const tables = opts.tables || (variant ? level.variants[variant].tables : level.tables);
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  if (db.exec('PRAGMA foreign_keys')[0].values[0][0] !== 1) {
    db.close();
    throw new Error('Foreign keys did not turn on. Every lesson in Levels 6-8 depends on them.');
  }
  for (const t of tables) db.run(S.createTableSql(t, { hidden: true }));
  const byName = Object.fromEntries(tables.map(t => [t.name, t]));
  for (const name of S.seedOrder(tables)) {
    const rows = (level.seed && level.seed[name]) || [];
    if (!rows.length) continue;
    const t = byName[name];
    const cols = t.columns.map(c => c.name);
    const stmt = db.prepare(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    try { for (const r of rows) stmt.run(S.rowToValues(t, r)); } finally { stmt.free(); }
  }
  return { db, SQL, level, tables, variant };
}
```

A seed row that breaks a constraint throws, with the level id and table in the message. That's a level-file bug, and the levels test (Task 11) catches it.

- [ ] **Step 1: Write the failing tests.** Use a tiny inline level (Student, Ticket→Student) with seed data:
  - `PRAGMA foreign_keys` is 1 after open.
  - Inserting an orphan ticket with `game.db.run` fails with `FOREIGN KEY constraint failed` (Review Focus 1).
  - Deleting a student who has a ticket fails (RESTRICT).
  - Seed rows are present, booleans come back as `true`/`false` from `tableRows`, and `_rowid` is a number.
  - A seed row that breaks NOT NULL throws an error mentioning the level id.
  - `countRows` returns every table.
  - A variant opens its own tables.
- [ ] **Step 2: Run; fail. Step 3: Write `db.js`. Step 4: Run; pass.**
- [ ] **Step 5: Commit** `Constraint Gauntlet: open a level with foreign keys on`.

---

### Task 4: Statement allowlist

**Files:**
- Create: `src/statement.js`
- Test: `test/statement.test.js`

**Interfaces:**
- Consumes: SQL Studio's `sql-text.js` (`tokenize`, `splitStatements`).
- Produces: `classify(text, tableNames) → { ok: true, kind: 'insert'|'update'|'delete'|'select', table } | { ok: false, reason, message }`.

Rules, applied to the tokens with whitespace and comments dropped:
1. Empty → `{ ok: false, reason: 'empty', message: "There's no statement here to run." }`
2. More than one statement in the text given → `reason: 'many'`. (The SQL view sends only the statement at the cursor. Run all in Level 7 sends them one at a time.)
3. First word `INSERT`, `UPDATE`, `DELETE`, `SELECT` (or `WITH` followed by a SELECT) is allowed. `REPLACE` is not.
4. **Blocked conflict clauses** (Review Focus 2): `INSERT OR <anything>`, `UPDATE OR <anything>`, `REPLACE INTO`, or the word pair `ON CONFLICT` anywhere → `reason: 'conflict'`, message: "`OR REPLACE`, `OR IGNORE`, and `ON CONFLICT` tell the database to skip its own rules or quietly remove rows. In the Gauntlet, the database always says what it thinks. Take that part out and run it again."
5. Target table: the identifier after `INSERT INTO`, `UPDATE`, or `DELETE FROM`. It must be one of `tableNames` (case-insensitive; return the real name). Otherwise `reason: 'table'`: "This level's tables are Student and Ticket." Quoted identifiers are allowed if they name a level table.
6. Any mention of `sqlite_` (for example, `sqlite_master`) → `reason: 'internal'`.
7. Blocked first words, with the messages in spec §4: `CREATE`/`ALTER`/`DROP` (`'rules'`), `BEGIN`/`COMMIT`/`END`/`ROLLBACK`/`SAVEPOINT`/`RELEASE` (`'transaction'`), and everything else (`'other'`).

- [ ] **Step 1: Write the failing tests:** each allowed kind with its target table; lower case; a leading comment; `insert or replace into`, `REPLACE INTO`, `INSERT ... ON CONFLICT(email) DO NOTHING`, `UPDATE OR IGNORE`; but `'ON CONFLICT'` **inside a string value** is allowed (tokens, not regex); unknown table; `sqlite_master`; `BEGIN`; `DROP TABLE`; two statements.
- [ ] **Step 2–4: fail, write, pass. Step 5: Commit** `Constraint Gauntlet: statement allowlist`.

---

### Task 5: Row form values to SQL

**Files:**
- Create: `src/rowform-sql.js`
- Test: `test/rowform-sql.test.js`

**Interfaces:**
- Consumes: `schema.TYPES`.
- Produces:
  - `parseForm(table, fields) → { ok: true, row } | { ok: false, problems: { [col]: message } }`. `fields` is `{ col: string }` from the inputs. A blank string means NULL (spec §5.1). Type problems use the messages below. This is **not** a constraint check: NOT NULL and the rest are left to the database.
  - `insertSql(table, row) → string`
  - `updateSql(table, row, keyRow) → string`: `SET` every non-key column that differs from `keyRow`, `WHERE pk = <keyRow pk>`. Returns null when nothing changed.
  - `deleteSql(table, keyRow) → string`
  - `literal(type, value) → string`: `NULL` for blanks, bare numbers, and `true`/`false` for booleans, to match the book (SQLite reads them as 1 and 0). Text is quoted, with inner `'` doubled.
  - `nextId(game, table) → number`: `MAX(pk) + 1`, or 1.

Type messages: int "needs a whole number", decimal "needs a number, like 45.00", date "needs a date like 2026-11-10", time "needs a time like 19:30", boolean "needs true or false".

Format of the generated SQL (one line for short statements; columns and values wrapped onto two indented lines past 70 characters):

```sql
INSERT INTO Ticket (ticket_id, student_id, concert_id, price_paid, purchase_date)
VALUES (6, 2, 1, 45.00, '2026-11-10');
```

Decimals keep two places (`45.00`) when the type has scale 2.

- [ ] **Step 1: Write the failing tests:** blank → NULL; `O'Brien` → `'O''Brien'`; `45` → `45.00` for DECIMAL(8,2); `12abc` → a problem for decimal; `2026-02-30` passes the pattern (it's the database's job to be picky, and SQLite isn't; note this in a comment); booleans; `updateSql` with no changes → null; `updateSql` changing the key column; **every generated statement runs in sql.js** against a Task 3 game.
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: row form SQL`.

---
### Task 6: Probing a statement (what rows would it touch?)

The plain-words errors need the values a statement tried to write, and the delete explanations need the rows it tried to remove. In SQL mode those are inside whatever the student typed. Instead of parsing SQL, the tool runs the statement on an unconstrained copy of the target table first.

**How it works (checked against SQLite while planning):** a TEMP table with the same name as a main table **hides** the main one for every unqualified reference, including `Student.student_id` inside a WHERE clause. So the probe:
1. creates `TEMP TABLE <Target>` with the same columns and defaults and no constraints (`schema.probeTableSql`),
2. copies the target's rows in, **keeping their rowids**,
3. runs the student's text **unchanged**,
4. compares the copy before and after by rowid, and
5. drops the temp table, so the name points at the real table again.

Other tables in the statement (`INSERT … SELECT` from Student into Ticket) still resolve to the real ones. The probe can't hit a constraint error, because the copy has none. It can hit syntax and "no such column" errors, which then go to SQL Studio's `errors.js` and are not counted as attempts.

**Files:**
- Create: `src/probe.js`
- Test: `test/probe.test.js`

**Interfaces:**
- Consumes: `schema.probeTableSql`, `schema.valuesToRow`.
- Produces: `probe(game, text, cls) → { ok: true, added: [row], changed: [{ before, after }], removed: [row] } | { ok: false, message }`. Rows are objects with `_rowid`.

```js
function probe(game, text, cls) {
  if (cls.kind === 'select') return { ok: true, added: [], changed: [], removed: [] };
  const t = game.tables.find(x => x.name === cls.table);
  const cols = t.columns.map(c => c.name);
  const db = game.db;
  const snap = () => {
    const res = db.exec(`SELECT rowid, ${cols.join(', ')} FROM temp.${t.name}`);
    const out = new Map();
    for (const v of (res[0] ? res[0].values : [])) out.set(v[0], Object.assign(S.valuesToRow(t, v.slice(1)), { _rowid: v[0] }));
    return out;
  };
  db.run(`DROP TABLE IF EXISTS temp.${t.name}`);
  db.run(S.probeTableSql(t, `temp.${t.name}`));
  try {
    db.run(`INSERT INTO temp.${t.name} (rowid, ${cols.join(', ')}) SELECT rowid, ${cols.join(', ')} FROM main.${t.name}`);
    const before = snap();
    try { db.run(text); } catch (e) { return { ok: false, message: e.message }; }
    const after = snap();
    const added = [], changed = [], removed = [];
    for (const [id, row] of after) {
      if (!before.has(id)) added.push(row);
      else if (cols.some(c => before.get(id)[c] !== row[c])) changed.push({ before: before.get(id), after: row });
    }
    for (const [id, row] of before) if (!after.has(id)) removed.push(row);
    return { ok: true, added, changed, removed };
  } finally {
    db.run(`DROP TABLE IF EXISTS temp.${t.name}`);
  }
}
```

- [ ] **Step 1: Write the failing tests** (on a Task 3 game with Student and Ticket):
  - INSERT returns one `added` row with the typed values, and the real table is unchanged.
  - An INSERT that would break UNIQUE in the real table still probes fine (the copy has no constraints) and returns the attempted row.
  - `UPDATE Student SET email = 'z@x.edu' WHERE Student.student_id = 2` (qualified name) returns one `changed` pair.
  - `DELETE FROM Student WHERE student_id IN (1, 2)` returns two `removed` rows, and the real rows are still there.
  - INSERT omitting a column with `DEFAULT true` gets `true` in the probe.
  - `INSERT INTO Ticket SELECT … FROM Student` reads from the real Student table.
  - A typo (`INSERT INTO Student (emial) …`) returns `{ ok: false, message: /no such column/ }` and leaves no temp table behind (`SELECT name FROM sqlite_temp_master` is empty).
  - After any probe, `PRAGMA foreign_keys` is still 1, and an orphan insert into the real Ticket table still fails.
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: probe statements on a copy`.

---

### Task 7: Plain-words constraint errors

**Files:**
- Create: `src/constraint-errors.js`
- Test: `test/constraint-errors.test.js`

**Interfaces:**
- Consumes: `schema.describeConstraint`, `db.readQuery`, `rowform-sql.nextId`, `blast.simulateDelete` (Task 8; `explainConstraint` takes it lazily, so Task 7's tests can stub it until Task 8 lands).
- Produces: `explainConstraint(game, { kind, table, probe }, raw) → Explained` (shape in File Structure). `raw` is SQLite's message.

**Parsing `raw`:**

| Pattern | kind |
|---|---|
| `^NOT NULL constraint failed: (\w+)\.(\w+)$` | `notnull` |
| `^UNIQUE constraint failed: (.+)$` (split on `, `; each is `T.c`) | `pk` if the columns are exactly the primary key, else `unique` |
| `^CHECK constraint failed: cg_type_(\w+)$` | `type` |
| `^CHECK constraint failed: (.+)$` | `check`: match a table constraint by `name`, else a column's `check.expr` (exact text), else a table check's `expr` |
| `^FOREIGN KEY constraint failed$` | `fk-parent` or `fk-child` by diagnosis (below) |
| anything else | `other` |

**Which row:** the attempted rows are `probe.added` (insert) or the `after` side of `probe.changed` (update). For UNIQUE and PK, the culprit is the attempted row that matches an existing different row on those columns. Find it with `SELECT rowid, * FROM <T> WHERE c1 = ? AND c2 = ?`, which uses the column's own collation, so NOCASE columns match the way SQLite did. For an INSERT of several rows, it may also clash with another attempted row: check those too.

**Headlines** (a table's noun is `table.noun` or the lower-case name; level files may override any message with `text` on the constraint and `describe(row, game)` for extra detail, such as the venue's name):

| kind | headline |
|---|---|
| notnull | Every {noun} needs a `{col}`. You left it blank. |
| notnull, during a DELETE (SET NULL on a column that can't be blank) | Deleting this {parentNoun} would make `{Child}.{col}` blank, but that column can't be blank. Let it be blank, or choose another delete rule. (Found with `simulateDelete`, `blocked.kind === 'notnull'`.) |
| unique, one column | Another {noun} already has the {col} `{value}`. Each {col} can belong to only one {noun}. If the stored value differs only in capital letters: (It's saved as `{existing}`.) |
| unique, several | {constraint text, or "That combination is already taken."} There's already a {noun} with {c1} {v1} and {c2} {v2}. |
| pk | There's already a {noun} with `{col}` {value}. Each {noun} needs its own ID. Try {nextId}. |
| check, column | {check.text} You entered `{value}`. |
| check, table | {constraint text} You entered {c1} `{v1}` and {c2} `{v2}`. |
| check, unknown | This row breaks the rule `{expr}` on the {table} table. |
| type | `{col}` needs {a whole number / a number / a date like 2026-11-10 / a time like 19:30 / true or false}. `{value}` won't work. |
| fk-parent | There's no {parentNoun} with `{col}` {value}. Add the {parentNoun} first, or check the ID. (more than one: one sentence each) |
| fk-child, delete | {ParentNoun} {key} ({label}) still has {n} {childNoun}s. The rule `ON DELETE RESTRICT` on {Child}.{col} blocks the delete. Delete or move those {childNoun}s first, or mark it inactive instead. |
| fk-child, update of a key | {n} {childNoun}s still point to {parentNoun} {old key}. Changing its `{col}` would leave them pointing at nothing. |
| other | Something went wrong. (SQLite's message is shown below.) |

`{label}` is the first text column of the parent row that isn't the key (for a Student, the first name and last name if both exist). The "mark it inactive" clause appears only if the parent table has an `is_active` column.

**FK diagnosis** (only ever runs after SQLite has rejected the statement):
- **insert / update:** for every attempted row and every FK column with a non-NULL value, run `SELECT 1 FROM <Parent> WHERE <pk> = ?`. Report each miss. If none miss and the table is itself a parent whose key changed in `probe.changed`, it is the update-of-a-key case: count children by the old key.
- **delete:** `blast.simulateDelete(game, table, probe.removed)` and report its `blocked` (Task 8). That covers a CASCADE that is blocked further down, such as Student → Ticket → Scan.
- If nothing is found (it shouldn't happen), `kind: 'fk-unknown'`, with the headline: "A row points to something that doesn't exist, or something still points to this row."

**Chips:** `table` is the table named in the error (for fk-child, the child table that blocked it). `rule` comes from `describeConstraint`. `value` is the offending value, shown the way the Row form shows it.

- [ ] **Step 1: Write the failing tests:** one per headline row, each from a **real** sql.js error produced by actually running the statement on a game (not a hand-typed message), checking `kind`, `headline`, `chips`, and `columns`. Include: NOCASE note; composite UNIQUE with `describe`; PK suggestion; the hidden type check for `'free'`; two missing parents in one INSERT; delete blocked by a direct child; delete blocked by a grandchild through CASCADE; update of a parent key; an unknown CHECK expression.
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: plain-words constraint errors`.

---

### Task 8: Deletes: simulate and measure

`changes()` counts only the parent row (Task 1), so the blast radius is measured by counting. The simulation predicts the same thing without touching the data. It's used to explain blocked deletes (Task 7) and to check predictions in Level 8. A test proves the two always agree (Review Focus 5).

**Files:**
- Create: `src/blast.js`
- Test: `test/blast.test.js`

**Interfaces:**
- Produces:
  - `childLinks(tables, parentName) → [{ child, column, onDelete, parentColumn, notNull }]`.
  - `simulateDelete(game, table, rows) → { blocked: null | Blocked, removed: { [table]: n }, nulled: { 'Table.col': n } }`, where `Blocked = { kind: 'restrict' | 'notnull', parentTable, parentRow, child, column, count }`.
  - `snapshotCounts(game) → { rows: { [table]: n }, nulls: { 'Table.col': n } }`. The nulls are counted only for nullable FK columns.
  - `blastBetween(before, after) → { removed, nulled, total }`.

```js
function simulateDelete(game, table, rows) {
  const removed = {}, nulled = {}, seen = new Set();
  const queue = rows.map(r => ({ table, row: r }));
  while (queue.length) {
    const { table: t, row } = queue.shift();
    const key = `${t}#${row._rowid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    removed[t] = (removed[t] || 0) + 1;
    for (const link of childLinks(game.tables, t)) {
      const kids = D.readQuery(game, `SELECT rowid AS _rowid, * FROM ${link.child} WHERE ${link.column} = ?`, [row[link.parentColumn]]).rows
        .filter(k => !seen.has(`${link.child}#${k._rowid}`));
      if (!kids.length) continue;
      if (link.onDelete === 'CASCADE') { for (const k of kids) queue.push({ table: link.child, row: k }); continue; }
      if (link.onDelete === 'SET NULL') {
        if (link.notNull) return { blocked: { kind: 'notnull', parentTable: t, parentRow: row, child: link.child, column: link.column, count: kids.length }, removed: {}, nulled: {} };
        nulled[`${link.child}.${link.column}`] = (nulled[`${link.child}.${link.column}`] || 0) + kids.length;
        continue;
      }
      return { blocked: { kind: 'restrict', parentTable: t, parentRow: row, child: link.child, column: link.column, count: kids.length }, removed: {}, nulled: {} };
    }
  }
  return { blocked: null, removed, nulled };
}
```

A blocked delete changes nothing in SQLite, so a blocked result reports nothing removed. (Checked while planning: a CASCADE from Student to Ticket blocked by a RESTRICT from Ticket to Scan leaves Student and Ticket untouched.) A SET NULL on a NOT NULL column fails in SQLite with `NOT NULL constraint failed: <Child>.<col>`, not an FK error. Task 7 maps that message to the `notnull` headline, and the Level 8 schema keeps `Ticket.student_id` nullable whenever SET NULL is chosen (Task 13).

- [ ] **Step 1: Write the failing tests.**
  - **Agreement test:** build the Level 8 schema by hand in the test (Student, Ticket, Scan, with the seed from spec §6: Jordan has 3 tickets, 2 scans each). For every combination of Ticket.student_id ∈ {RESTRICT, CASCADE, SET NULL} × Scan.ticket_id ∈ {RESTRICT, CASCADE}, open a fresh game, simulate `DELETE FROM Student WHERE student_id = <Jordan>`, then really run it, and assert: blocked ⇔ SQLite threw; when not blocked, `removed` and `nulled` equal `blastBetween(before, after)`.
  - CASCADE → CASCADE removes 1 + 3 + 6 = 10.
  - SET NULL with a NOT NULL child column → `blocked.kind === 'notnull'`.
  - Deleting two parents that share no children counts both.
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: simulate and measure deletes`.

---

### Task 9: Business rules and goals

**Files:**
- Create: `src/rules.js`, `src/goals.js`
- Test: `test/rules.test.js`, `test/goals.test.js`

**Interfaces (`rules.js`):**
- `isBlank(v)`: true for `null`, `undefined`, and text that is empty or only spaces (Review Focus 7).
- `makeCtx(game, selfRowid = null) → { query(sql, params) → rows, self: selfRowid }`. Rules that look at other rows (a duplicate person) must ignore the row with `_rowid === ctx.self`.
- `brokenRules(level, table, row, ctx) → [ruleId]`: every rule for that table whose `check(row, ctx)` returns false. A rule that throws counts as broken, and the error is logged with `console.warn` (a level-file bug the levels test catches).
- `ruleText(level, id) → string`.

**Rules are checked against the data as it was before the statement runs** (Task 11 calls them between the probe and the real run). So "another student already has this email, whatever the capitals" doesn't find the new row itself. For updates, `ctx.self` is the changed row's rowid.

**Interfaces (`goals.js`):**
- `evaluate(level, state) → [{ id, text, met }]`. `state = { log, predictions: { [id]: choice }, fixes: [{ table, optionId, passed }], flags: { [name]: true }, game }`.
- `complete(level, state) → boolean`.

Goal kinds (all deterministic; no AI):

| kind | params | met when |
|---|---|---|
| `accepted` | `table`, `match` (object of column values, or function) | an accepted or slipped attempt added or changed a row matching it |
| `rejected-by` | `errorKind` (or a list), optional `column`, `attemptKind`, `distinct` (count), `distinctBy` (`'column'`, the default, or `'rule'`) | rejected attempts with that kind (and column, and insert/update/delete) exist; with `distinct: 3`, on at least 3 different columns (or rules, by `chips.rule`) |
| `slipped` | optional `rule` | an attempt slipped through (breaking that rule, if given) |
| `predicted` | `predict` | `state.predictions[predict]` is set (right or wrong) |
| `fixed` | `table` | `state.fixes` has a passed fix for that table |
| `flag` | `flag` | `state.flags[flag]` is true (set by boards: Level 2 batch clean, Level 7 all cards in, Level 8 soft delete) |
| `state` | `check(state) → boolean` | the function returns true (report cards disagree, both policies tried) |

A goal with `optional: true` is shown but not needed for `complete`. Goals are evaluated after every attempt and every board action, newest state only. Met goals are saved by `progress.js` (Task 14) and stay met for the level, even after Reset, as spec §11 says.

- [ ] **Step 1: Write the failing tests:** `isBlank` for `''`, `'   '`, `0` (not blank), `false` (not blank); a duplicate-person rule that ignores `ctx.self`; a throwing rule counts as broken; each goal kind met and not met; `distinct: 3` needs three columns, not three attempts; `distinctBy: 'rule'`; `attemptKind`; an optional goal doesn't block `complete`.
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: business rules and goals`.

---

### Task 10: Fix the rule: rebuild a table, and the fix test

**Files:**
- Create: `src/rebuild.js`
- Test: `test/rebuild.test.js`

**Interfaces:**
- `applyOption(tableDef, option) → newTableDef`. Options in level files are `{ id, label, change: (tableDef) => newTableDef, correct: boolean, why: 'shown when it fails or passes' }`. `change` must keep the same columns in the same order. `applyOption` throws if it doesn't.
- `checkExpression(text, tableDef) → { ok: true, expr } | { ok: false, message }`, for a typed CHECK (Level 5, SQL mode). It must tokenize to a single expression with no `;`, no `SELECT`, no `sqlite_`, and only this table's columns. It is then tested by preparing `SELECT 1 FROM <T> WHERE (<expr>)` against the game. It goes into the rebuilt DDL only if that prepares.
- `rebuildTable(game, newDef) → { ok: true, game } | { ok: false, reason: 'rows' | 'orphans', problems: [{ row, explained }] }`. The procedure is checked in Task 1:

```js
function rebuildTable(game, newDef) {
  const db = game.db;
  const old = game.tables.find(t => t.name === newDef.name);
  const cols = old.columns.map(c => c.name).join(', ');
  const tmp = `cg_new_${newDef.name}`;
  const problems = [];
  db.run('PRAGMA foreign_keys = OFF');          // must be outside the transaction (Task 1)
  db.run('BEGIN');
  try {
    db.run(S.createTableSql(Object.assign({}, newDef, { name: tmp }), { hidden: true }));
    const rows = D.tableRows(game, newDef.name);
    const stmt = db.prepare(`INSERT INTO ${tmp} (${cols}) VALUES (${old.columns.map(() => '?').join(', ')})`);
    try {
      for (const r of rows) {
        try { stmt.run(S.rowToValues(old, r)); }
        catch (e) { problems.push({ row: r, explained: E.explainConstraint(withTable(game, newDef, tmp), { kind: 'insert', table: newDef.name, probe: { added: [r], changed: [], removed: [] } }, e.message.replace(tmp, newDef.name)) }); }
      }
    } finally { stmt.free(); }
    if (problems.length) { db.run('ROLLBACK'); return { ok: false, reason: 'rows', problems }; }
    db.run(`DROP TABLE ${newDef.name}`);
    db.run(`ALTER TABLE ${tmp} RENAME TO ${newDef.name}`);
    const orphans = (db.exec('PRAGMA foreign_key_check')[0] || { values: [] }).values;
    if (orphans.length) {
      db.run('ROLLBACK');
      return { ok: false, reason: 'orphans', problems: orphans.map(o => ({ row: rowByRowid(game, o[0], o[1]), explained: orphanText(game, o) })) };
    }
    db.run('COMMIT');
    game.tables = game.tables.map(t => (t.name === newDef.name ? newDef : t));
    return { ok: true, game };
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw e;
  } finally {
    db.run('PRAGMA foreign_keys = ON');
    if (db.exec('PRAGMA foreign_keys')[0].values[0][0] !== 1) throw new Error('Foreign keys did not turn back on.');
  }
}
```

`withTable` is a copy of the game whose tables list maps the new definition to the temporary name, so the error explainer reads the right constraint. `orphanText` says: "This {childNoun} points to {parentNoun} {value}, which doesn't exist. Fix or delete it first." `foreign_key_check` returns `[table, rowid, parent, fkid]`. Note: `rowByRowid` reads the renamed table **before** the ROLLBACK, so call it first and keep the row objects.

- `fixTest(SQL, level, newTables, log) → { passed, rows: [{ label, before, after, verdict }] }`:
  1. Open a **fresh** game from the level's seed with `newTables`.
  2. **Replay the attempt log in order** (every table, not just the fixed one, so later rows still have their parents). For each attempt on the fixed table, judge it: classify it with `brokenRules` against the replay database just before running it (legit = breaks no rules). Then run it. Verdict ✓ if legit and accepted, or bad and rejected. ✗ otherwise.
  3. Test each `legitRows` and `badRows` entry **on its own** against the seed: `SAVEPOINT cg_t`, insert, note the result, `ROLLBACK TO cg_t`, `RELEASE cg_t`.
  4. `passed` is true when no row has ✗.
  5. Close the fresh game.

  `before` comes from the original attempt's outcome (or "new" for fixed rows). The rows table in spec §8 is built from this.

**Applying a passed fix to the live game:** `rebuildTable` on the student's live data. If the live data already breaks the new rule (Level 3: the `Taylor@` duplicate the student just sneaked in), it returns `reason: 'rows'` with the rows. The Fix view (Task 18) then offers **Delete these rows and apply** or **Reset the level's data and apply**, and explains: "A real database won't add a rule your data already breaks. You'd clean the data first." Level 6's orphan uses the same path with `reason: 'orphans'`.

- [ ] **Step 1: Write the failing tests:**
  - A rebuild that adds `COLLATE NOCASE` keeps every row and the new rule works.
  - A rebuild over a case-duplicate returns `reason: 'rows'`, and the table and its rows are unchanged (Review Focus 6). Checked by comparing `tableRows` and the stored DDL before and after.
  - Adding REFERENCES over an orphan returns `reason: 'orphans'` with the orphan row, and leaves the table unchanged.
  - After every outcome (success, rows, orphans, and a thrown error from a bad `change`), `PRAGMA foreign_keys` is 1.
  - Child tables that reference the rebuilt table still enforce their FKs afterward.
  - `checkExpression` accepts `price_paid > 0`, and rejects `1); DROP TABLE Ticket; --`, `(SELECT 1)`, and an unknown column.
  - `fixTest` on a small level: the correct option passes, a too-loose option fails on a named bad row, and a too-strict option fails on a named legit row. Replay keeps a ticket for a student the student added earlier legit (it isn't blamed for missing its parent).
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: Fix the rule rebuild and fix test`.

---

### Task 11: The session: one place where every action happens

Every student action goes through one pure controller, so the browser and the tests drive the tool the same way. The levels test (Task 12) plays each level's scripted solution through it.

**Files:**
- Create: `src/session.js`
- Test: `test/session.test.js`

**Interfaces:**
- Consumes: everything in Tasks 2–10, plus SQL Studio's `errors.js` (`explainError`) for syntax errors.
- Produces: `createSession(SQL, level, { done = [] } = {}) → Session`, with:

| Method | Does |
|---|---|
| `run(text, source = 'sql')` | classify → probe → rules (before) → real run → explain or classify → log. Returns `{ type: 'blocked', message } \| { type: 'syntax', explained } \| { type: 'select', columns, rows } \| { type: 'attempt', attempt }`. Only the last is logged. |
| `runForm(tableName, action, fields, keyRow)` | `parseForm` → `insertSql` / `updateSql` / `deleteSql` → `run(sql, 'form')`. A type problem returns `{ type: 'form', problems }` (not logged). |
| `runAll(texts, source)` | runs each in order and keeps going after a bounce (Level 7 Run all). Returns the list of results. |
| `predict(id, choice)` | records the prediction. Returns `{ correct, why }`. |
| `switchVariant(name)` | reopens the game with that variant's tables and the seed. Keeps the log; later attempts are tagged with the variant. |
| `fixOptions()` | the level's fix options, or the CHECK builder's columns and operators. |
| `tryFix(choice)` | `choice` is `{ optionId }` or `{ expr, column }`. Builds the new tables, runs `fixTest`, records it in `fixes`. Returns the fix test result. |
| `applyFix(choice, { cleanup: null \| 'delete' \| 'reset' })` | `rebuildTable` on the live game, as described in Task 10. |
| `decide(choices)` | Level 2: builds tables from the Required / Can be blank and unknown / not applicable choices, opens a fresh game, loads the batch with `runAll(…, 'batch')`, and returns `{ tooStrict: [...], tooLoose: [...], tagsWrong: [...] }`. Sets `flags.batchClean` when all three lists are empty. |
| `setPolicies(map)` | Level 8: rebuilds Ticket and Scan with the chosen `ON DELETE` (using `rebuildTable`), and records the combination in `flags`. |
| `softDelete(table, keyRow)` | runs `UPDATE … SET is_active = false WHERE …` through `run` and sets `flags.softDeleted`. |
| `judgePolicies(map)` | Level 8 Round 3: runs the level's test deletes under the choices and returns an explanation per relationship. Sets `flags.policiesPassed` when they match the key. |
| `report(id)` | runs a report card's SQL with `readQuery`. |
| `goals()`, `complete()` | from `goals.js`. |
| `reset()` | reopens the level from its seed and clears the log, predictions, fixes, and flags. Goals already marked done stay done (they're kept outside the session by `progress.js`). |
| `state()` | everything the views need: tables and rows, log, goals, open fix, current variant. |

`run` in order:
1. `cls = classify(text, names)`. If not ok → `{ type: 'blocked' }`.
2. If `select` → `readQuery`.
3. `p = probe(game, text, cls)`. If not ok → `{ type: 'syntax', explained: SS.explainError({ kind: 'sqlite', message: p.message }, text, toStudioSchema(game.tables)) }`.
4. For insert/update: `broken` = the union of `brokenRules` over `p.added` and each `p.changed[].after`, with `ctx.self` set for updates.
5. For delete: `before = snapshotCounts(game)`.
6. Run the real statement.
   - **Success:** `outcome = broken.length ? 'slipped' : 'accepted'`. For a delete, `blast = blastBetween(before, snapshotCounts(game))`.
   - **Error matching `/constraint failed/`:** `outcome = 'rejected'`, `error = explainConstraint(…)`.
   - **Any other error:** rejected with `kind: 'other'`.
7. Append to the log. Return.

- [ ] **Step 1: Write the failing tests** on a small inline level: each `run` result type; `runForm` with a type problem; rules judged before the run (a duplicate-person rule fires on the second row, not on the first); `runAll` keeps going after a bounce; `switchVariant` keeps the log; `reset` clears everything; a blocked statement isn't logged; a slipped attempt carries its broken rule ids.
- [ ] **Steps 2–4. Step 5: Commit** `Constraint Gauntlet: session controller`.

---
### Task 12: Levels 1–4, the level index, and the levels test

**Concept order:** levels for 11.1 (1–5) use **no `REFERENCES`**. Foreign keys first appear in Level 6, matching the chapter (11.1's examples have none; 11.2 adds them). The levels test checks this.

**Files:**
- Create: `src/levels-index.js`, `src/levels/01-required.js`, `02-blank-on-purpose.js`, `03-duplicates.js`, `04-double-booked.js`
- Create: `test/levels.test.js`, `test/drive.js`

**The shared campus world** (used by every level that needs it; each level copies only the rows it needs into its own `seed`, so levels never depend on each other):

| Table | Rows |
|---|---|
| Student | 1 Maya Patel `maya.patel@marshall.edu` mu_id `901234561` · 2 Jordan Lee `jlee@marshall.edu` `901234562` · 3 Taylor Brooks `taylor@marshall.edu` `901234563` · 4 Ana Ruiz (no middle name) `ana.ruiz@marshall.edu` `901234564` |
| Venue | 1 Mountain Health Arena, Huntington · 2 Joan C. Edwards Stadium, Huntington · 3 Keith-Albee Performing Arts Center, Huntington |
| Concert | 1 Zach Bryan, venue 1, 2027-02-14, 19:00–22:30 · 2 Noah Kahan, venue 3, 2027-03-05, 20:00–22:00 · 3 Morgan Wallen, venue 2, 2027-04-17, 18:30–23:00 |
| Ticket | 1 (Maya, concert 1, 89.50, 2026-11-01) · 2 (Jordan, 1, 89.50, 2026-11-02) · 3 (Jordan, 2, 62.00, 2026-11-03) · 4 (Taylor, 3, 120.00, 2026-11-04) |

**Extra level fields** used below:
- `optional: true` on a goal: shown, but not needed for "Level complete" (Level 7's bonus).
- `predict[].answer` may be a function `(session) => choiceId`, worked out from the current state (Level 8's blast question uses `simulateDelete`).
- `fix` may be an array, one entry per table (Level 5 fixes Ticket and Student).
- `fix.test: false` skips the fix test. The fix passes when the rebuild succeeds (Level 7 bonus).
- `rejected-by` goals take `distinctBy: 'column' | 'rule'` and `attemptKind: 'insert' | 'update' | 'delete'` (Task 9 supports these).
- `solution`: the scripted steps for the levels test, using `drive.js` step types: `{ sql }`, `{ form: [table, action, fields, keyRow] }`, `{ predict: [id, choice] }`, `{ variant }`, `{ tryFix }`, `{ applyFix, cleanup }`, `{ decide }`, `{ runAll }`, `{ policies }`, `{ soft: [table, keyRow] }`, `{ judge }`, `{ flag }`. A flag step is for UI-only actions such as the Level 6 error-reading card.

#### Level 3 in full (the model for every level file)

```js
// Constraint Gauntlet: Level 3, Duplicate Accounts (11.1, UNIQUE).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const student = {
    name: 'Student',
    columns: [
      { name: 'student_id', type: 'int', pk: true },
      { name: 'mu_id', type: 'varchar', size: 9, notNull: true, unique: true },
      { name: 'first_name', type: 'varchar', size: 50, notNull: true },
      { name: 'last_name', type: 'varchar', size: 50, notNull: true },
      { name: 'email', type: 'varchar', size: 255, notNull: true, unique: true },
      { name: 'secondary_email', type: 'varchar', size: 255, unique: true },
    ],
  };
  const withCol = (t, name, change) => Object.assign({}, t, { columns: t.columns.map(c => (c.name === name ? Object.assign({}, c, change) : c)) });

  const level = {
    id: 3, title: 'Duplicate Accounts', section: '11.1',
    mission: 'Make each email belong to just one student.',
    tables: [student],
    seed: { Student: [
      { student_id: 1, mu_id: '901234561', first_name: 'Maya', last_name: 'Patel', email: 'maya.patel@marshall.edu', secondary_email: 'mayap@gmail.com' },
      { student_id: 2, mu_id: '901234562', first_name: 'Jordan', last_name: 'Lee', email: 'jlee@marshall.edu', secondary_email: null },
      { student_id: 3, mu_id: '901234563', first_name: 'Taylor', last_name: 'Brooks', email: 'taylor@marshall.edu', secondary_email: null },
    ] },
    rules: [
      { id: 'one-person', table: 'Student', text: 'an email address belongs to one person, whatever the capital letters',
        check: (row, ctx) => !ctx.query('SELECT rowid AS _rowid FROM Student WHERE lower(email) = lower(?)', [row.email])
          .some(r => r._rowid !== ctx.self) },
      { id: 'one-mu-id', table: 'Student', text: 'each MU ID belongs to one student',
        check: (row, ctx) => !ctx.query('SELECT rowid AS _rowid FROM Student WHERE mu_id = ?', [row.mu_id]).some(r => r._rowid !== ctx.self) },
      { id: 'names', table: 'Student', text: 'a student has a first and last name',
        check: row => !CGR().isBlank(row.first_name) && !CGR().isBlank(row.last_name) },
    ],
    legitRows: [
      { table: 'Student', note: 'a new student', row: { student_id: 10, mu_id: '901234570', first_name: 'Chris', last_name: 'Osei', email: 'chris.osei@marshall.edu', secondary_email: null } },
      { table: 'Student', note: 'a different address that looks similar', row: { student_id: 11, mu_id: '901234571', first_name: 'Taylor', last_name: 'Reed', email: 'taylor@mail.marshall.edu', secondary_email: null } },
      { table: 'Student', note: 'another student with no secondary email', row: { student_id: 12, mu_id: '901234572', first_name: 'Priya', last_name: 'Shah', email: 'priya.shah@marshall.edu', secondary_email: null } },
    ],
    badRows: [
      { table: 'Student', note: 'Taylor again, in capitals', row: { student_id: 20, mu_id: '901234580', first_name: 'Taylor', last_name: 'Brooks', email: 'TAYLOR@MARSHALL.EDU', secondary_email: null } },
      { table: 'Student', note: 'the exact same email', row: { student_id: 21, mu_id: '901234581', first_name: 'M', last_name: 'Patel', email: 'maya.patel@marshall.edu', secondary_email: null } },
      { table: 'Student', note: 'Maya with a capital M', row: { student_id: 22, mu_id: '901234582', first_name: 'Maya', last_name: 'Patel', email: 'Maya.Patel@marshall.edu', secondary_email: null } },
      { table: 'Student', note: 'the same MU ID', row: { student_id: 23, mu_id: '901234562', first_name: 'Jo', last_name: 'Lee', email: 'jo.lee@marshall.edu', secondary_email: null } },
    ],
    predict: [
      { id: 'null-unique', question: 'Two students already have no secondary email. Will UNIQUE stop a third one with no secondary email?',
        choices: [{ id: 'yes', text: 'Yes, that would be a duplicate' }, { id: 'no', text: 'No, it will be accepted' }],
        answer: 'no', why: 'Blank (NULL) means "no value", and one NULL is never equal to another. So UNIQUE has nothing to compare.' },
    ],
    goals: [
      { id: 'add', text: 'Register a new student', kind: 'accepted', table: 'Student', match: r => r.student_id > 3 },
      { id: 'mu', text: 'Get a UNIQUE error on mu_id', kind: 'rejected-by', errorKind: 'unique', column: 'mu_id' },
      { id: 'email', text: 'Get a UNIQUE error on email', kind: 'rejected-by', errorKind: 'unique', column: 'email' },
      { id: 'predict', text: 'Predict: does UNIQUE stop blanks?', kind: 'predicted', predict: 'null-unique' },
      { id: 'sneak', text: 'Sneak the same person in twice', kind: 'slipped', rule: 'one-person' },
      { id: 'fix', text: 'Fix the rule so it can’t happen again', kind: 'fixed', table: 'Student' },
    ],
    fix: { table: 'Student', unlock: 'slipped', options: [
      { id: 'pair', label: 'UNIQUE (email, first_name)', correct: false,
        why: 'Now the same email is allowed again, as long as the first name differs, and capitals still get through.',
        change: t => Object.assign(withCol(t, 'email', { unique: false }), { constraints: [{ kind: 'unique', columns: ['email', 'first_name'] }] }) },
      { id: 'nocase', label: 'email … UNIQUE COLLATE NOCASE', correct: true,
        why: 'NOCASE tells the database to ignore capital letters when it compares emails.',
        change: t => withCol(t, 'email', { collate: 'NOCASE' }) },
      { id: 'none', label: 'Remove UNIQUE and check emails in the app instead', correct: false,
        why: 'Then nothing stops a script, an import, or a second app from adding duplicates. Section 11.4 has more on this.',
        change: t => withCol(t, 'email', { unique: false }) },
    ] },
    sqlStart: "-- Try registering a student. Press Run (or Ctrl+Enter).\nINSERT INTO Student (student_id, mu_id, first_name, last_name, email, secondary_email)\nVALUES (4, '901234564', 'Chris', 'Osei', 'chris.osei@marshall.edu', NULL);",
    done: 'UNIQUE only blocks exact matches. Deciding what counts as "the same" (capital letters, spaces) is a business decision you write into the rule.',
    solution: [
      { sql: "INSERT INTO Student VALUES (4, '901234564', 'Chris', 'Osei', 'chris.osei@marshall.edu', NULL)" },
      { sql: "INSERT INTO Student VALUES (5, '901234561', 'Sam', 'Ng', 'sam.ng@marshall.edu', NULL)", expect: 'rejected' },
      { sql: "INSERT INTO Student VALUES (5, '901234565', 'Sam', 'Ng', 'jlee@marshall.edu', NULL)", expect: 'rejected' },
      { predict: ['null-unique', 'no'] },
      { sql: "INSERT INTO Student VALUES (5, '901234565', 'Sam', 'Ng', 'sam.ng@marshall.edu', NULL)" },
      { sql: "INSERT INTO Student VALUES (6, '901234566', 'Taylor', 'Brooks', 'Taylor@marshall.edu', NULL)", expect: 'slipped' },
      { tryFix: { optionId: 'nocase' }, expect: 'passed' },
      { applyFix: { optionId: 'nocase' }, cleanup: 'delete', expect: 'rows-then-ok' },
    ],
  };

  function CGR() { return isNode ? require('../rules.js') : root.CG; }
  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
```

#### Level 1: Required Fields (11.1, NOT NULL)
- **Tables:** `Ticket` exactly as the chapter's first example: `ticket_id`, `student_id`, `concert_id`, `price_paid DECIMAL(8,2)`, `purchase_date DATE`, all NOT NULL. **Variant `loose`:** the same, but `purchase_date` can be blank. Seed: the 4 world tickets.
- **Rules:** `has-student`, `has-concert`, `has-price`, `has-date` (text for `has-date`: "a ticket needs a purchase date, or it disappears from date reports").
- **Reports:** `nov`: "Tickets sold in November" → `SELECT COUNT(*) AS tickets, SUM(price_paid) AS revenue FROM Ticket WHERE purchase_date BETWEEN '2026-11-01' AND '2026-11-30'`. `all`: "Tickets in the table" → `SELECT COUNT(*) AS tickets, SUM(price_paid) AS revenue FROM Ticket`. The report view shows them side by side and highlights them when they differ.
- **Predict:** `blank-price`: "Will the database take a ticket with no price?" (no).
- **Goals:** `add` (accepted Ticket), `blanks` (rejected-by `notnull`, `distinct: 3`, `distinctBy: 'column'`), `predict`, `missing` (state: the variant is `loose`, an attempt slipped with `has-date`, and the two reports' counts differ).
- **No fix.** The Rules panel shows the loose and strict DDL side by side once `missing` is met.
- **Done:** "The loose table didn't give you an error. It gave you a wrong report. That's worse."

#### Level 2: Blank on Purpose (11.1, NULL: unknown vs. not applicable)
- **Tables:** `Student` (`student_id`, `first_name`, `middle_name`, `last_name`, `email`, `gpa DECIMAL(3,2)`, `secondary_email`, `has_secondary_email BOOLEAN NOT NULL DEFAULT false`) and `Ticket` (`ticket_id`, `student_id`, `concert_id`, `seat_section`, `seat_number VARCHAR(5)`, `price_paid`, `purchase_date`, `refund_date DATE`). No foreign keys.
- **Decision columns** (the board in Task 19) and the key:

| Column | Required? | Blank means | Why (shown after the batch) |
|---|---|---|---|
| `middle_name` | can be blank | either | Some people have none (not applicable), and sometimes we just don't know it. The chapter allows both. |
| `last_name` | required | — | A student record without a last name is incomplete. |
| `gpa` | can be blank | **unknown** | A first-semester student has a GPA category, but no number yet. |
| `secondary_email` | can be blank | either | This is the chapter's ambiguous one. The fix is `has_secondary_email`, which says which meaning applies. |
| `seat_number` | can be blank | **not applicable** | Lawn tickets are general admission. There's no seat. |
| `purchase_date` | required | — | Without it, the ticket vanishes from date reports (Level 1). |
| `refund_date` | can be blank | **not applicable** | A ticket that was never refunded has no refund date. That's not missing data. |

  (Spec §6 was updated to match: the chapter's own text allows both readings of `middle_name`.)
- **Batch (12 rows):** students Ana Ruiz (no middle name), Chris Osei (no GPA, first semester), Priya Shah (no secondary email, `has_secondary_email = false`), Devon Price (everything filled in), and **Sam (no last name: bad)**. Tickets: a Lawn ticket with no seat number, a never-refunded Floor ticket with seat `A12`, a refunded ticket with a `refund_date`, two more ordinary tickets, a Lower-bowl ticket with seat `214`, and **a ticket with no purchase date (bad)**. Rules mark the two bad rows.
- **Goals:** `batch` (flag `batchClean`, which needs no too-strict rows, no too-loose rows, and tags matching the key).
- **Done:** "NULL can mean 'we don't know yet' or 'this doesn't apply'. When it matters which, add a column that says so."

#### Level 4: Double-Booked Venue (11.1, composite UNIQUE)
- **Tables:** `Venue` (`venue_id`, `name`, `city`) and `Concert` (`concert_id`, `artist`, `venue_id INT NOT NULL`, `concert_date DATE NOT NULL`, `start_time`, `end_time`), with the starting table constraint `UNIQUE (venue_id)` (too strict on purpose). **No REFERENCES** (11.1). Seed: the world's venues and concerts.
- **Rules:** `one-show-per-night`: no other concert at the same venue on the same date (ignoring `ctx.self`).
- **"Too strict" detection:** a rejected attempt whose `broken` list is empty. The session sets `flags.tooStrict` when it sees one, and the result view shows spec §7.4's second line.
- **Fix** (unlock `'too-strict'`): `date` = `UNIQUE (concert_date)` (wrong: two venues can't share a night); `pair` = `UNIQUE (venue_id, concert_date)` (correct); `both` = `UNIQUE (venue_id), UNIQUE (concert_date)` (wrong: stricter still).
- **Legit rows:** a second show at venue 1 on 2027-02-21, and a show at venue 2 on 2027-02-14 (the same night as Zach Bryan, at a different venue). **Bad:** another show at venue 1 on 2027-02-14.
- **Predict** (after the fix): `diff-date` (accepted), `diff-venue` (accepted), `same-both` (rejected).
- **Goals:** `strict` (flag `tooStrict`), `fix` (fixed Concert), and the three predictions.
- **Done:** "A composite UNIQUE checks the combination. Each column on its own can repeat."

#### `levels-index.js`
Sorts `CG.LEVELS` by id into `CG.levels`, and checks the ids run 1–8 with no gaps (it throws otherwise). `build.js` (Task 15) loads the level files before it.

#### `test/drive.js` and `test/levels.test.js`
`drive.js` exports `playSolution(SQL, level) → { session, results }`. It runs each `solution` step through the session and asserts each step's `expect`, if given (`'accepted' | 'rejected' | 'slipped' | 'passed' | 'failed' | 'rows-then-ok'`). `rows-then-ok` means `applyFix` first returns `reason: 'rows'`, then succeeds with the cleanup.

`levels.test.js` runs these checks for **every** level file it finds:
1. The schema builds and the seed loads with foreign keys on (every variant too).
2. `playSolution` ends with `session.complete() === true`.
3. Every `legitRows` row breaks no rules, and every `badRows` row breaks at least one.
4. For each fix: the correct option passes `fixTest` with an **empty** attempt log, and every wrong option fails on at least one named row (unless `test: false`).
5. No level with `section: '11.1'` has an `fk` in any table or variant (concept order).
6. Every `predict` has its `answer` among its choices (functions are called on a fresh session).
7. Every rule id a goal names exists. Every goal id is unique within its level.
8. The shown DDL (`hidden: false`) of every table contains no `cg_`.
9. All on-screen strings in the level (title, mission, goal texts, rule texts, whys, done) pass a simple reading check: no sentence longer than 25 words. (The book's CI reading-level check covers the chapters. This is the tool's lightweight equivalent.)

- [ ] **Step 1:** Write `drive.js` and `levels.test.js`. They fail (no levels yet).
- [ ] **Step 2:** Write `levels-index.js` and Level 3 (above). Run: Level 3 passes every check.
- [ ] **Step 3:** Write Levels 1, 2, and 4 with their solutions. Run: all pass.
- [ ] **Step 4: Commit** `Constraint Gauntlet: levels 1-4`.

---

### Task 13: Levels 5–8

**Files:**
- Create: `src/levels/05-price-rules.js`, `06-ghost-ticket.js`, `07-load-day.js`, `08-delete-policies.js`

#### Level 5: Price and Quantity Rules (11.1, CHECK)
- **Tables (no REFERENCES):**
  - `Ticket`: `ticket_id`, `student_id`, `concert_id`, `price_paid DECIMAL(8,2) NOT NULL CHECK (price_paid >= 0)`, `quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 10)`, `seat_section VARCHAR(10) NOT NULL CHECK (seat_section IN ('Floor','Lower','Upper','Lawn'))`, `purchase_date`.
  - `Concert`: the Level 4 columns plus `CONSTRAINT ends_after_start CHECK (end_time > start_time)`.
  - `Student`: `student_id`, `first_name`, `email VARCHAR(255) NOT NULL UNIQUE CHECK (email LIKE '%@%')`.
- **Rules:** `more-than-zero` ("tickets sold here cost more than $0. Free comps are handled by the box office"), `real-email` (JS `/^.+@.+\..+$/`, which matches the reference fix `LIKE '_%@_%._%'`), plus mirrors of the quantity, section, and time rules (so those can't slip through).
- **Predict:** `floor`: "Will the database take a seat section of `floor`, in lower case?" (no, `IN` is case-sensitive).
- **Fix** (array; each unlocks when its table's slip-through happens; `builder: true`): Ticket's `price_paid` check, and Student's `email` check. The builder offers column ▾, operator ▾ (`>`, `>=`, `<`, `<=`, `=`, `BETWEEN`, `IN`, `LIKE`), and value. SQL mode takes a typed expression (`checkExpression`). The new expression **replaces** that column's check.
- **Legit:** a 45.00 ticket; `chris.osei@marshall.edu`. **Bad:** a 0.00 ticket; `@`; `a@b`.
- **Goals:** `checks` (rejected-by `check`, `distinct: 4`, `distinctBy: 'rule'`), `free` (slipped `more-than-zero`), `at` (slipped `real-email`), `predict`, `fix-price` (fixed Ticket), `fix-email` (fixed Student).
- **Done text** ends with the chapter note from spec §6: "The chapter's rule allows free tickets. This box office doesn't. Rules depend on the business."

#### Level 6: Ghost Ticket (11.2, foreign keys)
- **Tables:** `Student`, `Concert`, and `Ticket` (`ticket_id`, `student_id INT NOT NULL REFERENCES Student(student_id) ON DELETE RESTRICT`, `concert_id INT NOT NULL REFERENCES Concert(concert_id) ON DELETE RESTRICT`, `price_paid`, `purchase_date`), which is the chapter's 11.2 example. **Variant `nofk`** (start): Ticket without REFERENCES.
- **Rules:** `has-student` and `has-concert` (the parent exists, via `ctx.query`).
- **Report:** `join`: "Tickets by student" → `SELECT COUNT(*) AS tickets FROM Ticket JOIN Student ON Student.student_id = Ticket.student_id`, beside "Tickets in the table". The orphan row is highlighted in the Ticket grid when the two differ.
- **Fix** (unlock `'slipped'`, applied to the `nofk` game): `nn` = "Make student_id NOT NULL" (wrong: it already is, and NOT NULL doesn't check that the student exists); `unique` = "UNIQUE (student_id)" (wrong: too strict, a student can't buy two tickets); `fk` = "Add REFERENCES Student(student_id) and REFERENCES Concert(concert_id)" (correct). Applying `fk` over the student's orphan returns `reason: 'orphans'`. The cleanup choices come from Task 10.
- **Read the error card** (UI, Task 17): after the first `fk-parent` rejection, three dropdowns (Which table? Which column? Which value?), with choices from the schema and the attempt. Answering sets `flags.readError` and reveals the right answers.
- **Legit:** a ticket for student 2, concert 1. **Bad:** a ticket for student 99999; a ticket for concert 42.
- **Goals:** `ghost` (slipped `has-student`), `fix` (fixed Ticket), `applied` (state: the game has the `fk` columns), `insert` (rejected-by `fk-parent`, `attemptKind: 'insert'`), `update` (rejected-by `fk-parent`, `attemptKind: 'update'`), `read` (flag `readError`).
- **Done:** "A foreign key is a promise: every ticket points to a real student. The database keeps the promise, so your reports don't have to guess."

#### Level 7: Load Day (11.2, parent before child)
- **Tables:** `Venue`, `Concert` (`venue_id` REFERENCES Venue), `Student`, `Ticket` (REFERENCES Student and Concert), all empty. **Bonus tables:** `Team` (`team_id`, `name`, `captain_id INT NOT NULL REFERENCES Player(player_id)`) and `Player` (`player_id`, `name`, `team_id INT NOT NULL REFERENCES Team(team_id)`), empty. (SQLite allows a REFERENCES to a table created later. Task 1's tests don't cover that, so this level's schema test does.)
- **Cards:** 12 INSERTs (2 venues, 3 concerts, 3 students, 4 tickets), each with a short label ("Ticket: Maya → Zach Bryan"). Shuffled with a seeded shuffle (`level.shuffleSeed`, a mulberry32 copied into the level file), so the classroom sees the same order. There are 4 bonus cards (1 team, 3 players).
- **Row form mode:** clicking a card runs it (`source: 'card'`). A bounced card goes back to the stack with its error. **SQL mode:** the cards appear as statements in the editor, and **Run all** uses `runAll` (decision 3 in spec §12).
- **Predict:** `order`: "Which load order always works?" Choices: alphabetical; tickets first; parents before children (correct, with the chapter's 1–4 list as the why).
- **Bonus fix** (`test: false`, unlock `'always'` once a bonus card bounces): `captain` = `captain_id` can be blank; `team` = `Player.team_id` can be blank. **Both are correct.** Either one breaks the circle, and the why says so.
- **Goals:** `loaded` (state: every main table has its card count), `predict`, and `bonus` (optional; state: Team and Player loaded, the captain set, and every player has a team).
- **Done:** "The database won't let a row point at something that isn't there yet. Load parents first, children last."

#### Level 8: Delete Policies (11.2)
- **Tables:**
  - `Student` (`student_id`, `first_name`, `last_name`, `is_active BOOLEAN NOT NULL DEFAULT true`).
  - `Venue`.
  - `Concert` (REFERENCES Venue, policy chosen in Round 3).
  - `ConcertPerformer` (`concert_id` REFERENCES Concert, `performer VARCHAR(100)`, with PRIMARY KEY on both columns via a table constraint).
  - `Ticket` (`ticket_id`, `student_id INT REFERENCES Student(student_id) ON DELETE <policy>`, which **can be blank**, so SET NULL works; the Rules panel says why; `concert_id` NOT NULL REFERENCES Concert RESTRICT; `price_paid`).
  - `Scan` (`scan_id`, `ticket_id INT NOT NULL REFERENCES Ticket(ticket_id) ON DELETE <policy>`, `scanned_at TIME`).
  - **The schema needs a composite primary key.** Add `{ kind: 'pk', columns: [...] }` table constraints to `schema.js` in this task, with a test (`PRIMARY KEY (concert_id, performer)`, NOT NULL on both).
- **Seed:** Jordan (2) has tickets 1–3 with 2 scans each. Maya (1) has 1 ticket with 1 scan. Taylor (3) has 1 ticket. Concerts 1–3 as in the world, plus **concert 4, "created by mistake"**: venue 1, no tickets, 2 ConcertPerformer rows.
- **Round 1:** `setPolicies({ 'Ticket.student_id': 'RESTRICT' | 'CASCADE' | 'SET NULL', 'Scan.ticket_id': 'RESTRICT' | 'CASCADE' })`. Each delete attempt records the policies in effect (`attempt.policies`). **Predict** `blast` before a Student delete, with choices `blocked`, `1`, `4`, `10`; the `answer` function uses `simulateDelete` under the current policies.
- **Round 2:** **Mark inactive** → `softDelete('Student', { student_id: 2 })`. **Report** `revenue`: "Concert revenue" → `SELECT SUM(price_paid) FROM Ticket` (it keeps its total after a soft delete, but not after a CASCADE).
- **Round 3:** `judgePolicies(map)` over `Ticket → Student`, `Scan → Ticket`, `Concert → Venue`, and `ConcertPerformer → Concert`. Test deletes: Jordan, ticket 1, venue 1, and concert 4. The key (approved, spec §12):

| Relationship | Accepted | Best | Notes |
|---|---|---|---|
| Ticket → Student | RESTRICT, SET NULL | RESTRICT + soft delete | CASCADE erases sales history. SET NULL keeps the money but loses who bought. |
| Scan → Ticket | RESTRICT, CASCADE | either | A scan means nothing without its ticket, so CASCADE is fine. RESTRICT is the careful choice. |
| Concert → Venue | RESTRICT | RESTRICT | A closed venue shouldn't erase the concerts it hosted. |
| ConcertPerformer → Concert | CASCADE, RESTRICT | CASCADE | The chapter's own example of a safe CASCADE. RESTRICT works but means extra cleanup. |

- **Goals:** `restrict`, `cascade`, and `setnull` (state: a Student delete was attempted under each `Ticket.student_id` policy), `predict`, `soft` (flag `softDeleted`, and the revenue report is unchanged from the seed), `choose` (flag `policiesPassed`).
- **Done:** "Deleting is forever. When a record has history, mark it inactive instead."

- [ ] **Step 1:** Add composite primary keys to `schema.js` (with a test).
- [ ] **Step 2:** Write the four levels with solutions.
- [ ] **Step 3:** Run `levels.test.js`: all eight levels pass every check.
- [ ] **Step 4: Commit** `Constraint Gauntlet: levels 5-8`.

---
### Task 14: Homework text, saved progress, and the zoom shim

**Files:**
- Create: `src/export.js`, `src/progress.js`, `src/shim.js`
- Test: `test/export.test.js`, `test/progress.test.js`

**`export.js`:** `homeworkText(level, sessionState, goalsDone) → string`, in exactly the layout in spec §10. Attempts are newest first and capped at 20, with "(showing 20 of 31 attempts)". Each attempt's SQL is collapsed to one line and cut to 90 characters with `…`. Tabs and newlines in values become spaces. The "My fix" block shows the **shown** DDL line(s) that changed, not hidden checks. Predictions list the question, "I said", and "Answer". Without a fix or predictions, those blocks are left out.

**`progress.js`:** `STORAGE_KEY = 'constraintGauntlet.progress.v1'`, `loadProgress(storage) → { mode: 'form' | 'sql', levels: { [id]: { goals: [ids], complete: bool } } }`, `saveProgress(storage, p)`, `markGoals(p, levelId, metIds, complete) → p` (adds, never removes; Reset doesn't clear them). Every storage access is in try/catch. Bad JSON, unknown ids, and a wrong `mode` fall back to defaults. Same pattern as SQL Studio's `prefs.js` (`sanitize` then use).

**`shim.js`:** browser only, loaded right after SQL Studio's shared files:

```js
// Constraint Gauntlet: supplies SS.stepZoom for SQL Studio's panels.js (normally from SQL Studio's prefs.js).
(function (root) {
  'use strict';
  const SS = root.SS;
  if (!SS.stepZoom) SS.stepZoom = (v, dir) => Math.min(200, Math.max(70, Math.round(v / 10) * 10 + dir * 10));
})(this);
```

A test in `build.test.js` (Task 15) checks that this matches SQL Studio's `stepZoom` for values 70 to 200, both directions, so the two tools zoom the same way.

- [ ] **Steps:** tests, then code, then pass. **Commit** `Constraint Gauntlet: homework text and saved progress`.

---

### Task 15: The page shell, styles, and the build

**Files:**
- Create: `build.js`, `src/index.html`, `src/styles.css`
- Test: `test/build.test.js`

**`build.js`** follows SQL Studio's `build.js` closely (read it first). The differences:

```js
const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const STUDIO = path.join(ROOT, '..', 'sql-studio');
const VENDOR = path.join(STUDIO, 'vendor');
const OUT = path.join(ROOT, 'dist', 'constraint-gauntlet.html');

const VENDOR_CSS = ['codemirror/codemirror.css', 'codemirror/show-hint.css'];
const VENDOR_JS = ['codemirror/codemirror.js', 'codemirror/mode-sql.js', 'codemirror/show-hint.js', 'codemirror/sql-hint.js',
  'codemirror/active-line.js', 'codemirror/matchbrackets.js', 'sql.js/sql-wasm.js'];          // no SheetJS
const SHARED = ['sql-text.js', 'errors.js', 'dom.js', 'icons.js', 'panels.js', 'editor.js']; // from ../sql-studio/src, unchanged

// Load order: shared SS files, the shim, then our files. Level files go where 'LEVELS' is.
const SCRIPT_ORDER = ['schema.js', 'db.js', 'statement.js', 'rowform-sql.js', 'probe.js', 'blast.js', 'constraint-errors.js',
  'rules.js', 'goals.js', 'rebuild.js', 'session.js', 'LEVELS', 'levels-index.js', 'export.js', 'progress.js',
  'layout.js', 'rowform-view.js', 'sql-view.js', 'tables-view.js', 'result-view.js', 'goals-view.js',
  'rules-view.js', 'fix-view.js', 'boards-view.js', 'blast-view.js', 'export-dialog.js', 'app.js'];
```

- Shared files are inlined from `../sql-studio/src/` with a header comment `// ---- shared from tools/sql-studio/src/<file> (do not edit here) ----`.
- The wasm is inlined as `window.CG_WASM_BASE64`.
- Missing `src` files are skipped, as in SQL Studio, so the build works at every task.
- `export { build, OUT, SCRIPT_ORDER, SHARED, VENDOR_JS }`.

**`index.html`:** the same head as SQL Studio's (fonts link, `/* INLINE_CSS */`, `<!-- INLINE_JS -->`), the title "Constraint Gauntlet", and a `<main id="app">` with a no-JavaScript message. `app.js` builds everything else.

**`styles.css`:** start with the `:root` token blocks copied **exactly** from `tools/sql-studio/src/styles.css` (light, dark via `prefers-color-scheme` guarded by `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`), then SQL Studio's base, button, panel, splitter, and error-box rules (copy, don't import). Then add:
- `.cg-result--ok` (teal), `.cg-result--slipped` (amber, `--amber` token; if SQL Studio has none, add `--amber` and `--amber-bg` to all three token blocks here, with AA-contrast values checked in Task 22).
- `.cg-chip` (rounded label pairs for table · rule · value).
- `.cg-row--new` (one flash, none with reduced motion), `.cg-row--bounced` (dashed outline, with a "bounced" text label), `.cg-row--slipped` (amber dot plus a "slipped through" label).
- `.cg-goal` (circle, check), the goals strip complete state (green), `.cg-card` (Level 7 cards), `.cg-bar` (blast bars), `.cg-predict`, `.cg-board`.
- Mobile stacking below 760px: Goals, Input, Result, Tables, Rules.

**Tests (`build.test.js`):**
- The output exists and contains the wasm.
- It has no `</script` inside any inlined part.
- It makes no `http` requests other than fonts.
- Every `SHARED` file is byte-identical to its source in `tools/sql-studio/src/`.
- The vendor hashes match (this reuses `vendor.test.js`'s parser).
- The shim's `stepZoom` matches SQL Studio's (Task 14).
- Every file in `src/levels/` is included.

- [ ] **Step 1:** Tests (they fail). **Step 2:** Write the files. **Step 3:** `node tools/constraint-gauntlet/build.js` and pass. **Step 4:** Open the built page in a browser. It shows the no-JS message replaced by an empty shell (until Task 21). **Commit** (with `dist/`) `Constraint Gauntlet: page shell and build`.

---

### Task 16: Layout and the input panel (Row form and SQL)

**Files:**
- Create: `src/layout.js`, `src/rowform-view.js`, `src/sql-view.js`

**`layout.js`:** builds the header (shield icon, title, mission line, the Level picker `<select>` with ✓ on completed levels, and Reset level with a confirm dialog), the Goals strip, and the panels with `SS.panel` from `panels.js`: Input (left) and Tables (right) with a vertical splitter, then the Result box (not a panel; always visible), and Rules at the bottom. Sizes and zoom are saved under `constraintGauntlet.layout.v1`. Read `tools/sql-studio/src/layout.js` and `panels.js` first and use their splitter and collapse code by calling it, not copying it.

**`rowform-view.js`:** spec §5.1.
- The table picker is limited to `level.formTables`.
- The three actions are Add row, Edit a row, and Delete. Edit and Delete need a selected row in the Tables grid. Until one is chosen, they show "Pick a row in the table first."
- One labeled input per column, with hint text from the schema (`required`, `unique`, `1–10`, `must match a Student`, `blank = NULL`). Booleans are a two-option `<select>` (true/false) plus blank if nullable.
- The primary key field is pre-filled with `nextId` and labeled "auto".
- Type problems from `runForm` show under each field with `aria-describedby`.
- The live SQL preview (read-only CodeMirror, or a `<pre>` with the same highlighting) has Copy SQL and **Open in SQL tab**.
- After a constraint error, the fields in `explained.columns` are outlined, with `aria-invalid="true"`, until the next edit.
- The main action button is filled teal.

**`sql-view.js`:** spec §5.2. It uses `SS.createEditor` from SQL Studio's `editor.js`, with autocomplete from `toStudioSchema(game.tables)`. The starting text is `level.sqlStart`. Each level keeps its own editor text for the session (in memory). Run (Ctrl/⌘+Enter) runs the statement at the cursor with `SS.statementAt`. In Level 7, **Run all** runs every statement top to bottom. Syntax errors use SQL Studio's error box and its wavy underline. Blocked statements show the friendly message from `classify`.

**Mode switch:** two tabs, Row form | SQL (`role="tablist"`). The choice is saved via `progress.js`. Row form is the default.

- [ ] **Steps:** build each view, rebuild, and check it by hand in the browser against a stub session (`createSession` on Level 3). **Commit** `Constraint Gauntlet: layout and input panel`.

---

### Task 17: Tables, result box, goals strip, report cards, predict and read-the-error cards

**Files:**
- Create: `src/tables-view.js`, `src/result-view.js`, `src/goals-view.js`

- **Tables:** tabs per table. A grid in primary key order, with booleans as true/false and NULL shown as a dim `NULL`. FK columns get the key-link icon SQL Studio's ERD uses. A clicked or arrow-keyed row is "selected" for Edit and Delete. Newly added or changed rows flash once. Under the grid: the latest bounced row (dashed, labeled "bounced", with its rule) until the next attempt. Slipped rows keep an amber dot and label for the session. **Report cards** sit above the grids when the level has `reports`. They re-run after every attempt, and when two reports in a level differ in their first column, both are outlined with the note "These don't match."
- **Result box:** spec §7.1, three states. The chips are `table · rule · value`. "What SQLite said" is small text. For a rejected attempt with an empty `broken` list, it adds the spec §7.4 line. For a delete, it embeds the blast view (Task 19). `role="alert"` for errors; the polite live region otherwise.
- **Goals strip:** collapsed shows "Goals 3 of 6" and the next unmet goal. Expanded lists them all with circles and checks. Optional goals are marked "(bonus)". When complete, it turns green with "Level complete" and shows `level.done`. **Copy for homework** opens Task 20's dialog.
- **Predict cards:** when the next action matches a predict's `before` (or the level's flow asks for one), a small card appears above the Result box with the question and choice buttons. Picking one records it, then shows ✓ or ✗ with the `why`. Predictions are never scored, so the wording is "Here's what happens" not "Wrong".
- **Read-the-error card** (Level 6): spec'd in Task 13. Three `<select>`s filled from the last `fk-parent` attempt. Check shows the answers.

- [ ] **Steps:** build, rebuild, and check by hand on Levels 1, 3, and 6. **Commit** `Constraint Gauntlet: tables, results, goals, and cards`.

---

### Task 18: Rules panel and Fix the rule

**Files:**
- Create: `src/rules-view.js`, `src/fix-view.js`

- **Rules panel:** the shown DDL (`createTableSql(t, { hidden: false })`) for the selected table, highlighted with CodeMirror's SQL mode (read-only), with each constraint clause wrapped in a highlighted mark. In Level 1, once `missing` is met, the loose and strict versions show side by side. **Fix the rule** button: locked with a lock icon and the tooltip "Find the hole first" until the fix's `unlock` condition is met (`'slipped'`: an attempt slipped through on that table; `'too-strict'`: `flags.tooStrict`; `'always'`).
- **Fix view** (opens below the Rules panel):
  - **Choices:** radio buttons with each option's `label` in code style. **Test this rule** runs `tryFix` and shows the fix-test table from spec §8 (Row · Before · After · Verdict, with ✓/✗ and a text verdict, never color alone). The option's `why` appears after testing.
  - **Builder** (Level 5, Row form mode): column ▾, operator ▾, and value inputs (two for BETWEEN, a comma list for IN). It shows the expression it builds.
  - **Typed** (Level 5, SQL mode): a one-line CodeMirror for the expression, checked by `checkExpression`.
  - **Use this rule** appears once the test passes. It calls `applyFix`. On `reason: 'rows'` or `'orphans'`, it lists the rows with their explanations and offers **Delete these rows and apply** and **Reset the level's data and apply**, with the spec's sentence about real databases.
  - After it's applied, the Rules panel shows the new DDL with the changed line marked "changed".

- [ ] **Steps:** build, then check by hand on Levels 3, 4, 5 (both builder and typed), and 6. **Commit** `Constraint Gauntlet: Rules panel and Fix the rule`.

---

### Task 19: Level boards and the blast view

**Files:**
- Create: `src/boards-view.js`, `src/blast-view.js`

These replace the Input panel's body for the levels that need them. The mode tabs stay where they make sense.
- **Level 2 decision board:** a table with one row per decision column: column name, a **Required / Can be blank** switch, and (when blank is allowed) an **unknown / not applicable** choice. **Run the batch** calls `decide` and shows the "Rejected but real" and "Accepted but bad" lists and the tag check, then each column's why. Rows in the lists show the person or ticket in words ("Ana Ruiz has no middle name").
- **Level 7 card stack:** a grid of cards (label plus the INSERT in small code). In Row form mode, clicking a card runs it. A loaded card moves into a "Loaded" column. A bounced card shakes once (not with reduced motion), stays, and shows its error. A bounce counter: "Bounces: 3". The bonus round is a second stack that appears after the main one is loaded. In SQL mode, the stack is the editor's text and **Run all** is the action (Task 16).
- **Level 8 policy board:**
  - **Round 1:** two segmented controls (Ticket.student_id: RESTRICT · CASCADE · SET NULL; Scan.ticket_id: RESTRICT · CASCADE), each change calling `setPolicies`, and **Delete Jordan Lee**, which opens the blast predict card first. **Reset data** sits next to it.
  - **Round 2:** **Mark Jordan inactive.**
  - **Round 3:** four relationship rows with a policy choice each, and **Check my choices** (`judgePolicies`), with an explanation per row.
- **Blast view:** spec §9: one bar per table that lost rows (width proportional, minimum 1 unit, with the number as text), SET NULL lines as text ("3 tickets now have no student"), a total line, and "Blocked: 0 rows changed" for a blocked delete. It appears inside the Result box after any delete, in any level.

- [ ] **Steps:** build, then check by hand on Levels 2, 7 (both modes), and 8. **Commit** `Constraint Gauntlet: level boards and blast view`.

---

### Task 20: Copy for homework

**Files:**
- Create: `src/export-dialog.js`

Adapt `tools/sql-studio/src/export-dialog.js` (read it first): the same modal, focus trap, Escape, focus return, preview, **Copy** with the select-text fallback, and **Download .txt** (`constraint-gauntlet-level-3.txt`). The content comes from `homeworkText`. There's no exercise picker; it's the current level.

- [ ] **Steps:** build, check by hand. **Commit** `Constraint Gauntlet: Copy for homework`.

---

### Task 21: Wire it together

**Files:**
- Create: `src/app.js`

- On load: decode `CG_WASM_BASE64`, `initSqlJs({ wasmBinary })`, load progress, build the layout, and open **Level 1** (or the level in the URL hash, `#level-5`, so a teacher can link straight to a level).
- **State:** one `session` per open level (switching levels closes the old game and makes a new session; the attempt log is per session, as the spec says). After every session call, re-render the affected views, re-evaluate goals, save newly met goals with `markGoals`, and announce new check marks and "Level complete" in the live region.
- Level picker change → confirm only if the current level has attempts ("Leave this level? Your rows here will be cleared, but your check marks stay.").
- A failure to start sql.js shows a friendly full-page message: "The Gauntlet couldn't start its database. Try reloading, or use a recent version of Chrome, Edge, Firefox, or Safari."
- The theme toggle and footer match SQL Studio.

- [ ] **Step 1:** Write `app.js`. **Step 2:** Rebuild and play every level's solution by hand in the browser, once in each mode where both apply. **Step 3:** Run all Node tests. **Commit** (with `dist/`) `Constraint Gauntlet: wire it together`.

---

### Task 22: Browser check

Same approach as SQL Studio's Task 20: pre-installed Playwright Chromium, a script in the scratchpad (not a repo dependency), and screenshots sent to David.

- Laptop (1366×800), tablet (820×1180, touch), and phone (390×844), each in light and dark mode.
- **For each level:** load it from `#level-N`. Make one accepted, one rejected, and one slipped attempt (where the level has one) in Row form. Repeat one in SQL mode. Open Fix the rule where the level has it. Reach "Level complete" by replaying the level's `solution` through the UI (the script maps each step type to clicks and typing).
- **Keyboard only:** Level 3 from start to complete without the mouse, with focus-ring screenshots at each panel.
- **Contrast:** every text and UI color pair, including the new amber tokens, measured with a contrast script in the page. AA (4.5:1 text, 3:1 UI) in both themes.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no transitions or shakes.
- **Console:** no errors on any page. This is the same check `ci/smoke_test.js` runs in CI.
- **Storage blocked:** run Level 1 with `localStorage` throwing. The tool works, with nothing saved.

Fix anything found, then rebuild and re-run. **Commit** `Constraint Gauntlet: browser check fixes`.

---

### Task 23: Course integration and the pull request

**Files:**
- Modify: `tools/index.html`, `chapter-11.md`

- [ ] **Step 1: Tools index.** Add a "Chapter 11" section in the same card style as Chapter 8's, labeled "Use with Chapter 11", linking to `constraint-gauntlet.html`. The card text: "Try to get good data in, and bad data past the rules. Then fix the rules."
- [ ] **Step 2: Activity 11.0** in `chapter-11.md`, before Activity 11.1, in a gray box like Activity 8.0 (copy its structure exactly), linking to `https://kalendar.github.io/relational-thinking/constraint-gauntlet.html`:

  ```markdown
  ### Activity 11.0 — Constraint Gauntlet

  *This activity uses an interactive tool instead of an AI prompt. You'll try to put rows into a database that has rules, see what the database does, and fix the rules when bad data gets through.*

  [Open the Constraint Gauntlet](https://kalendar.github.io/relational-thinking/constraint-gauntlet.html)

  - After section 11.1, play Levels 1–5.
  - After section 11.2, play Levels 6–8.
  - When you finish a level, use **Copy for homework** and paste the result where your instructor asks.
  ```

  Then add Chapter 8's sentence to the activities intro: "Activity 11.0 is the one exception: it uses an interactive tool instead of a prompt."
- [ ] **Step 3: Local CI checks** (from `ci/README.md`): `ci/assemble_site.sh`, `python3 ci/lint_chapters.py --site _site` (the new tool link must resolve), `python3 ci/check_concept_order.py` (Chapter 11 is finalized, so this check **blocks**: Activity 11.0 must not introduce a concept the graph places later; INSERT/UPDATE/DELETE syntax shows up in the tool, not in the chapter text, so it should pass. If it doesn't, stop and show David), `python3 ci/check_reading_level.py --base master` (advisory), and `node --test` for every tool. Also confirm the chapter fix from 2026-11-10 ("a ticket price can't be negative") is in this branch.
- [ ] **Step 4: Commit** `Constraint Gauntlet: Chapter 11 activity and tools index`.
- [ ] **Step 5: Push and open the PR.** Push the `constraint-gauntlet` branch and open a PR to `master` titled "Constraint Gauntlet (Chapter 11 interactive)". The body summarizes what's in it, links the spec and this plan, lists the browser-check screenshots, and notes the chapter change (Chapter 11 is finalized, so merging republishes it to Pressbooks through CI). End the body with the attribution lines from the session's instructions. **Do not merge.** David reviews and merges, and the CI deploys the tools site and publishes Chapter 11.
  - If `gh` isn't available or authenticated on the machine (see the repo notes), stop after pushing the branch, or after the last commit if pushing fails too, and give David the exact `gh pr create` command to run.

---

## Spec coverage check (done while writing this plan)

| Spec section | Covered by |
|---|---|
| §1 Purpose, audience, out-of-scope transactions | Global Constraints; Task 4 blocks transactions |
| §2 Delivery, reuse, source layout | Tasks 1, 15 (shared files byte-identical, vendor hashes) |
| §3 Screen layout | Tasks 16–19 |
| §4 Level schema, seed | Tasks 2, 3, 12, 13 |
| §4 SQLite behaviors 1–9 | Task 1 (all pinned), Task 2 (type checks, PK NOT NULL), Task 3 (FK on), Task 7 (FK message), Task 8 (`changes()`) |
| §4 What may run | Task 4 (plus conflict clauses, Review Focus 2, which the spec didn't list) |
| §5.1 Row form | Tasks 5, 16 |
| §5.2 SQL mode | Tasks 4, 6, 16 |
| §6 Levels 1–8 | Tasks 12, 13 (Level 2's `middle_name` key relaxed to match the chapter; noted) |
| §7 Feedback | Tasks 7, 9, 11, 17 |
| §8 Fix the rule | Tasks 10, 18 |
| §9 Blast radius | Tasks 8, 19 |
| §10 Copy for homework | Tasks 14, 20 |
| §11 Layout, progress, accessibility | Tasks 14, 16, 21, 22 |
| §12 Decisions | Level 5 note (Task 13), progress (Task 14), Run all (Tasks 11, 16, 19), Level 8 key (Task 13), PR (Task 23) |
| §13 Testing | Tasks 1–15 (Node), Task 22 (browser) |
| §14 Course integration | Task 23 |
| §15 Out of scope | Nothing in this plan builds transactions, triggers, accounts, uploads, or an AI assistant |

**Found while planning** (checked against SQLite, and written into the spec or this plan):
1. `INT PRIMARY KEY` accepts NULL, more than once. Spec §4 item 8, and Task 2.
2. Hidden type checks need `IS NULL OR`. Spec §4 item 3, and Task 2.
3. A TEMP table with the same name hides the main table, even in qualified references. This lets Task 6 probe any statement without parsing it.
4. A CASCADE that runs into a RESTRICT further down is blocked as a whole. SET NULL on a NOT NULL column fails with a NOT NULL error, not an FK error. Both are in Task 8.
5. Conflict clauses (`OR REPLACE`, `ON CONFLICT`) would hide constraint errors. Task 4 blocks them.
6. SQL Studio's `panels.js` needs `SS.stepZoom` from its `prefs.js`. Task 14's shim supplies it, so no SQL Studio file changes.
