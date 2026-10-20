# SQL Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SQL Studio, a single-file browser tool where students write real SQL (run by SQLite in WebAssembly) against the ten Query Explorer data sets. It includes an editor, results, an ERD, a data preview, exercises with answer checking, and a random query generator.

**Architecture:** The source is plain JavaScript files in `tools/sql-studio/src/`, sharing one namespace, `window.SS`, the same way the Query Explorer uses `window.QE`. The logic files are pure and also load in Node, where `node:test` tests them against the vendored sql.js. The DOM files build the screen with an `h()` helper (no `innerHTML`). `build.js` inlines the vendored libraries (with sql.js's `.wasm` as base64), the Query Explorer's data set files (read in place), and the source files into `dist/sql-studio.html`.

**Tech Stack:** Plain JavaScript (ES2020), HTML, and CSS. Node 22 for the build and tests (`node:test`, `node:assert/strict`). Vendored and pinned: sql.js 1.14.2, CodeMirror 5.65.21, and SheetJS mini 0.20.3. There are no npm dependencies in the repo.

**Spec:** `docs/superpowers/specs/2026-10-19-sql-studio-design.md`

## Global Constraints

- The deliverable is one file, `tools/sql-studio/dist/sql-studio.html`. It works from `file://` and from `https://kalendar.github.io/relational-thinking/sql-studio.html`. Its only network request is the Google Fonts `<link>` (Montserrat, Nunito Sans), with system-font fallbacks.
- The data sets are **never copied**. `build.js` and the tests read `tools/query-explorer/src/datasets/*.js` in place, sorted by file name.
- Vendored versions are exact: **sql.js 1.14.2**, **CodeMirror 5.65.21**, **SheetJS 0.20.3 (xlsx.mini.min.js from cdn.sheetjs.com)**. `vendor/VERSIONS.md` records the SHA-256 of every vendored file, and a test checks them.
- Tests live in `tools/sql-studio/test/`, use `node:test`, and need nothing beyond the vendored sql.js. Run them all with `node --test tools/sql-studio/test/` (works through `test/index.js`, Task 1) or `node --test 'tools/sql-studio/test/*.test.js'`.
- Every source file follows the dual-load pattern in Task 2: a classic script in the browser (adds to `root.SS`) and `require()`-able in Node.
- Never put data into `innerHTML`. Build all DOM with `SS.h()` (Task 12).
- Colors use the `:root` tokens copied **exactly** from `tools/query-explorer/src/styles.css` (light, `prefers-color-scheme: dark` guarded by `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`). The only filled buttons are the data set picker and Run (`--teal`, text `--on-teal`).
- All on-screen text is at a 10th-grade reading level: short and friendly, and any jargon is explained.
- Queries are read-only: only `SELECT`, `WITH`, and `VALUES` run, and the database has `PRAGMA query_only = ON` as well.
- `localStorage` is used only for layout preferences, under key `sqlStudio.layout.v1`, and every access is wrapped in try/catch.
- Data sets 1–6 are practice (hint + Check). Data sets 7 and up are assessment (question only). This is controlled by `ASSESSMENT_FROM = 7`.
- Breakpoint: below 760px wide, the panels stack in this order: Exercises, SQL, Results, ERD, Data.
- Spec section numbers (§N) refer to the spec file above.
- Commit after every task with a message starting `SQL Studio: `. End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Runaway results:** a query that makes a huge result (a three-way Cartesian product, or `WITH RECURSIVE` with no end) must not freeze the tab. The rows are capped at 200,000, with `truncated: true` and a note. Tested in Task 4.
2. **Quotes and semicolons inside text:** `WHERE song_title = 'God''s Plan'` or `WHERE caption LIKE '%;%'` must not be split into two statements, and Format must not change them. Tested in Tasks 2 and 6.
3. **Swapped columns in Check:** `SELECT total_streams, artist_name` against an answer of `artist_name, total_streams` gives the "same size, different values" message and is not marked correct. Tested in Task 7.
4. **Spreadsheet formulas in exports:** a text cell that starts with `=`, `+`, `-`, or `@` (possible in uploaded data) is prefixed with `'` in CSV and TSV, so Excel doesn't run it as a formula. Numbers are never changed. Tested in Task 10.
5. **Switching data sets:** after switching away and back, the editor text is restored, and old error marks, results, and check messages are cleared, not shown against the wrong data. Tested in Task 13 (`sessions.js`).

---

## File Structure

```
tools/sql-studio/
  build.js                    # Task 12: inlines vendor + datasets + src into dist/sql-studio.html
  vendor/
    VERSIONS.md               # Task 1: versions, source URLs, SHA-256 per file
    sql.js/sql-wasm.js  sql.js/sql-wasm.wasm  sql.js/LICENSE
    codemirror/codemirror.js codemirror/codemirror.css codemirror/mode-sql.js
    codemirror/show-hint.js codemirror/show-hint.css codemirror/sql-hint.js
    codemirror/active-line.js codemirror/matchbrackets.js codemirror/LICENSE
    sheetjs/xlsx.mini.min.js  sheetjs/LICENSE
  src/
    index.html  styles.css                 # Task 12
    sql-text.js      # Task 2: tokenize, splitStatements, statementAt, aliasMap, lineCol
    schema.js        # Task 3: buildSchema, createStatements, loadSchema, relationships
    db.js            # Task 4: openStudio, runQuery, isReadOnly, row cap
    errors.js        # Task 5: explainError, closest
    format.js        # Task 6: formatSql
    check.js         # Task 7: compareResults, checkExercise
    exercises.js     # Task 8: EXERCISES, ASSESSMENT_FROM, exerciseLabel
    randomq.js       # Task 9: normalizeOptions, generateQuery, mulberry32
    export.js        # Task 10: toTSV, toCSV, textTable, homeworkText
    upload-parse.js  # Task 11: parseCSV, cleanName, inferType, buildUploadSchema
    prefs.js         # Task 13: DEFAULT_PREFS, loadPrefs, savePrefs (pure + storage)
    sessions.js      # Task 13: per-data-set editor text + view state (pure)
    erd-model.js     # Task 17: boxSize, tidyLayout, linkRoute, crowFoot (pure)
    dom.js  icons.js # Task 12
    layout.js        # Task 13: panels, splitters, collapse, zoom
    editor.js        # Task 14: CodeMirror setup, autocomplete, marks
    results-view.js  # Task 14
    exercises-view.js  export-dialog.js   # Task 15
    random-ui.js     # Task 16
    erd.js           # Task 17
    data-view.js     # Task 18
    upload.js        # Task 18
    app.js           # Task 19: state and wiring
  test/
    helpers.js       # Task 1: getSQL(), loadDatasets(), DATASET_DIR
    index.js         # Task 1: lets `node --test tools/sql-studio/test/` run every file
    vendor.test.js sql-text.test.js schema.test.js db.test.js errors.test.js
    format.test.js check.test.js exercises.test.js randomq.test.js export.test.js
    upload-parse.test.js prefs.test.js sessions.test.js erd-model.test.js build.test.js
  dist/sql-studio.html
tools/index.html              # Task 21: Chapter 8 section
chapter-08.md                 # Task 21: Activity 8.0
```

### The dual-load pattern (every `src/*.js` logic file)

```js
// SQL Studio: <one-line purpose>.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const T = isNode ? require('./sql-text.js') : root.SS; // only if it needs another module

  // ... code ...

  const api = { /* exported names */ };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

### The shared schema shape (produced by Task 3 for data sets, and by Task 11 for uploads)

```js
// Schema
{
  id: 'spotify',                       // data set id, or 'upload'
  number: 1,                           // data set number, or 0 for uploads
  name: 'Spotify Streams',
  description: 'Artists · Songs · Streams',
  tables: [
    {
      name: 'Songs',
      columns: [
        { name: 'song_id', type: 'number', sqlType: 'INTEGER', pk: true, fk: null },
        { name: 'artist_id', type: 'number', sqlType: 'INTEGER', pk: false, fk: { table: 'Artists', column: 'artist_id' } },
        { name: 'release_date', type: 'date', sqlType: 'TEXT', pk: false, fk: null },
      ],
      rows: [[1, 'DtMF', 1, '2025-01-05', 237], ...],   // values in column order
    },
  ],
  relationships: [ { from: { table: 'Songs', column: 'artist_id' }, to: { table: 'Artists', column: 'artist_id' } } ],
}
```

`type` is one of `'number' | 'text' | 'date'`. `sqlType` is one of `'INTEGER' | 'REAL' | 'TEXT'`. `relationships` always points from the FK (many side) to the PK (one side).

### The query result shape (produced by Task 4, used everywhere)

```js
// ok
{ ok: true, columns: ['artist_name', 'total_streams'], rows: [['Bad Bunny', 5950000], ...], truncated: false }
// failure
{ ok: false, error: { kind: 'sqlite' | 'readonly' | 'empty', message: '<raw message>' } }
```

---

### Task 1: Vendor the libraries and the test helpers

**Files:**
- Create: `tools/sql-studio/vendor/**` (files listed in File Structure), `tools/sql-studio/vendor/VERSIONS.md`
- Create: `tools/sql-studio/test/helpers.js`, `tools/sql-studio/test/vendor.test.js`, `tools/sql-studio/test/index.js`

**Interfaces:**
- Produces: `helpers.getSQL(): Promise<SqlJsStatic>`, `helpers.loadDatasets(): Dataset[]` (sorted by file name), `helpers.DATASET_DIR`, `helpers.ROOT` (the `tools/sql-studio` path).

- [ ] **Step 1: Download the pinned packages into a scratch folder (not the repo) and copy the files in**

```bash
SCR=$(mktemp -d)
( cd "$SCR" && npm pack sql.js@1.14.2 codemirror@5.65.21 --silent \
  && curl -fsSLO https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz \
  && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done )
V=tools/sql-studio/vendor
mkdir -p $V/sql.js $V/codemirror $V/sheetjs
cp "$SCR/sql.js-1.14.2/package/dist/sql-wasm.js" "$SCR/sql.js-1.14.2/package/dist/sql-wasm.wasm" "$SCR/sql.js-1.14.2/package/LICENSE" $V/sql.js/
CM="$SCR/codemirror-5.65.21/package"
cp "$CM/lib/codemirror.js" "$CM/lib/codemirror.css" "$CM/LICENSE" $V/codemirror/
cp "$CM/mode/sql/sql.js" $V/codemirror/mode-sql.js
cp "$CM/addon/hint/show-hint.js" "$CM/addon/hint/show-hint.css" "$CM/addon/hint/sql-hint.js" $V/codemirror/
cp "$CM/addon/selection/active-line.js" "$CM/addon/edit/matchbrackets.js" $V/codemirror/
cp "$SCR/xlsx-0.20.3/package/dist/xlsx.mini.min.js" "$SCR/xlsx-0.20.3/package/LICENSE" $V/sheetjs/
ls -la $V/*
```

Expected: `sql-wasm.wasm` is about 658 KB, `codemirror.js` about 402 KB, and `xlsx.mini.min.js` about 250–270 KB. If the SheetJS tarball's layout differs, find `xlsx.mini.min.js` with `find "$SCR/xlsx-0.20.3" -name 'xlsx.mini.min.js'`.

- [ ] **Step 2: Write `VERSIONS.md` with the hashes**

```bash
cd tools/sql-studio/vendor && {
  echo '# Vendored libraries'
  echo
  echo 'Pinned on purpose. To update: download the new version, replace the files, and update this table (the vendor test checks every hash).'
  echo
  echo '| File | Library | Version | Source | SHA-256 |'
  echo '|---|---|---|---|---|'
  for f in sql.js/sql-wasm.js sql.js/sql-wasm.wasm; do echo "| $f | sql.js | 1.14.2 | npm sql.js@1.14.2 dist/ | $(shasum -a 256 $f | cut -d' ' -f1) |"; done
  for f in codemirror/*.js codemirror/*.css; do echo "| $f | CodeMirror | 5.65.21 | npm codemirror@5.65.21 | $(shasum -a 256 $f | cut -d' ' -f1) |"; done
  echo "| sheetjs/xlsx.mini.min.js | SheetJS | 0.20.3 | https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz | $(shasum -a 256 sheetjs/xlsx.mini.min.js | cut -d' ' -f1) |"
} > VERSIONS.md && cat VERSIONS.md && cd -
```

- [ ] **Step 3: Write the test helpers**

`tools/sql-studio/test/helpers.js`:

```js
// Shared test helpers: the vendored sql.js and the Query Explorer data sets (read in place).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATASET_DIR = path.join(ROOT, '..', 'query-explorer', 'src', 'datasets');

let sqlPromise = null;
function getSQL() {
  if (!sqlPromise) {
    const initSqlJs = require(path.join(ROOT, 'vendor', 'sql.js', 'sql-wasm.js'));
    const wasmBinary = fs.readFileSync(path.join(ROOT, 'vendor', 'sql.js', 'sql-wasm.wasm'));
    sqlPromise = initSqlJs({ wasmBinary });
  }
  return sqlPromise;
}

function loadDatasets() {
  return fs.readdirSync(DATASET_DIR).filter(f => f.endsWith('.js')).sort()
    .map(f => require(path.join(DATASET_DIR, f)));
}

module.exports = { ROOT, DATASET_DIR, getSQL, loadDatasets };
```

- [ ] **Step 4: Write the vendor test**

`tools/sql-studio/test/vendor.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, getSQL } = require('./helpers.js');

test('every vendored file matches the hash in VERSIONS.md', () => {
  const md = fs.readFileSync(path.join(ROOT, 'vendor', 'VERSIONS.md'), 'utf8');
  const rows = md.split('\n').filter(l => /^\| [a-z]/.test(l) && !l.startsWith('| File'));
  assert.ok(rows.length >= 11, 'expected at least 11 vendored files');
  for (const row of rows) {
    const cells = row.split('|').map(s => s.trim());
    const file = cells[1];
    const hash = cells[5];
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'vendor', file))).digest('hex');
    assert.equal(actual, hash, file);
  }
});

test('sql.js runs a query in Node from the vendored wasm', async () => {
  const SQL = await getSQL();
  const db = new SQL.Database();
  const res = db.exec("SELECT 1 + 1 AS two, sqlite_version() AS v");
  assert.equal(res[0].values[0][0], 2);
  assert.match(res[0].values[0][1], /^3\./);
  db.close();
});
```

- [ ] **Step 5: Add `test/index.js` so the folder form works**

On Node 22, `node --test some/folder/` does not search the folder. It loads the folder as a module, which fails. (`node --test tools/query-explorer/test/` has the same problem today: it reports 1 failing test and runs nothing.) This file makes `node --test tools/sql-studio/test/` work. The glob form, `node --test 'tools/sql-studio/test/*.test.js'`, works too, and it never matches `index.js`.

`tools/sql-studio/test/index.js`:

```js
// Lets `node --test tools/sql-studio/test/` work: Node 22 loads a folder argument as a module,
// so this file loads every *.test.js next to it.
const fs = require('fs');
const path = require('path');

for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith('.test.js')).sort()) require(path.join(__dirname, f));
```

- [ ] **Step 6: Run the tests**

Run: `node --test tools/sql-studio/test/`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add tools/sql-studio/vendor tools/sql-studio/test/helpers.js tools/sql-studio/test/vendor.test.js tools/sql-studio/test/index.js
git commit -m "SQL Studio: vendor sql.js 1.14.2, CodeMirror 5.65.21, SheetJS 0.20.3 with hashes"
```

---

### Task 2: SQL text tools (tokenize, split statements, statement at cursor, aliases)

**Files:**
- Create: `tools/sql-studio/src/sql-text.js`
- Test: `tools/sql-studio/test/sql-text.test.js`

**Interfaces:**
- Produces:
  - `tokenize(sql: string): Token[]`, where `Token = { type: 'ws'|'comment'|'string'|'qident'|'number'|'word'|'punct'|'op', text, start, end }`. Unterminated strings and comments run to the end of the text and set `open: true`.
  - `KEYWORDS: Set<string>` (uppercase) and `isKeyword(word): boolean`.
  - `splitStatements(sql): Array<{ text, start, end, empty }>`. `start`/`end` are offsets into `sql`. `end` is just past the `;` if there is one. `text` excludes the `;`. `empty` is true when the statement holds only whitespace or comments.
  - `statementAt(sql, offset): { text, start, end } | null`
  - `aliasMap(statementText, tableNames: string[]): Map<string(lowercase), string(TableName)>`
  - `lineCol(text, offset): { line, col }` (both 1-based)
  - `offsetOf(text, line, col): number`

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/sql-text.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/sql-text.js');

const kinds = sql => T.tokenize(sql).filter(t => t.type !== 'ws').map(t => `${t.type}:${t.text}`);

test('tokenize: words, strings with doubled quotes, numbers, operators, comments', () => {
  assert.deepEqual(kinds("SELECT x FROM t WHERE n >= 2.5 AND s = 'God''s Plan' -- hi\n;"), [
    'word:SELECT', 'word:x', 'word:FROM', 'word:t', 'word:WHERE', 'word:n', 'op:>=', 'number:2.5',
    'word:AND', 'word:s', 'op:=', "string:'God''s Plan'", 'comment:-- hi', 'punct:;',
  ]);
});

test('tokenize: quoted identifiers, block comments, and offsets', () => {
  const toks = T.tokenize('SELECT "my col" /* a;b */ FROM [T]');
  const q = toks.find(t => t.type === 'qident');
  assert.equal(q.text, '"my col"');
  assert.equal(q.start, 7);
  assert.equal(q.end, 15);
  assert.ok(toks.some(t => t.type === 'comment' && t.text === '/* a;b */'));
  assert.ok(toks.some(t => t.type === 'qident' && t.text === '[T]'));
});

test('tokenize: an unterminated string runs to the end and is marked open', () => {
  const s = T.tokenize("SELECT 'Pop").find(t => t.type === 'string');
  assert.equal(s.text, "'Pop");
  assert.equal(s.open, true);
});

test('splitStatements ignores ; inside strings, quoted names, and comments', () => {
  const sql = "SELECT ';' AS a; -- x;y\nSELECT \"b;c\" FROM t;\n\n  ";
  const parts = T.splitStatements(sql);
  assert.equal(parts.length, 3);
  assert.equal(parts[0].text, "SELECT ';' AS a");
  assert.equal(parts[1].text.trim(), '-- x;y\nSELECT "b;c" FROM t');
  assert.equal(parts[2].empty, true);
  assert.equal(sql.slice(parts[1].start, parts[1].end).trim().endsWith(';'), true);
});

test('statementAt picks the statement the cursor is in', () => {
  const sql = 'SELECT 1;\nSELECT 2;\nSELECT 3';
  assert.equal(T.statementAt(sql, 3).text.trim(), 'SELECT 1');
  assert.equal(T.statementAt(sql, sql.indexOf('2')).text.trim(), 'SELECT 2');
  assert.equal(T.statementAt(sql, sql.length).text.trim(), 'SELECT 3');
});

test('statementAt after the last ; uses the statement before it', () => {
  const sql = 'SELECT 1;\nSELECT 2;\n   -- done\n';
  assert.equal(T.statementAt(sql, sql.length).text.trim(), 'SELECT 2');
});

test('statementAt returns null when there is no query at all', () => {
  assert.equal(T.statementAt('  -- only a comment\n', 5), null);
  assert.equal(T.statementAt('', 0), null);
});

test('aliasMap reads FROM and JOIN aliases, with or without AS', () => {
  const m = T.aliasMap('SELECT * FROM Streams s JOIN Songs AS so ON so.song_id = s.song_id JOIN artists ON 1', ['Streams', 'Songs', 'Artists']);
  assert.equal(m.get('s'), 'Streams');
  assert.equal(m.get('so'), 'Songs');
  assert.equal(m.get('streams'), 'Streams');
  assert.equal(m.get('artists'), 'Artists');
  assert.equal(m.has('on'), false);
});

test('lineCol and offsetOf are inverses', () => {
  const text = 'SELECT a\nFROM t\nWHERE x';
  assert.deepEqual(T.lineCol(text, text.indexOf('WHERE')), { line: 3, col: 1 });
  assert.deepEqual(T.lineCol(text, text.indexOf('t\n')), { line: 2, col: 6 });
  assert.equal(T.offsetOf(text, 2, 6), text.indexOf('t\n'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/sql-text.test.js`
Expected: FAIL with "Cannot find module '../src/sql-text.js'".

- [ ] **Step 3: Implement `sql-text.js`**

```js
// SQL Studio: SQL text tools: tokenizer, statement splitting, statement at cursor, aliases.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const KEYWORDS = new Set(('SELECT DISTINCT ALL FROM WHERE AND OR NOT IN IS NULL LIKE GLOB BETWEEN EXISTS AS ON USING ' +
    'JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET UNION INTERSECT EXCEPT ' +
    'CASE WHEN THEN ELSE END CAST WITH RECURSIVE VALUES INSERT INTO UPDATE SET DELETE CREATE TABLE DROP ALTER ' +
    'PRIMARY KEY REFERENCES COLLATE NOCASE ESCAPE TRUE FALSE').split(' '));
  const isKeyword = w => KEYWORDS.has(String(w).toUpperCase());

  const OPS = ['<>', '!=', '>=', '<=', '==', '||', '<<', '>>', '=', '<', '>', '+', '-', '*', '/', '%', '&', '|', '~'];

  function tokenize(sql) {
    const out = [];
    let i = 0;
    const n = sql.length;
    const push = (type, start, end, extra) => out.push(Object.assign({ type, text: sql.slice(start, end), start, end }, extra));
    while (i < n) {
      const c = sql[i];
      const start = i;
      if (/\s/.test(c)) {
        while (i < n && /\s/.test(sql[i])) i++;
        push('ws', start, i);
      } else if (c === '-' && sql[i + 1] === '-') {
        while (i < n && sql[i] !== '\n') i++;
        push('comment', start, i);
      } else if (c === '/' && sql[i + 1] === '*') {
        const close = sql.indexOf('*/', i + 2);
        i = close === -1 ? n : close + 2;
        push('comment', start, i, close === -1 ? { open: true } : undefined);
      } else if (c === "'" || c === '"' || c === '`' || c === '[') {
        const endCh = c === '[' ? ']' : c;
        i++;
        let open = true;
        while (i < n) {
          if (sql[i] === endCh) {
            if (endCh !== ']' && sql[i + 1] === endCh) { i += 2; continue; }
            i++;
            open = false;
            break;
          }
          i++;
        }
        push(c === "'" ? 'string' : 'qident', start, i, open ? { open: true } : undefined);
      } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        while (i < n && /[0-9.]/.test(sql[i])) i++;
        if (/[eE]/.test(sql[i] || '') && /[-+0-9]/.test(sql[i + 1] || '')) { i += 2; while (i < n && /[0-9]/.test(sql[i])) i++; }
        push('number', start, i);
      } else if (/[A-Za-z_À-￿]/.test(c)) {
        while (i < n && /[A-Za-z0-9_$À-￿]/.test(sql[i])) i++;
        push('word', start, i);
      } else {
        const op = OPS.find(o => sql.startsWith(o, i));
        if (op) { i += op.length; push('op', start, i); } else { i++; push('punct', start, i); }
      }
    }
    return out;
  }

  const isBlank = toks => toks.every(t => t.type === 'ws' || t.type === 'comment');

  function splitStatements(sql) {
    const toks = tokenize(sql);
    const parts = [];
    let start = 0;
    let bucket = [];
    for (const t of toks) {
      if (t.type === 'punct' && t.text === ';') {
        parts.push({ text: sql.slice(start, t.start), start, end: t.end, empty: isBlank(bucket) });
        start = t.end;
        bucket = [];
      } else bucket.push(t);
    }
    if (start < sql.length || parts.length === 0) parts.push({ text: sql.slice(start), start, end: sql.length, empty: isBlank(bucket) });
    return parts;
  }

  function statementAt(sql, offset) {
    const parts = splitStatements(sql);
    let idx = parts.findIndex(p => offset >= p.start && offset < p.end);
    if (idx === -1) idx = parts.length - 1;
    // Cursor at the very start of a statement belongs to the one before it if that one ended right here.
    while (idx >= 0 && parts[idx].empty) idx--;
    if (idx < 0) return null;
    const p = parts[idx];
    return { text: p.text, start: p.start, end: p.end };
  }

  const unquote = t => (t.type === 'qident' ? t.text.slice(1, -1).replace(/""/g, '"') : t.text);

  function aliasMap(statementText, tableNames) {
    const byLower = new Map(tableNames.map(n => [n.toLowerCase(), n]));
    const toks = tokenize(statementText).filter(t => t.type !== 'ws' && t.type !== 'comment');
    const map = new Map();
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i].type === 'word' ? toks[i].text.toUpperCase() : '';
      const isSource = w === 'FROM' || w === 'JOIN' || (toks[i].type === 'punct' && toks[i].text === ',' && map.size > 0);
      if (!isSource) continue;
      const tt = toks[i + 1];
      if (!tt || (tt.type !== 'word' && tt.type !== 'qident')) continue;
      const table = byLower.get(unquote(tt).toLowerCase());
      if (!table) continue;
      map.set(table.toLowerCase(), table);
      let j = i + 2;
      if (toks[j] && toks[j].type === 'word' && toks[j].text.toUpperCase() === 'AS') j++;
      const a = toks[j];
      if (a && (a.type === 'word' || a.type === 'qident') && !isKeyword(a.text)) map.set(unquote(a).toLowerCase(), table);
    }
    return map;
  }

  function lineCol(text, offset) {
    const before = text.slice(0, offset);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  function offsetOf(text, line, col) {
    const lines = text.split('\n');
    let off = 0;
    for (let k = 0; k < line - 1 && k < lines.length; k++) off += lines[k].length + 1;
    return off + col - 1;
  }

  const api = { KEYWORDS, isKeyword, tokenize, splitStatements, statementAt, aliasMap, lineCol, offsetOf };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

Note on `statementAt`: an offset equal to a statement's `end` (just after its `;`) falls into the next part. If that next part is empty, the loop walks back to the statement that just ended, which is what students expect after typing `;`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/sql-text.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/sql-text.js tools/sql-studio/test/sql-text.test.js
git commit -m "SQL Studio: add SQL tokenizer, statement splitting, and alias map"
```

---

### Task 3: Schema from a data set, and loading it into SQLite

**Files:**
- Create: `tools/sql-studio/src/schema.js`
- Test: `tools/sql-studio/test/schema.test.js`

**Interfaces:**
- Consumes: data set objects from `tools/query-explorer/src/datasets/*.js`: `{ id, number, name, description, tables: [{ name, columns: [{ name, type, key?, ref? }], rows }] }`.
- Produces:
  - `quoteIdent(name): string`, which returns `"name"` with `"` doubled.
  - `buildSchema(dataset): Schema` (shape in File Structure).
  - `createStatements(schema): string[]`: `CREATE TABLE` statements with parent tables first.
  - `loadSchema(db, schema): void`, which runs the DDL and inserts all rows in one transaction with prepared statements.
  - `pkOf(table): column | undefined`.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/schema.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const datasets = loadDatasets();
const byId = id => datasets.find(d => d.id === id);

test('all ten data sets are found in the Query Explorer folder', () => {
  assert.equal(datasets.length, 10);
  assert.deepEqual(datasets.map(d => d.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('types: whole numbers INTEGER, decimals REAL, text and dates TEXT', () => {
  const fantasy = S.buildSchema(byId('fantasy'));
  const wp = fantasy.tables.find(t => t.name === 'WeeklyPoints');
  const col = n => wp.columns.find(c => c.name === n);
  assert.equal(col('fantasy_points').sqlType, 'REAL');
  assert.equal(col('week').sqlType, 'INTEGER');
  assert.equal(col('game_date').sqlType, 'TEXT');
  assert.equal(col('game_date').type, 'date');
});

test('keys: pk flag, fk points at the referenced table primary key', () => {
  const s = S.buildSchema(byId('spotify'));
  const songs = s.tables.find(t => t.name === 'Songs');
  assert.equal(songs.columns[0].pk, true);
  assert.deepEqual(songs.columns.find(c => c.name === 'artist_id').fk, { table: 'Artists', column: 'artist_id' });
  assert.deepEqual(s.relationships, [
    { from: { table: 'Songs', column: 'artist_id' }, to: { table: 'Artists', column: 'artist_id' } },
    { from: { table: 'Streams', column: 'song_id' }, to: { table: 'Songs', column: 'song_id' } },
  ]);
});

test('relationship count equals the number of fk columns, for every data set', () => {
  for (const d of datasets) {
    const fks = d.tables.flatMap(t => t.columns.filter(c => c.key === 'fk')).length;
    assert.equal(S.buildSchema(d).relationships.length, fks, d.id);
  }
});

test('createStatements puts parent tables before children and uses PRIMARY KEY / REFERENCES', () => {
  const ddl = S.createStatements(S.buildSchema(byId('spotify')));
  const order = ddl.map(s => /CREATE TABLE "(\w+)"/.exec(s)[1]);
  assert.ok(order.indexOf('Artists') < order.indexOf('Songs'));
  assert.ok(order.indexOf('Songs') < order.indexOf('Streams'));
  assert.match(ddl.find(s => s.includes('"Songs"')), /"artist_id" INTEGER REFERENCES "Artists"\("artist_id"\)/);
  assert.match(ddl.find(s => s.includes('"Songs"')), /"song_id" INTEGER PRIMARY KEY/);
});

test('quoteIdent doubles quotes', () => {
  assert.equal(S.quoteIdent('a"b'), '"a""b"');
});

test('every data set loads with matching row counts, valid foreign keys, and working date BETWEEN', async () => {
  const SQL = await getSQL();
  for (const d of datasets) {
    const schema = S.buildSchema(d);
    const db = new SQL.Database();
    S.loadSchema(db, schema);
    for (const t of schema.tables) {
      const n = db.exec(`SELECT COUNT(*) FROM ${S.quoteIdent(t.name)}`)[0].values[0][0];
      assert.equal(n, t.rows.length, `${d.id}.${t.name}`);
    }
    const bad = db.exec('PRAGMA foreign_key_check');
    assert.equal(bad.length, 0, `${d.id} foreign keys`);
    const dateCol = schema.tables.flatMap(t => t.columns.filter(c => c.type === 'date').map(c => [t, c]))[0];
    const [t, c] = dateCol;
    const n = db.exec(`SELECT COUNT(*) FROM ${S.quoteIdent(t.name)} WHERE ${S.quoteIdent(c.name)} BETWEEN '2000-01-01' AND '2099-12-31'`)[0].values[0][0];
    assert.equal(n, t.rows.length, `${d.id} dates`);
    db.close();
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/schema.test.js`
Expected: FAIL with "Cannot find module '../src/schema.js'".

- [ ] **Step 3: Implement `schema.js`**

```js
// SQL Studio: turns a data set into a schema, CREATE TABLE statements, and a loaded SQLite database.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const quoteIdent = name => `"${String(name).replace(/"/g, '""')}"`;
  const pkOf = table => table.columns.find(c => c.pk);

  function sqlTypeFor(type, values) {
    if (type !== 'number') return 'TEXT';
    return values.every(v => v === null || v === undefined || Number.isInteger(v)) ? 'INTEGER' : 'REAL';
  }

  function buildSchema(dataset) {
    const pkName = name => {
      const t = dataset.tables.find(x => x.name === name);
      const c = t && t.columns.find(x => x.key === 'pk');
      return c ? c.name : null;
    };
    const tables = dataset.tables.map(t => ({
      name: t.name,
      columns: t.columns.map((c, i) => ({
        name: c.name,
        type: c.type,
        sqlType: sqlTypeFor(c.type, t.rows.map(r => r[i])),
        pk: c.key === 'pk',
        fk: c.key === 'fk' ? { table: c.ref, column: pkName(c.ref) || c.name } : null,
      })),
      rows: t.rows,
    }));
    return {
      id: dataset.id,
      number: dataset.number,
      name: dataset.name,
      description: dataset.description,
      tables,
      relationships: relationshipsOf(tables),
    };
  }

  function relationshipsOf(tables) {
    const out = [];
    for (const t of tables) for (const c of t.columns) if (c.fk) out.push({ from: { table: t.name, column: c.name }, to: { table: c.fk.table, column: c.fk.column } });
    return out;
  }

  // Parent tables first (a table comes after every table it references). Cycles fall back to the given order.
  function parentFirst(schema) {
    const done = new Set();
    const order = [];
    const visit = (t, path) => {
      if (done.has(t.name) || path.has(t.name)) return;
      path.add(t.name);
      for (const c of t.columns) {
        const parent = c.fk && schema.tables.find(x => x.name === c.fk.table);
        if (parent && parent !== t) visit(parent, path);
      }
      done.add(t.name);
      order.push(t);
    };
    schema.tables.forEach(t => visit(t, new Set()));
    return order;
  }

  function createStatements(schema) {
    return parentFirst(schema).map(t => {
      const cols = t.columns.map(c => {
        let s = `${quoteIdent(c.name)} ${c.sqlType}`;
        if (c.pk) s += ' PRIMARY KEY';
        if (c.fk) s += ` REFERENCES ${quoteIdent(c.fk.table)}(${quoteIdent(c.fk.column)})`;
        return s;
      });
      return `CREATE TABLE ${quoteIdent(t.name)} (${cols.join(', ')})`;
    });
  }

  function loadSchema(db, schema) {
    db.run('BEGIN');
    try {
      for (const ddl of createStatements(schema)) db.run(ddl);
      for (const t of parentFirst(schema)) {
        if (!t.rows.length) continue;
        const stmt = db.prepare(`INSERT INTO ${quoteIdent(t.name)} VALUES (${t.columns.map(() => '?').join(', ')})`);
        try {
          for (const r of t.rows) stmt.run(t.columns.map((c, i) => (r[i] === undefined ? null : r[i])));
        } finally {
          stmt.free();
        }
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  }

  const api = { quoteIdent, pkOf, buildSchema, relationshipsOf, createStatements, loadSchema };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/schema.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/schema.js tools/sql-studio/test/schema.test.js
git commit -m "SQL Studio: build SQLite schemas from the Query Explorer data sets"
```

---

### Task 4: Running queries (read-only guard and row cap)

**Files:**
- Create: `tools/sql-studio/src/db.js`
- Test: `tools/sql-studio/test/db.test.js`

**Interfaces:**
- Consumes: `schema.loadSchema`, `sql-text.tokenize`.
- Produces:
  - `openStudio(SQL, schema): Studio`, where `Studio = { db, schema }`. It loads the data, then runs `PRAGMA query_only = ON`.
  - `isReadOnly(statementText): boolean`, which is true when the first word is `SELECT`, `WITH`, or `VALUES`.
  - `runQuery(studio, statementText, { maxRows = 200000 } = {}): Result` (the shape in File Structure). `kind: 'empty'` means there was no SQL; `'readonly'` means a write was blocked.
  - `closeStudio(studio)`.
  - `MAX_ROWS = 200000`.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/db.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const spotify = loadDatasets().find(d => d.id === 'spotify');
async function studio() { return D.openStudio(await getSQL(), S.buildSchema(spotify)); }

test('runQuery returns columns and rows, even for zero rows', async () => {
  const st = await studio();
  const r = D.runQuery(st, "SELECT artist_name, genre FROM Artists WHERE genre = 'Latin'");
  assert.equal(r.ok, true);
  assert.deepEqual(r.columns, ['artist_name', 'genre']);
  assert.deepEqual(r.rows, [['Bad Bunny', 'Latin'], ['Karol G', 'Latin']]);
  const none = D.runQuery(st, "SELECT artist_name FROM Artists WHERE genre = 'Polka'");
  assert.deepEqual(none, { ok: true, columns: ['artist_name'], rows: [], truncated: false });
  D.closeStudio(st);
});

test('isReadOnly accepts SELECT, WITH, VALUES after comments', () => {
  assert.equal(D.isReadOnly('-- hi\n  select 1'), true);
  assert.equal(D.isReadOnly('WITH x AS (SELECT 1) SELECT * FROM x'), true);
  assert.equal(D.isReadOnly('VALUES (1)'), true);
  assert.equal(D.isReadOnly('DELETE FROM Artists'), false);
  assert.equal(D.isReadOnly('drop table Artists'), false);
});

test('writes are blocked with kind readonly, and data is unchanged', async () => {
  const st = await studio();
  const r = D.runQuery(st, 'DELETE FROM Artists');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'readonly');
  // A WITH ... DELETE slips past the first-word check; query_only still stops it.
  const r2 = D.runQuery(st, 'WITH x AS (SELECT 1) DELETE FROM Artists');
  assert.equal(r2.ok, false);
  assert.equal(D.runQuery(st, 'SELECT COUNT(*) FROM Artists').rows[0][0], 8);
  D.closeStudio(st);
});

test('empty or comment-only text gives kind empty', async () => {
  const st = await studio();
  assert.equal(D.runQuery(st, '  -- nothing\n').error.kind, 'empty');
  D.closeStudio(st);
});

test('SQLite errors come back with the raw message', async () => {
  const st = await studio();
  const r = D.runQuery(st, 'SELECT address FROM Artists');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'sqlite');
  assert.match(r.error.message, /no such column: address/);
  D.closeStudio(st);
});

test('runaway queries stop at the row cap and say so', async () => {
  const st = await studio();
  const r = D.runQuery(st, 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT i FROM n', { maxRows: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 1000);
  assert.equal(r.truncated, true);
  const big = D.runQuery(st, 'SELECT * FROM Streams a, Streams b, Streams c');
  assert.equal(big.rows.length, 24 ** 3);
  assert.equal(big.truncated, false);
  D.closeStudio(st);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/db.test.js`
Expected: FAIL with "Cannot find module '../src/db.js'".

- [ ] **Step 3: Implement `db.js`**

```js
// SQL Studio: opens a data set as an in-memory SQLite database and runs one read-only statement.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./schema.js')) : root.SS;

  const MAX_ROWS = 200000;

  function firstWord(text) {
    const t = X.tokenize(text).find(k => k.type !== 'ws' && k.type !== 'comment');
    return t ? t.text.toUpperCase() : '';
  }

  const isReadOnly = text => ['SELECT', 'WITH', 'VALUES'].includes(firstWord(text));

  function openStudio(SQL, schema) {
    const db = new SQL.Database();
    X.loadSchema(db, schema);
    db.run('PRAGMA query_only = ON');
    return { db, schema };
  }

  function closeStudio(studio) {
    if (studio && studio.db) studio.db.close();
  }

  function runQuery(studio, text, { maxRows = MAX_ROWS } = {}) {
    if (!firstWord(text) || firstWord(text) === ';') return { ok: false, error: { kind: 'empty', message: '' } };
    if (!isReadOnly(text)) return { ok: false, error: { kind: 'readonly', message: '' } };
    let stmt = null;
    try {
      stmt = studio.db.prepare(text);
      const columns = stmt.getColumnNames();
      const rows = [];
      let truncated = false;
      while (stmt.step()) {
        if (rows.length >= maxRows) { truncated = true; break; }
        rows.push(stmt.get());
      }
      return { ok: true, columns, rows, truncated };
    } catch (e) {
      const message = String((e && e.message) || e);
      const kind = /attempt to write a readonly database/i.test(message) ? 'readonly' : 'sqlite';
      return { ok: false, error: { kind, message } };
    } finally {
      if (stmt) stmt.free();
    }
  }

  const api = { MAX_ROWS, isReadOnly, openStudio, closeStudio, runQuery };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/db.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/db.js tools/sql-studio/test/db.test.js
git commit -m "SQL Studio: run read-only queries with a row cap"
```

---
### Task 5: Plain-words error messages with a location

**Files:**
- Create: `tools/sql-studio/src/errors.js`
- Test: `tools/sql-studio/test/errors.test.js`

**Interfaces:**
- Consumes: `tokenize`, `aliasMap`, `KEYWORDS` (Task 2).
- Produces:
  - `explainError(error, statementText, schema): { headline: string, raw: string, offset: number|null, length: number }`. The `error` argument is the `{ kind, message }` from `runQuery`. `offset` is relative to `statementText`, and `length` is the length of the token to underline.
  - `closest(word, candidates, maxDistance = 2): string|null`. It ignores case and returns the candidate's own spelling.
  - The `headline` uses backticks around names (`` `address` ``). The UI turns backticks into `<code>`, the same way `parseRich` does in the Query Explorer.

- [ ] **Step 1: Write the failing tests (real sql.js messages)**

`tools/sql-studio/test/errors.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const E = require('../src/errors.js');
const { getSQL, loadDatasets } = require('./helpers.js');

let st;
async function explain(sql) {
  if (!st) {
    const d = loadDatasets().find(x => x.id === 'basketball');
    st = D.openStudio(await getSQL(), S.buildSchema(d));
  }
  const r = D.runQuery(st, sql);
  assert.equal(r.ok, false, `expected an error for: ${sql}`);
  return E.explainError(r.error, sql, st.schema);
}
const at = (sql, ex) => sql.slice(ex.offset, ex.offset + ex.length);

test('qualified unknown column names the table behind the alias', async () => {
  const sql = 'SELECT p.player_name, p.address\nFROM Players p';
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's no column called `address` in the `Players` table.");
  assert.equal(at(sql, ex), 'p.address');
  assert.match(ex.raw, /no such column: p\.address/);
});

test('unqualified unknown column, with a did-you-mean', async () => {
  const sql = 'SELECT player_nme FROM Players';
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's no column called `player_nme` in the tables this query uses. Did you mean `player_name`?");
  assert.equal(at(sql, ex), 'player_nme');
});

test('unknown table suggests the closest table', async () => {
  const sql = 'SELECT * FROM Player';
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's no table called `Player`. Did you mean `Players`?");
  assert.equal(at(sql, ex), 'Player');
});

test('misspelled keyword', async () => {
  const sql = 'SELECT *\nFORM Players';
  const ex = await explain(sql);
  assert.equal(ex.headline, "SQL didn't understand the word `FORM`. Did you mean `FROM`?");
  assert.equal(at(sql, ex), 'FORM');
});

test('a query that ends too early', async () => {
  const sql = 'SELECT player_name position FROM Players WHERE';
  const ex = await explain(sql);
  assert.match(ex.headline, /^The query stops too early\./);
});

test('missing comma reads as a confusing token', async () => {
  const sql = 'SELECT player_name, FROM Players';
  const ex = await explain(sql);
  assert.equal(ex.headline, "SQL got confused at `FROM`. Check the word just before it: a missing comma, quote, or keyword is common.");
  assert.equal(at(sql, ex), 'FROM');
});

test('unclosed quote', async () => {
  const sql = "SELECT * FROM Players WHERE position = 'Guard";
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's a text value with no closing quote. Text values need a `'` on both sides.");
  assert.equal(at(sql, ex), "'Guard");
});

test('ambiguous column', async () => {
  const sql = 'SELECT player_id FROM BoxScores JOIN Players ON Players.player_id = BoxScores.player_id';
  const ex = await explain(sql);
  assert.equal(ex.headline, 'More than one table has a column called `player_id`. Say which one you mean, like `BoxScores.player_id`.');
  assert.equal(at(sql, ex), 'player_id');
});

test('aggregate in WHERE', async () => {
  const sql = 'SELECT player_id FROM BoxScores WHERE SUM(points) > 10';
  const ex = await explain(sql);
  assert.equal(ex.headline, "You can't use `SUM` in `WHERE`. To filter on a total, use `HAVING` after `GROUP BY`.");
  assert.equal(at(sql, ex), 'SUM');
});

test('HAVING without GROUP BY, when this SQLite rejects it', async () => {
  const d = loadDatasets().find(x => x.id === 'basketball');
  const st2 = D.openStudio(await getSQL(), S.buildSchema(d));
  const sql = 'SELECT player_id FROM BoxScores HAVING points > 1';
  const r = D.runQuery(st2, sql);
  // SQLite 3.39+ allows HAVING without GROUP BY, so only check the wording when it errors.
  if (!r.ok) assert.match(E.explainError(r.error, sql, st2.schema).headline, /HAVING/);
  D.closeStudio(st2);
});

test('unknown function and wrong argument count', async () => {
  const ex1 = await explain('SELECT AVERAGE(points) FROM BoxScores');
  assert.equal(ex1.headline, "SQLite doesn't have a function called `AVERAGE`. Did you mean `AVG`?");
  const ex2 = await explain('SELECT ROUND() FROM BoxScores');
  assert.equal(ex2.headline, '`ROUND` was given the wrong number of values inside its parentheses.');
});

test('ORDER BY number out of range', async () => {
  const ex = await explain('SELECT player_name FROM Players ORDER BY 3');
  assert.equal(ex.headline, '`ORDER BY 3` means "sort by column 3," but your result only has 1 column.');
});

test('incomplete input points at the end', async () => {
  const sql = 'SELECT * FROM Players WHERE (points > 2';
  const ex = await explain(sql);
  assert.match(ex.headline, /^The query stops too early\. Is something missing at the end/);
  assert.equal(ex.offset, sql.length);
});

test('readonly and unknown errors', () => {
  const ro = E.explainError({ kind: 'readonly', message: '' }, 'DELETE FROM Players', null);
  assert.equal(ro.headline, 'SQL Studio only runs queries that read data (SELECT). Changing data comes later in the course.');
  const other = E.explainError({ kind: 'sqlite', message: 'disk I/O error' }, 'SELECT 1', null);
  assert.equal(other.headline, 'Something went wrong running this query.');
  assert.equal(other.offset, null);
});

test('closest ignores case and respects the distance limit', () => {
  assert.equal(E.closest('artist', ['Artists', 'Songs']), 'Artists');
  assert.equal(E.closest('zzz', ['Artists', 'Songs']), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/errors.test.js`
Expected: FAIL with "Cannot find module '../src/errors.js'".

- [ ] **Step 3: Implement `errors.js`**

```js
// SQL Studio: rewrites SQLite error messages in plain words and finds where the problem starts.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const T = isNode ? require('./sql-text.js') : root.SS;

  const FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'ABS', 'UPPER', 'LOWER', 'LENGTH', 'SUBSTR', 'TRIM', 'REPLACE',
    'COALESCE', 'IFNULL', 'NULLIF', 'DATE', 'TIME', 'DATETIME', 'STRFTIME', 'JULIANDAY', 'CAST', 'TOTAL', 'GROUP_CONCAT', 'INSTR', 'PRINTF'];

  // Names students often guess from Excel or other databases.
  const SYNONYMS = { AVERAGE: 'AVG', MEAN: 'AVG', MAXIMUM: 'MAX', MINIMUM: 'MIN', CNT: 'COUNT', COUNTA: 'COUNT', LEN: 'LENGTH', MID: 'SUBSTR', SUBSTRING: 'SUBSTR', TODAY: 'DATE', NOW: 'DATETIME' };

  function distance(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Two swapped letters (FORM / FROM) count as one typo.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }

  function closest(word, candidates, maxDistance = 2) {
    let best = null;
    let bestD = maxDistance + 1;
    for (const c of candidates) {
      const dd = distance(word, c);
      if (dd > 0 && dd < bestD) { best = c; bestD = dd; }
    }
    return best;
  }

  const code = s => '`' + s + '`';
  const meaningful = text => T.tokenize(text).filter(t => t.type !== 'ws' && t.type !== 'comment');

  // Finds the first token matching `pred`, as {offset, length}.
  function findTok(text, pred) {
    const t = meaningful(text).find(pred);
    return t ? { offset: t.start, length: t.end - t.start } : { offset: null, length: 0 };
  }
  const sameWord = w => t => t.text.toLowerCase() === String(w).toLowerCase() || (t.type === 'qident' && t.text.slice(1, -1).toLowerCase() === String(w).toLowerCase());

  // Finds "alias.column" as one span (three tokens: word . word).
  function findQualified(text, qual, col) {
    const toks = meaningful(text);
    for (let i = 0; i + 2 < toks.length; i++) {
      if (sameWord(qual)(toks[i]) && toks[i + 1].text === '.' && sameWord(col)(toks[i + 2])) return { offset: toks[i].start, length: toks[i + 2].end - toks[i].start };
    }
    return findTok(text, sameWord(col));
  }

  const tableNames = schema => (schema ? schema.tables.map(t => t.name) : []);
  const columnNames = schema => (schema ? [...new Set(schema.tables.flatMap(t => t.columns.map(c => c.name)))] : []);
  const didYouMean = s => (s ? ` Did you mean ${code(s)}?` : '');

  const RULES = [
    [/no such column: ([^.\s]+)\.(\S+)/, (m, text, schema) => {
      const table = T.aliasMap(text, tableNames(schema)).get(m[1].toLowerCase());
      const where = table ? `in the ${code(table)} table` : `in ${code(m[1])}`;
      const t = table && schema.tables.find(x => x.name === table);
      const hint = t ? didYouMean(closest(m[2], t.columns.map(c => c.name))) : '';
      return [`There's no column called ${code(m[2])} ${where}.${hint}`, findQualified(text, m[1], m[2])];
    }],
    [/no such column: (\S+)/, (m, text, schema) => [
      `There's no column called ${code(m[1])} in the tables this query uses.${didYouMean(closest(m[1], columnNames(schema))) || ' Check the spelling, or look at the ERD.'}`,
      findTok(text, sameWord(m[1]))]],
    [/no such table: (\S+)/, (m, text, schema) => [
      `There's no table called ${code(m[1])}.${didYouMean(closest(m[1], tableNames(schema)))}`,
      findTok(text, sameWord(m[1]))]],
    [/unrecognized token: "(.*)"$/, (m, text) => {
      const tok = T.tokenize(text).find(t => t.open);
      if (tok && tok.type === 'string') return [`There's a text value with no closing quote. Text values need a ${code("'")} on both sides.`, { offset: tok.start, length: tok.end - tok.start }];
      return [`SQL doesn't recognize ${code(m[1])}. Check for a stray symbol.`, findTok(text, t => t.text === m[1])];
    }],
    [/incomplete input/, (m, text) => [
      `The query stops too early. Is something missing at the end, like a closing ${code(')')} or ${code("'")}?`,
      { offset: text.replace(/\s+$/, '').length, length: 0 }]],
    [/near "(.+?)": syntax error/, (m, text) => {
      const loc = findTok(text, sameWord(m[1]));
      const kw = /^[A-Za-z]+$/.test(m[1]) && !T.isKeyword(m[1]) ? closest(m[1].toUpperCase(), [...T.KEYWORDS], 1) : null;
      if (kw) return [`SQL didn't understand the word ${code(m[1])}. Did you mean ${code(kw)}?`, loc];
      return [`SQL got confused at ${code(m[1])}. Check the word just before it: a missing comma, quote, or keyword is common.`, loc];
    }],
    [/ambiguous column name: (?:(\S+)\.)?(\S+)/, (m, text, schema) => {
      // The first table named in FROM/JOIN that has this column.
      const used = schema ? [...new Set(T.aliasMap(text, tableNames(schema)).values())] : [];
      const owner = used.map(n => schema.tables.find(t => t.name === n)).find(t => t.columns.some(c => c.name.toLowerCase() === m[2].toLowerCase()));
      const example = `${owner ? owner.name : 'TableName'}.${m[2]}`;
      return [`More than one table has a column called ${code(m[2])}. Say which one you mean, like ${code(example)}.`, findTok(text, sameWord(m[2]))];
    }],
    [/misuse of aggregate(?: function)?:? (\w+)\(\)/, (m, text) => [
      `You can't use ${code(m[1].toUpperCase())} in ${code('WHERE')}. To filter on a total, use ${code('HAVING')} after ${code('GROUP BY')}.`,
      findTok(text, sameWord(m[1]))]],
    [/GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate query/, (m, text) => [
      `${code('HAVING')} filters groups, so it needs a ${code('GROUP BY')} first.`, findTok(text, sameWord('HAVING'))]],
    [/no such function: (\w+)/, (m, text) => [
      `SQLite doesn't have a function called ${code(m[1])}.${didYouMean(SYNONYMS[m[1].toUpperCase()] || closest(m[1].toUpperCase(), FUNCTIONS, 2))}`,
      findTok(text, sameWord(m[1]))]],
    [/wrong number of arguments to function (\w+)\(\)/, (m, text) => [
      `${code(m[1].toUpperCase())} was given the wrong number of values inside its parentheses.`, findTok(text, sameWord(m[1]))]],
    [/(\d+)\w* ORDER BY term out of range - should be between 1 and (\d+)/, (m, text) => {
      const toks = meaningful(text);
      const i = toks.findIndex((t, k) => t.text.toUpperCase() === 'ORDER' && toks[k + 1] && toks[k + 1].text.toUpperCase() === 'BY');
      const num = toks.slice(i + 2).find(t => t.type === 'number');
      const n = num ? num.text : m[1];
      const cols = Number(m[2]);
      return [`${code(`ORDER BY ${n}`)} means "sort by column ${n}," but your result only has ${cols} ${cols === 1 ? 'column' : 'columns'}.`,
        num ? { offset: num.start, length: num.end - num.start } : findTok(text, sameWord('ORDER'))];
    }],
    [/sub-select returns (\d+) columns - expected 1/, (m, text) => {
      const toks = meaningful(text);
      const inner = toks.find((t, k) => k > 0 && t.text.toUpperCase() === 'SELECT' && toks[k - 1].text === '(');
      return ['The query inside the parentheses should return just one column here.', inner ? { offset: inner.start, length: inner.end - inner.start } : { offset: null, length: 0 }];
    }],
  ];

  function explainError(error, statementText, schema) {
    const raw = (error && error.message) || '';
    if (error && error.kind === 'readonly') {
      return { headline: 'SQL Studio only runs queries that read data (SELECT). Changing data comes later in the course.', raw, ...findTok(statementText, () => true) };
    }
    if (error && error.kind === 'empty') return { headline: "There's no query here to run.", raw, offset: null, length: 0 };
    for (const [re, build] of RULES) {
      const m = re.exec(raw);
      if (m) {
        const [headline, loc] = build(m, statementText, schema);
        return { headline, raw, offset: loc.offset, length: loc.length };
      }
    }
    return { headline: 'Something went wrong running this query.', raw, offset: null, length: 0 };
  }

  const api = { explainError, closest };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

Notes for the implementer:
- Check each real message with a one-off `node -e` script before you trust the regexes. SQLite's exact wording can differ slightly between versions. If a test fails because of wording, fix the **regex**, not the student-facing headline.
- `'SELECT player_name position FROM Players WHERE'` ends in `WHERE` with nothing after it, which SQLite reports as `incomplete input`. That is why that test expects the "stops too early" headline.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/errors.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/errors.js tools/sql-studio/test/errors.test.js
git commit -m "SQL Studio: rewrite SQLite errors in plain words and locate them"
```

---

### Task 6: The SQL formatter

**Files:**
- Create: `tools/sql-studio/src/format.js`
- Test: `tools/sql-studio/test/format.test.js`

**Interfaces:**
- Consumes: `tokenize`, `splitStatements`, `isKeyword` (Task 2).
- Produces:
  - `formatStatement(text): string`, which formats one statement (no trailing `;`).
  - `formatSql(text): string`, which formats every statement. Non-empty statements are joined with `;\n\n`, and a final `;` is kept if the input had one.

**Style rules (spec §5, matching Chapter 8):**
1. Keywords from `KEYWORDS`, and function names followed by `(`, are written in UPPERCASE. Identifiers are left as typed.
2. These clause starters begin a new line at the current indent: `SELECT`, `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `UNION [ALL]`, `INTERSECT`, `EXCEPT`, `WITH`, and every join (`JOIN`, `INNER JOIN`, `LEFT [OUTER] JOIN`, `CROSS JOIN`, `NATURAL JOIN`). The words of a multi-word starter stay together.
3. The select list stays on the `SELECT` line if the line would be at most 72 characters. Otherwise, each top-level item goes on its own line, indented two spaces, with a trailing comma.
4. In `WHERE` and `HAVING`, each top-level `AND`/`OR` starts a new line indented two spaces. The `AND` that belongs to `BETWEEN x AND y` stays on its line.
5. Tokens are separated by single spaces, except:
   - no space before `, ) ; .` or after `( .`;
   - no space between a function name and `(`;
   - a unary `-` or `+` (one that comes after an operator, `(`, `,`, a keyword, or at the start) is attached to its number.
6. A subquery `(SELECT …)` puts its clause starters on new lines, indented by 4 more spaces. Its closing `)` follows the last token.
7. A `--` comment ends its line. A `/* */` comment stays inline. Strings, quoted names, and numbers are copied exactly.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/format.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/format.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { EXERCISES } = require('../src/exercises.js');
const { getSQL, loadDatasets } = require('./helpers.js');

test('book style: clauses on new lines, conditions indented, keywords upper case', () => {
  const input = "select song_title, duration_sec from Songs where genre = 'Pop' and release_date between '2024-01-01' and '2024-12-31' and duration_sec < 180";
  assert.equal(F.formatSql(input), [
    'SELECT song_title, duration_sec',
    'FROM Songs',
    "WHERE genre = 'Pop'",
    "  AND release_date BETWEEN '2024-01-01' AND '2024-12-31'",
    '  AND duration_sec < 180',
  ].join('\n'));
});

test('joins, group by, having, order by, limit', () => {
  const input = 'select a.artist_name,sum(st.stream_count) as total from Streams st join Songs so on so.song_id=st.song_id join Artists a on a.artist_id=so.artist_id group by a.artist_name having sum(st.stream_count)>5000000 order by total desc limit 3;';
  assert.equal(F.formatSql(input), [
    'SELECT a.artist_name, SUM(st.stream_count) AS total',
    'FROM Streams st',
    'JOIN Songs so ON so.song_id = st.song_id',
    'JOIN Artists a ON a.artist_id = so.artist_id',
    'GROUP BY a.artist_name',
    'HAVING SUM(st.stream_count) > 5000000',
    'ORDER BY total DESC',
    'LIMIT 3;',
  ].join('\n'));
});

test('long select lists go one per line', () => {
  const out = F.formatSql('SELECT player_name, position, class_year, jersey_number, player_id, player_name AS again FROM Players');
  assert.equal(out.split('\n')[0], 'SELECT');
  assert.equal(out.split('\n')[1], '  player_name,');
  assert.equal(out.split('\n')[6], '  player_name AS again');
  assert.equal(out.split('\n')[7], 'FROM Players');
});

test('strings, quoted names, comments, and semicolons in strings are kept exactly', () => {
  const input = "-- top songs\nselect \"song title\" , 'a;b''c' from Songs -- end\nwhere x = -5";
  const out = F.formatSql(input);
  assert.ok(out.includes('"song title"'));
  assert.ok(out.includes("'a;b''c'"));
  assert.ok(out.includes('-- top songs\n'));
  assert.ok(out.includes('-- end\n'));
  assert.ok(out.includes('x = -5'));
});

test('OR mixed with parentheses keeps the parentheses on one line', () => {
  const out = F.formatSql("select * from Games where (home_away = 'Home' and result = 'W') or opponent = 'App State'");
  assert.equal(out, "SELECT *\nFROM Games\nWHERE (home_away = 'Home' AND result = 'W')\n  OR opponent = 'App State'");
});

test('COUNT(*), COUNT(DISTINCT x), IN lists, and subqueries', () => {
  const out = F.formatSql('select count(*), count(distinct hall_id) from MealSwipes where hall_id in (1,2) and student_id in (select student_id from Students where meal_plan = \'Unlimited\')');
  assert.ok(out.includes('SELECT COUNT(*), COUNT(DISTINCT hall_id)'));
  assert.ok(out.includes('hall_id IN (1, 2)'));
  assert.ok(out.includes('student_id IN (\n    SELECT student_id\n    FROM Students\n    WHERE meal_plan = \'Unlimited\')'));
});

test('several statements are each formatted', () => {
  assert.equal(F.formatSql('select 1; select 2'), 'SELECT 1;\n\nSELECT 2');
});

test('formatting is idempotent on every exercise answer', () => {
  for (const list of Object.values(EXERCISES)) for (const ex of list) {
    const once = F.formatSql(ex.answer);
    assert.equal(F.formatSql(once), once, ex.text);
  }
});

test('formatting never changes the result of any exercise answer', async () => {
  const SQL = await getSQL();
  for (const d of loadDatasets()) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    for (const ex of EXERCISES[d.id]) {
      const before = D.runQuery(st, ex.answer.replace(/;\s*$/, ''));
      const after = D.runQuery(st, F.formatSql(ex.answer).replace(/;\s*$/, ''));
      assert.deepEqual(after, before, ex.text);
    }
    D.closeStudio(st);
  }
});
```

These tests depend on `exercises.js` (Task 8). Until Task 8 is done, run with `--test-name-pattern` to skip the last two. Task 8's commit re-runs the whole file. Task 9 adds the random-query round-trip test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test --test-name-pattern="book style|joins|long select|strings|OR mixed|COUNT|several" tools/sql-studio/test/format.test.js`
Expected: FAIL with "Cannot find module '../src/format.js'". To test the first seven before Task 8 exists, temporarily create `src/exercises.js` exporting `{ EXERCISES: {} }`. Task 8 replaces it.

- [ ] **Step 3: Implement `format.js`**

```js
// SQL Studio: a small SQL pretty-printer in the book's style.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const T = isNode ? require('./sql-text.js') : root.SS;

  const CLAUSE_HEADS = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'UNION', 'INTERSECT', 'EXCEPT', 'WITH',
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL'];
  const NO_SPACE_BEFORE = new Set([',', ')', ';', '.']);
  const NO_SPACE_AFTER = new Set(['(', '.']);

  // Groups tokens into "words" so multi-word clause heads (GROUP BY, LEFT OUTER JOIN, UNION ALL) are one unit.
  function clauseHeadAt(toks, i) {
    const up = k => (toks[k] && toks[k].type === 'word' ? toks[k].text.toUpperCase() : '');
    const w = up(i);
    if (!CLAUSE_HEADS.includes(w)) return 0;
    if (w === 'GROUP' || w === 'ORDER') return up(i + 1) === 'BY' ? 2 : 0;
    if (w === 'UNION') return up(i + 1) === 'ALL' ? 2 : 1;
    if (['INNER', 'CROSS', 'NATURAL'].includes(w)) return up(i + 1) === 'JOIN' ? 2 : 0;
    if (['LEFT', 'RIGHT', 'FULL'].includes(w)) {
      if (up(i + 1) === 'JOIN') return 2;
      if (up(i + 1) === 'OUTER' && up(i + 2) === 'JOIN') return 3;
      return 0;
    }
    return 1;
  }

  function formatStatement(text) {
    const toks = T.tokenize(text).filter(t => t.type !== 'ws');
    // Pass 1: split into top-level clauses per nesting level; we render recursively.
    return render(toks, 0).replace(/[ \t]+\n/g, '\n').trim();
  }

  function upper(tok, next) {
    if (tok.type !== 'word') return tok.text;
    if (T.isKeyword(tok.text)) return tok.text.toUpperCase();
    if (next && next.text === '(') return tok.text.toUpperCase(); // function name
    return tok.text;
  }

  function needsSpace(prev, tok, prevPrev) {
    if (!prev) return false;
    if (NO_SPACE_BEFORE.has(tok.text) && tok.type === 'punct') return false;
    if (tok.text === '.' ) return false;
    if (NO_SPACE_AFTER.has(prev.text) && (prev.type === 'punct')) return false;
    if (tok.text === '(' && prev.type === 'word' && !T.isKeyword(prev.text)) return false; // f(
    if (tok.text === '(' && prev.type === 'word' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'COALESCE', 'IFNULL', 'ROUND', 'REPLACE'].includes(prev.text.toUpperCase())) return false;
    if (prev.type === 'op' && (prev.text === '-' || prev.text === '+') && isUnary(prevPrev)) return false;
    return true;
  }

  function isUnary(before) {
    return !before || before.type === 'op' || (before.type === 'punct' && (before.text === '(' || before.text === ',')) || (before.type === 'word' && T.isKeyword(before.text));
  }

  // Renders tokens of one query level. `base` is the indent (spaces) for clause heads at this level.
  function render(toks, base) {
    const pad = ' '.repeat(base);
    // Split this level into clauses at depth 0.
    const clauses = [];
    let depth = 0;
    let cur = null;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.text === '(' && t.type === 'punct') depth++;
      if (t.text === ')' && t.type === 'punct') depth--;
      const headLen = depth === 0 ? clauseHeadAt(toks, i) : 0;
      if (headLen) {
        cur = { head: toks.slice(i, i + headLen), body: [] };
        clauses.push(cur);
        i += headLen - 1;
      } else {
        if (!cur) { cur = { head: [], body: [] }; clauses.push(cur); }
        cur.body.push(t);
      }
    }
    return clauses.map(c => renderClause(c, pad, base)).join('\n');
  }

  function renderClause({ head, body }, pad, base) {
    const headText = head.map(t => t.text.toUpperCase()).join(' ');
    const kind = head.length ? head[0].text.toUpperCase() : '';
    if (kind === 'SELECT') {
      const items = splitTopLevel(body, ',');
      const inline = joinTokens(body, base);
      let distinct = '';
      if (items.length && items[0].length && items[0][0].type === 'word' && ['DISTINCT', 'ALL'].includes(items[0][0].text.toUpperCase())) {
        distinct = ' ' + items[0][0].text.toUpperCase();
        items[0] = items[0].slice(1);
      }
      const oneLine = `${pad}${headText} ${inline}`;
      if (items.length < 2 || (oneLine.length <= 72 && !oneLine.includes('\n'))) return oneLine;
      const lines = items.map((it, k) => `${pad}  ${joinTokens(it, base + 2)}${k < items.length - 1 ? ',' : ''}`);
      return `${pad}${headText}${distinct}\n${lines.join('\n')}`;
    }
    if (kind === 'WHERE' || kind === 'HAVING') {
      const parts = splitConditions(body);
      return parts.map((p, k) => (k === 0 ? `${pad}${headText} ${joinTokens(p.toks, base)}` : `${pad}  ${p.joiner} ${joinTokens(p.toks, base)}`)).join('\n');
    }
    const text = joinTokens(body, base);
    return head.length ? `${pad}${headText}${text ? ' ' + text : ''}` : `${pad}${text}`;
  }

  // Splits a token list at top-level separators (depth 0).
  function splitTopLevel(toks, sep) {
    const out = [[]];
    let depth = 0;
    for (const t of toks) {
      if (t.type === 'punct' && t.text === '(') depth++;
      if (t.type === 'punct' && t.text === ')') depth--;
      if (depth === 0 && t.type === 'punct' && t.text === sep) { out.push([]); continue; }
      out[out.length - 1].push(t);
    }
    return out.filter(x => x.length);
  }

  // Splits WHERE/HAVING bodies at top-level AND/OR, skipping the AND of BETWEEN.
  function splitConditions(toks) {
    const out = [{ joiner: '', toks: [] }];
    let depth = 0;
    let betweenOpen = false;
    for (const t of toks) {
      const w = t.type === 'word' ? t.text.toUpperCase() : '';
      if (t.type === 'punct' && t.text === '(') depth++;
      if (t.type === 'punct' && t.text === ')') depth--;
      if (depth === 0 && w === 'BETWEEN') betweenOpen = true;
      if (depth === 0 && (w === 'AND' || w === 'OR')) {
        if (w === 'AND' && betweenOpen) { betweenOpen = false; out[out.length - 1].toks.push(t); continue; }
        out.push({ joiner: w, toks: [] });
        continue;
      }
      out[out.length - 1].toks.push(t);
    }
    return out;
  }

  // Joins tokens with the spacing rules; subqueries "(SELECT ...)" are rendered on new lines 4 deeper.
  function joinTokens(toks, base) {
    let s = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const next = toks[i + 1];
      if (t.type === 'punct' && t.text === '(' && next && next.type === 'word' && ['SELECT', 'WITH'].includes(next.text.toUpperCase())) {
        // find matching ')'
        let depth = 0;
        let j = i;
        for (; j < toks.length; j++) {
          if (toks[j].type === 'punct' && toks[j].text === '(') depth++;
          if (toks[j].type === 'punct' && toks[j].text === ')' && --depth === 0) break;
        }
        const inner = render(toks.slice(i + 1, j), base + 4);
        s += (s && !s.endsWith('(') && !s.endsWith(' ') ? ' ' : '') + '(\n' + inner + (j < toks.length ? ')' : '');
        i = j;
        continue;
      }
      if (t.type === 'comment') {
        s += (s ? ' ' : '') + t.text + (t.text.startsWith('--') ? '\n' + ' '.repeat(base + 2) : '');
        continue;
      }
      if (s && !s.endsWith('\n' + ' '.repeat(base + 2)) && needsSpace(toks[i - 1], t, toks[i - 2])) s += ' ';
      s += upper(t, next);
    }
    return s.replace(/\n\s*$/, '\n');
  }

  function formatSql(text) {
    const parts = T.splitStatements(text);
    const hadFinalSemi = /;\s*$/.test(T.tokenize(text).filter(t => t.type !== 'comment').map(t => t.text).join(''));
    const formatted = [];
    for (const p of parts) {
      if (p.empty) {
        const c = p.text.trim();
        if (c) formatted.push({ text: c, comment: true });
        continue;
      }
      formatted.push({ text: formatStatement(p.text) });
    }
    let out = '';
    formatted.forEach((f, k) => {
      if (k > 0) out += f.comment ? '\n' : ';\n\n';
      out += f.text;
    });
    if (hadFinalSemi && formatted.length && !formatted[formatted.length - 1].comment) out += ';';
    return out;
  }

  const api = { formatSql, formatStatement };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

Leading comments (a `--` before `SELECT`) end up in a "clause" with an empty head. `joinTokens` writes the comment, then a newline. Check the `strings, quoted names, comments` test output by eye: the first line must be `-- top songs`, followed by `SELECT …`. If the indent after a leading comment shows up as two spaces before `SELECT`, trim it. For an empty-head clause, render the body with base `-2`, or strip the leading spaces of the next line. Make the test pass; don't change the test.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test --test-name-pattern="book style|joins|long select|strings|OR mixed|COUNT|several" tools/sql-studio/test/format.test.js`
Expected: PASS (7 tests). The two exercise-based tests run in Task 8.

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/format.js tools/sql-studio/test/format.test.js
git commit -m "SQL Studio: add SQL formatter in the book's style"
```

(Don't commit the temporary `src/exercises.js` stub. Task 8 adds the real file.)

---

### Task 7: Checking an answer

**Files:**
- Create: `tools/sql-studio/src/check.js`
- Test: `tools/sql-studio/test/check.test.js`

**Interfaces:**
- Consumes: `runQuery` (Task 4).
- Produces:
  - `valuesEqual(a, b): boolean`. Numbers match within `max(0.005, 1e-6 × max(|a|, |b|))`. `null` matches only `null`. Anything else must be strictly equal.
  - `compareResults(student, expected, { orderMatters = false } = {}): { ok, code, message }`. `student` and `expected` are `{ columns, rows }`, and `code` is one of `'match' | 'columns' | 'more-rows' | 'fewer-rows' | 'values' | 'order'`.
  - `checkExercise(studio, statementText, exercise): { ok, code, message, error?, student? }`, where `code` can also be `'error'`. On an error, `error` is the raw `{ kind, message }`.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/check.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/check.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const R = (columns, rows) => ({ columns, rows });
const exp = R(['artist_name', 'total'], [['A', 10], ['B', 20.5], ['C', null]]);

test('exact match, column names do not matter', () => {
  const r = C.compareResults(R(['x', 'y'], [['A', 10], ['B', 20.5], ['C', null]]), exp);
  assert.equal(r.ok, true);
  assert.equal(r.code, 'match');
  assert.equal(r.message, 'Nice! Your result matches. 3 rows × 2 columns.');
});

test('row order is ignored unless orderMatters', () => {
  const shuffled = R(['a', 'b'], [['C', null], ['A', 10], ['B', 20.5]]);
  assert.equal(C.compareResults(shuffled, exp).ok, true);
  const r = C.compareResults(shuffled, exp, { orderMatters: true });
  assert.equal(r.code, 'order');
  assert.equal(r.message, 'You have the right rows, but not in the right order. Check your ORDER BY.');
});

test('numeric tolerance: 0.004 passes, 0.01 fails, large numbers use relative tolerance', () => {
  assert.equal(C.valuesEqual(20.5, 20.504), true);
  assert.equal(C.valuesEqual(20.5, 20.51), false);
  assert.equal(C.valuesEqual(5950000, 5950003), true);
  assert.equal(C.valuesEqual(5950000, 5951000), false);
  assert.equal(C.valuesEqual(null, 0), false);
  assert.equal(C.valuesEqual(null, null), true);
  assert.equal(C.valuesEqual('Pop', 'pop'), false);
  assert.equal(C.valuesEqual('10', 10), false);
});

test('rounded averages match unrounded ones', () => {
  const a = R(['g', 'avg'], [['Guard', 17.8333333333333]]);
  const b = R(['g', 'avg'], [['Guard', 17.83]]);
  assert.equal(C.compareResults(b, a).ok, true);
});

test('wrong column count', () => {
  const r = C.compareResults(R(['a', 'b', 'c'], [['A', 10, 1]]), exp);
  assert.equal(r.code, 'columns');
  assert.equal(r.message, 'Close! Your result has 3 columns; the expected result has 2. Check your SELECT list.');
});

test('more rows and fewer rows', () => {
  const more = C.compareResults(R(['a', 'b'], [...exp.rows, ['D', 1]]), exp);
  assert.equal(more.code, 'more-rows');
  assert.equal(more.message, 'Close! Your result has 4 rows; the expected result has 3. Check your WHERE clause, or whether you need GROUP BY.');
  const fewer = C.compareResults(R(['a', 'b'], [['A', 10]]), exp);
  assert.equal(fewer.code, 'fewer-rows');
  assert.equal(fewer.message, 'Close! Your result has 1 row; the expected result has 3. Check your WHERE conditions and your JOINs.');
});

test('same size, different values (including swapped columns)', () => {
  const swapped = C.compareResults(R(['b', 'a'], [[10, 'A'], [20.5, 'B'], [null, 'C']]), exp);
  assert.equal(swapped.code, 'values');
  assert.equal(swapped.message, 'Your result is the right size, but some values are different. Check your calculations and which columns you picked.');
});

test('duplicate rows must appear the same number of times', () => {
  const e = R(['a'], [['x'], ['x'], ['y']]);
  assert.equal(C.compareResults(R(['a'], [['x'], ['y'], ['y']]), e).code, 'values');
});

test('checkExercise runs both queries; an error comes back as code error', async () => {
  const st = D.openStudio(await getSQL(), S.buildSchema(loadDatasets().find(d => d.id === 'spotify')));
  const exercise = { answer: "SELECT song_title FROM Songs WHERE duration_sec > 240;", orderMatters: false };
  assert.equal(C.checkExercise(st, 'select SONG_TITLE from songs where duration_sec >= 241', exercise).ok, true);
  const bad = C.checkExercise(st, 'SELECT title FROM Songs', exercise);
  assert.equal(bad.code, 'error');
  assert.match(bad.error.message, /no such column/);
  assert.equal(bad.message, 'Fix the error, then check again.');
  D.closeStudio(st);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/check.test.js`
Expected: FAIL with "Cannot find module '../src/check.js'".

- [ ] **Step 3: Implement `check.js`**

```js
// SQL Studio: compares a student's result with the expected result, and explains the difference kindly.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? require('./db.js') : root.SS;

  function valuesEqual(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return (a === null || a === undefined) && (b === null || b === undefined);
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.max(0.005, 1e-6 * Math.max(Math.abs(a), Math.abs(b)));
    return a === b;
  }

  const rowsEqual = (r1, r2) => r1.length === r2.length && r1.every((v, i) => valuesEqual(v, r2[i]));

  // A sort key that puts near-equal numbers next to each other (rounded to 2 decimals).
  const keyOf = row => JSON.stringify(row.map(v => (typeof v === 'number' ? ['n', Math.round(v * 100) / 100] : [v === null ? 'z' : 's', v])));
  const sorted = rows => rows.map(r => [keyOf(r), r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(x => x[1]);

  function sameMultiset(a, b) {
    const sa = sorted(a);
    const sb = sorted(b);
    if (sa.every((r, i) => rowsEqual(r, sb[i]))) return true;
    if (a.length > 2000) return false;
    // Rounding can place near-equal numbers in different order; fall back to greedy matching.
    const used = new Array(b.length).fill(false);
    return a.every(r => {
      const k = b.findIndex((r2, i) => !used[i] && rowsEqual(r, r2));
      if (k === -1) return false;
      used[k] = true;
      return true;
    });
  }

  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

  function compareResults(student, expected, { orderMatters = false } = {}) {
    const sc = student.columns.length;
    const ec = expected.columns.length;
    const sr = student.rows.length;
    const er = expected.rows.length;
    if (sc !== ec) return { ok: false, code: 'columns', message: `Close! Your result has ${plural(sc, 'column', 'columns')}; the expected result has ${ec}. Check your SELECT list.` };
    if (sr > er) return { ok: false, code: 'more-rows', message: `Close! Your result has ${plural(sr, 'row', 'rows')}; the expected result has ${er}. Check your WHERE clause, or whether you need GROUP BY.` };
    if (sr < er) return { ok: false, code: 'fewer-rows', message: `Close! Your result has ${plural(sr, 'row', 'rows')}; the expected result has ${er}. Check your WHERE conditions and your JOINs.` };
    if (!sameMultiset(student.rows, expected.rows)) return { ok: false, code: 'values', message: 'Your result is the right size, but some values are different. Check your calculations and which columns you picked.' };
    if (orderMatters && !student.rows.every((r, i) => rowsEqual(r, expected.rows[i]))) return { ok: false, code: 'order', message: 'You have the right rows, but not in the right order. Check your ORDER BY.' };
    return { ok: true, code: 'match', message: `Nice! Your result matches. ${plural(er, 'row', 'rows')} × ${plural(ec, 'column', 'columns')}.` };
  }

  const stripSemi = s => s.replace(/;\s*$/, '');

  function checkExercise(studio, statementText, exercise) {
    const student = X.runQuery(studio, statementText);
    if (!student.ok) return { ok: false, code: 'error', message: 'Fix the error, then check again.', error: student.error };
    const expected = X.runQuery(studio, stripSemi(exercise.answer));
    if (!expected.ok) throw new Error(`Exercise answer failed: ${expected.error.message}`);
    return Object.assign(compareResults(student, expected, { orderMatters: !!exercise.orderMatters }), { student });
  }

  const api = { valuesEqual, compareResults, checkExercise };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/check.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/check.js tools/sql-studio/test/check.test.js
git commit -m "SQL Studio: compare results for Check my answer with kind feedback"
```

---
### Task 8: The exercises

**Files:**
- Create: `tools/sql-studio/src/exercises.js` (replaces the temporary stub from Task 6)
- Test: `tools/sql-studio/test/exercises.test.js`

**Interfaces:**
- Consumes: data set `questions` (for the test only), `runQuery`, `buildSchema`.
- Produces: `EXERCISES: { [datasetId]: Exercise[] }` where `Exercise = { text, note?, hint?, answer, orderMatters }`; `ASSESSMENT_FROM = 7`; `isAssessment(datasetNumber): boolean`; `exerciseLabel(datasetNumber, index): '1.1'`.

Every answer below was run against the real data while this plan was written. All 60 return rows, the first three in each set match the Query Explorer text exactly, and every `orderMatters` answer has a single row order. Three thresholds were set so the filter removes some groups: 2.6 uses 3,000 tickets, 4.6 uses 12 points, and 10.6 uses "more than one set".

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/exercises.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../src/exercises.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const datasets = loadDatasets();
const stripSemi = s => s.replace(/;\s*$/, '');

test('every data set has 5–6 exercises, keyed by id', () => {
  assert.deepEqual(Object.keys(X.EXERCISES).sort(), datasets.map(d => d.id).sort());
  for (const d of datasets) {
    const n = X.EXERCISES[d.id].length;
    assert.ok(n >= 5 && n <= 6, `${d.id} has ${n}`);
  }
});

test('the first three exercises match the Query Explorer questions and notes exactly', () => {
  for (const d of datasets) {
    d.questions.forEach((q, i) => {
      const ex = X.EXERCISES[d.id][i];
      assert.equal(ex.text, q.text, `${d.id} ${i + 1}`);
      assert.equal(ex.note || '', q.note || '', `${d.id} ${i + 1} note`);
    });
  }
});

test('practice sets (1–6) all have hints; assessment sets (7–10) have none', () => {
  for (const d of datasets) {
    for (const ex of X.EXERCISES[d.id]) {
      if (X.isAssessment(d.number)) assert.equal(ex.hint, undefined, `${d.id}: ${ex.text}`);
      else assert.ok(ex.hint && ex.hint.length > 10, `${d.id}: ${ex.text}`);
    }
  }
  assert.equal(X.isAssessment(6), false);
  assert.equal(X.isAssessment(7), true);
});

test('hints never contain the answer query', () => {
  for (const list of Object.values(X.EXERCISES)) for (const ex of list) {
    if (ex.hint) assert.ok(!/SELECT\s+\S+.*FROM/i.test(ex.hint), ex.text);
  }
});

test('every answer runs and returns at least one row', async () => {
  const SQL = await getSQL();
  for (const d of datasets) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    for (const ex of X.EXERCISES[d.id]) {
      const r = D.runQuery(st, stripSemi(ex.answer));
      assert.equal(r.ok, true, `${d.id}: ${ex.text}\n${r.error && r.error.message}`);
      assert.ok(r.rows.length > 0, `${d.id}: ${ex.text} returned no rows`);
    }
    D.closeStudio(st);
  }
});

test('answers with orderMatters have exactly one correct order (no ties)', async () => {
  const SQL = await getSQL();
  for (const d of datasets) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    for (const ex of X.EXERCISES[d.id].filter(e => e.orderMatters)) {
      assert.match(ex.answer, /ORDER BY/i, ex.text);
      const normal = D.runQuery(st, stripSemi(ex.answer));
      st.db.run('PRAGMA reverse_unordered_selects = ON');
      const reversed = D.runQuery(st, stripSemi(ex.answer));
      st.db.run('PRAGMA reverse_unordered_selects = OFF');
      assert.deepEqual(reversed.rows, normal.rows, `${d.id}: ${ex.text} has ties in its ORDER BY`);
    }
    D.closeStudio(st);
  }
});

test('exerciseLabel numbers like the Query Explorer', () => {
  assert.equal(X.exerciseLabel(1, 0), '1.1');
  assert.equal(X.exerciseLabel(10, 5), '10.6');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/exercises.test.js`
Expected: FAIL. The Task 6 stub has no exercises (`Object.keys(EXERCISES)` is empty).

- [ ] **Step 3: Write `exercises.js`**

`tools/sql-studio/src/exercises.js`:

```js
// SQL Studio: exercises for each data set, keyed by data set id. Edit by hand.
//
// Each exercise:
//   text          the question (the first three match the Query Explorer word for word)
//   note          optional extra prompt, shown in italics under the question
//   hint          practice data sets only (1–6): which tables and clauses are needed, never the query
//   answer        the reference query; students never see it
//   orderMatters  true only when the question asks for a sort order (the answer must have no ties)
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  // Data sets numbered this or higher are for assessment: no hints and no Check button.
  const ASSESSMENT_FROM = 7;

  const EXERCISES = {
    spotify: [
      {
        text: 'How many total streams did each artist have in March 2026?',
        hint: "You\'ll need Streams, Songs, and Artists, a WHERE on the date, and a GROUP BY.",
        answer: `SELECT a.artist_name, SUM(st.stream_count) AS total_streams
          FROM Streams st
          JOIN Songs so ON so.song_id = st.song_id
          JOIN Artists a ON a.artist_id = so.artist_id
          WHERE st.stream_date BETWEEN '2026-03-01' AND '2026-03-31'
          GROUP BY a.artist_name;`,
        orderMatters: false,
      },
      {
        text: 'What are the titles and release dates of all Latin songs?',
        hint: "You\'ll need Songs and Artists joined on artist_id, and a WHERE on genre.",
        answer: `SELECT so.song_title, so.release_date
          FROM Songs so
          JOIN Artists a ON a.artist_id = so.artist_id
          WHERE a.genre = 'Latin';`,
        orderMatters: false,
      },
      {
        text: 'How many songs does each artist have?',
        note: 'Is anyone missing? Why?',
        hint: "You\'ll need Artists and Songs joined on artist_id, COUNT, and a GROUP BY.",
        answer: `SELECT a.artist_name, COUNT(*) AS number_of_songs
          FROM Artists a
          JOIN Songs so ON so.artist_id = a.artist_id
          GROUP BY a.artist_name;`,
        orderMatters: false,
      },
      {
        text: 'List the five longest songs, longest first.',
        hint: 'You only need Songs. Sort with ORDER BY … DESC and keep five rows with LIMIT.',
        answer: `SELECT song_title, duration_sec
          FROM Songs
          ORDER BY duration_sec DESC
          LIMIT 5;`,
        orderMatters: true,
      },
      {
        text: "Show each song\'s title and its length in minutes.",
        hint: 'You only need Songs. Make a calculated column with AS. Divide by 60.0 (not 60) to keep the decimals.',
        answer: `SELECT song_title, duration_sec / 60.0 AS duration_min
          FROM Songs;`,
        orderMatters: false,
      },
      {
        text: 'Which artists had more than 5 million total streams?',
        hint: "You\'ll need Streams, Songs, and Artists, a GROUP BY, and HAVING to filter the totals.",
        answer: `SELECT a.artist_name, SUM(st.stream_count) AS total_streams
          FROM Streams st
          JOIN Songs so ON so.song_id = st.song_id
          JOIN Artists a ON a.artist_id = so.artist_id
          GROUP BY a.artist_name
          HAVING SUM(st.stream_count) > 5000000;`,
        orderMatters: false,
      },
    ],
    concert: [
      {
        text: 'How many tickets were sold in each city?',
        hint: "You\'ll need TicketSales, Shows, and Venues, SUM of quantity, and a GROUP BY.",
        answer: `SELECT v.city, SUM(t.quantity) AS tickets_sold
          FROM TicketSales t
          JOIN Shows s ON s.show_id = t.show_id
          JOIN Venues v ON v.venue_id = s.venue_id
          GROUP BY v.city;`,
        orderMatters: false,
      },
      {
        text: 'Which shows sold VIP tickets priced above $300?',
        hint: "You\'ll need TicketSales and Shows, and a WHERE with two conditions joined by AND.",
        answer: `SELECT s.artist_name, s.show_date, t.price_each
          FROM TicketSales t
          JOIN Shows s ON s.show_id = t.show_id
          WHERE t.ticket_type = 'VIP'
            AND t.price_each > 300;`,
        orderMatters: false,
      },
      {
        text: 'What is the average ticket price for each ticket type?',
        hint: 'You only need TicketSales, AVG, and a GROUP BY.',
        answer: `SELECT ticket_type, AVG(price_each) AS average_price
          FROM TicketSales
          GROUP BY ticket_type;`,
        orderMatters: false,
      },
      {
        text: 'Which artists have a show in July 2026? List each artist once.',
        hint: 'You only need Shows. Use DISTINCT, and a WHERE on show_date with BETWEEN.',
        answer: `SELECT DISTINCT artist_name
          FROM Shows
          WHERE show_date BETWEEN '2026-07-01' AND '2026-07-31';`,
        orderMatters: false,
      },
      {
        text: 'For each ticket sale, show the ticket type, quantity, and the total money from that sale.',
        hint: 'You only need TicketSales. Multiply quantity by price_each in a calculated column with AS.',
        answer: `SELECT ticket_type, quantity, quantity * price_each AS sale_total
          FROM TicketSales;`,
        orderMatters: false,
      },
      {
        text: 'Which venues sold more than 3,000 tickets in total?',
        hint: "You\'ll need TicketSales, Shows, and Venues, a GROUP BY on the venue, and HAVING.",
        answer: `SELECT v.venue_name, SUM(t.quantity) AS tickets_sold
          FROM TicketSales t
          JOIN Shows s ON s.show_id = t.show_id
          JOIN Venues v ON v.venue_id = s.venue_id
          GROUP BY v.venue_name
          HAVING SUM(t.quantity) > 3000;`,
        orderMatters: false,
      },
    ],
    netflix: [
      {
        text: 'How many total minutes were watched for each series?',
        hint: "You\'ll need ViewingSessions, Episodes, and Series, SUM, and a GROUP BY.",
        answer: `SELECT se.series_title, SUM(v.minutes_watched) AS total_minutes
          FROM ViewingSessions v
          JOIN Episodes e ON e.episode_id = v.episode_id
          JOIN Series se ON se.series_id = e.series_id
          GROUP BY se.series_title;`,
        orderMatters: false,
      },
      {
        text: 'What did Jordan watch in February 2026?',
        hint: "You\'ll need ViewingSessions, Episodes, and Series, and a WHERE on viewer_name AND watch_date.",
        answer: `SELECT se.series_title, e.season, e.episode_number, v.watch_date
          FROM ViewingSessions v
          JOIN Episodes e ON e.episode_id = v.episode_id
          JOIN Series se ON se.series_id = e.series_id
          WHERE v.viewer_name = 'Jordan'
            AND v.watch_date BETWEEN '2026-02-01' AND '2026-02-28';`,
        orderMatters: false,
      },
      {
        text: 'What is the average episode runtime for each genre?',
        hint: "You\'ll need Episodes and Series, AVG, and a GROUP BY on genre.",
        answer: `SELECT se.genre, AVG(e.runtime_min) AS average_runtime
          FROM Episodes e
          JOIN Series se ON se.series_id = e.series_id
          GROUP BY se.genre;`,
        orderMatters: false,
      },
      {
        text: 'Which series have a title that starts with "S"?',
        hint: 'You only need Series. Use LIKE with a % after the letter.',
        answer: `SELECT series_title
          FROM Series
          WHERE series_title LIKE 'S%';`,
        orderMatters: false,
      },
      {
        text: 'List the series released in 2020 or later that are not dramas, newest first.',
        hint: 'You only need Series. Combine two conditions with AND, use NOT (or <>), and sort with ORDER BY … DESC.',
        answer: `SELECT series_title, genre, release_year
          FROM Series
          WHERE release_year >= 2020
            AND NOT genre = 'Drama'
          ORDER BY release_year DESC;`,
        orderMatters: true,
      },
      {
        text: 'Which viewers watched more than 200 minutes in total?',
        hint: 'You only need ViewingSessions, SUM, a GROUP BY, and HAVING.',
        answer: `SELECT viewer_name, SUM(minutes_watched) AS total_minutes
          FROM ViewingSessions
          GROUP BY viewer_name
          HAVING SUM(minutes_watched) > 200;`,
        orderMatters: false,
      },
    ],
    basketball: [
      {
        text: 'How many total points did each player score this season?',
        hint: "You\'ll need BoxScores and Players, SUM, and a GROUP BY.",
        answer: `SELECT p.player_name, SUM(b.points) AS total_points
          FROM BoxScores b
          JOIN Players p ON p.player_id = b.player_id
          GROUP BY p.player_name;`,
        orderMatters: false,
      },
      {
        text: 'What is the average number of points for each position in home games?',
        hint: "You\'ll need BoxScores, Games, and Players, a WHERE on home_away, AVG, and a GROUP BY.",
        answer: `SELECT p.position, AVG(b.points) AS average_points
          FROM BoxScores b
          JOIN Games g ON g.game_id = b.game_id
          JOIN Players p ON p.player_id = b.player_id
          WHERE g.home_away = 'Home'
          GROUP BY p.position;`,
        orderMatters: false,
      },
      {
        text: 'In the games the Herd won, which players scored 20 or more points?',
        hint: "You\'ll need BoxScores, Games, and Players, and a WHERE with two conditions joined by AND.",
        answer: `SELECT p.player_name, g.opponent, b.points
          FROM BoxScores b
          JOIN Games g ON g.game_id = b.game_id
          JOIN Players p ON p.player_id = b.player_id
          WHERE b.points >= 20
            AND g.result = 'W';`,
        orderMatters: false,
      },
      {
        text: 'Show the three highest-scoring single games by a player: the player, the opponent, and the points.',
        hint: "You\'ll need BoxScores, Games, and Players, then ORDER BY points DESC and LIMIT.",
        answer: `SELECT p.player_name, g.opponent, b.points
          FROM BoxScores b
          JOIN Games g ON g.game_id = b.game_id
          JOIN Players p ON p.player_id = b.player_id
          ORDER BY b.points DESC
          LIMIT 3;`,
        orderMatters: true,
      },
      {
        text: 'List the games that were home wins, plus any game against App State.',
        hint: 'You only need Games. Use AND inside parentheses, then OR.',
        answer: `SELECT opponent, game_date, home_away, result
          FROM Games
          WHERE (home_away = 'Home' AND result = 'W')
             OR opponent = 'App State';`,
        orderMatters: false,
      },
      {
        text: 'Which players averaged more than 12 points a game? Round the average to one decimal place.',
        hint: "You\'ll need BoxScores and Players, AVG inside ROUND, a GROUP BY, and HAVING.",
        answer: `SELECT p.player_name, ROUND(AVG(b.points), 1) AS average_points
          FROM BoxScores b
          JOIN Players p ON p.player_id = b.player_id
          GROUP BY p.player_name
          HAVING AVG(b.points) > 12;`,
        orderMatters: false,
      },
    ],
    dining: [
      {
        text: 'How many dinner swipes did each dining hall get?',
        hint: "You\'ll need MealSwipes and DiningHalls, a WHERE on meal_period, COUNT, and a GROUP BY.",
        answer: `SELECT d.hall_name, COUNT(*) AS dinner_swipes
          FROM MealSwipes m
          JOIN DiningHalls d ON d.hall_id = m.hall_id
          WHERE m.meal_period = 'Dinner'
          GROUP BY d.hall_name;`,
        orderMatters: false,
      },
      {
        text: 'How many swipes came from each meal plan?',
        hint: "You\'ll need MealSwipes and Students, COUNT, and a GROUP BY on meal_plan.",
        answer: `SELECT s.meal_plan, COUNT(*) AS swipes
          FROM MealSwipes m
          JOIN Students s ON s.student_id = m.student_id
          GROUP BY s.meal_plan;`,
        orderMatters: false,
      },
      {
        text: 'Who ate late-night meals, and where?',
        hint: "You\'ll need MealSwipes, Students, and DiningHalls, and a WHERE on meal_period.",
        answer: `SELECT s.first_name, d.hall_name, m.swipe_date
          FROM MealSwipes m
          JOIN Students s ON s.student_id = m.student_id
          JOIN DiningHalls d ON d.hall_id = m.hall_id
          WHERE m.meal_period = 'Late Night';`,
        orderMatters: false,
      },
      {
        text: 'Which dining halls have "the" anywhere in their name?',
        note: 'Does LIKE care about upper and lower case?',
        hint: 'You only need DiningHalls. Use LIKE with % on both sides of the word.',
        answer: `SELECT hall_name
          FROM DiningHalls
          WHERE hall_name LIKE '%the%';`,
        orderMatters: false,
      },
      {
        text: 'Which residence halls do students on the Unlimited plan live in? List each hall once, A to Z.',
        hint: 'You only need Students. Use DISTINCT, a WHERE on meal_plan, and ORDER BY.',
        answer: `SELECT DISTINCT residence_hall
          FROM Students
          WHERE meal_plan = 'Unlimited'
          ORDER BY residence_hall;`,
        orderMatters: true,
      },
      {
        text: 'Which students swiped in at 3 or more different dining halls?',
        hint: "You\'ll need MealSwipes and Students, COUNT(DISTINCT …), a GROUP BY, and HAVING.",
        answer: `SELECT s.first_name, COUNT(DISTINCT m.hall_id) AS halls_visited
          FROM MealSwipes m
          JOIN Students s ON s.student_id = m.student_id
          GROUP BY s.student_id, s.first_name
          HAVING COUNT(DISTINCT m.hall_id) >= 3;`,
        orderMatters: false,
      },
    ],
    fantasy: [
      {
        text: 'How many total points did each fantasy team score?',
        hint: "You\'ll need WeeklyPoints, NFLPlayers, and FantasyTeams, SUM, and a GROUP BY.",
        answer: `SELECT f.team_name, SUM(w.fantasy_points) AS total_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          JOIN FantasyTeams f ON f.team_id = p.team_id
          GROUP BY f.team_name;`,
        orderMatters: false,
      },
      {
        text: 'Which players had a week with 25 or more points?',
        hint: "You\'ll need WeeklyPoints and NFLPlayers, and a WHERE on fantasy_points.",
        answer: `SELECT p.player_name, w.week, w.fantasy_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          WHERE w.fantasy_points >= 25;`,
        orderMatters: false,
      },
      {
        text: 'What is the average weekly score for each position?',
        hint: "You\'ll need WeeklyPoints and NFLPlayers, AVG, and a GROUP BY on position.",
        answer: `SELECT p.position, AVG(w.fantasy_points) AS average_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          GROUP BY p.position;`,
        orderMatters: false,
      },
      {
        text: 'List the wide receivers (WR) and running backs (RB), sorted by name.',
        hint: 'You only need NFLPlayers. Use OR (or IN) in the WHERE, then ORDER BY.',
        answer: `SELECT player_name, position, nfl_team
          FROM NFLPlayers
          WHERE position = 'WR' OR position = 'RB'
          ORDER BY player_name;`,
        orderMatters: true,
      },
      {
        text: 'Which player had the single highest-scoring week? Show the name, week, and points.',
        hint: "You\'ll need WeeklyPoints and NFLPlayers, ORDER BY … DESC, and LIMIT 1.",
        answer: `SELECT p.player_name, w.week, w.fantasy_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          ORDER BY w.fantasy_points DESC
          LIMIT 1;`,
        orderMatters: false,
      },
      {
        text: 'For each fantasy team, what was the average weekly score of its players? Only show teams that averaged more than 20.',
        hint: "You\'ll need WeeklyPoints, NFLPlayers, and FantasyTeams, AVG, a GROUP BY, and HAVING.",
        answer: `SELECT f.team_name, AVG(w.fantasy_points) AS average_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          JOIN FantasyTeams f ON f.team_id = p.team_id
          GROUP BY f.team_name
          HAVING AVG(w.fantasy_points) > 20;`,
        orderMatters: false,
      },
    ],
    boxoffice: [
      {
        text: 'How much did each studio earn in total?',
        answer: `SELECT st.studio_name, SUM(w.gross_millions) AS total_millions
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          JOIN Studios st ON st.studio_id = m.studio_id
          GROUP BY st.studio_name;`,
        orderMatters: false,
      },
      {
        text: 'Which PG-13 movies had a weekend over $50 million?',
        answer: `SELECT m.movie_title, w.weekend_date, w.gross_millions
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          WHERE m.rating = 'PG-13'
            AND w.gross_millions > 50;`,
        orderMatters: false,
      },
      {
        text: "What was each movie\'s best weekend?",
        answer: `SELECT m.movie_title, MAX(w.gross_millions) AS best_weekend
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          GROUP BY m.movie_title;`,
        orderMatters: false,
      },
      {
        text: 'Which R-rated movies are in the data set? Sort them from earliest to latest release.',
        answer: `SELECT movie_title, release_date
          FROM Movies
          WHERE rating = 'R'
          ORDER BY release_date;`,
        orderMatters: true,
      },
      {
        text: 'For each weekend gross, show the movie and how much it earned per theater, in dollars.',
        answer: `SELECT m.movie_title, w.weekend_date, w.gross_millions * 1000000 / w.theaters AS dollars_per_theater
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id;`,
        orderMatters: false,
      },
      {
        text: 'Which studios earned more than $300 million in total?',
        answer: `SELECT st.studio_name, SUM(w.gross_millions) AS total_millions
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          JOIN Studios st ON st.studio_id = m.studio_id
          GROUP BY st.studio_name
          HAVING SUM(w.gross_millions) > 300;`,
        orderMatters: false,
      },
    ],
    esports: [
      {
        text: 'How many total kills did each team get?',
        answer: `SELECT t.team_name, SUM(ms.kills) AS total_kills
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          JOIN Teams t ON t.team_id = g.team_id
          GROUP BY t.team_name;`,
        orderMatters: false,
      },
      {
        text: 'Which gamers had 20 or more kills in a match?',
        answer: `SELECT g.gamertag, ms.map_name, ms.kills
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          WHERE ms.kills >= 20;`,
        orderMatters: false,
      },
      {
        text: 'What is the average number of assists for each role?',
        answer: `SELECT g.role, AVG(ms.assists) AS average_assists
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          GROUP BY g.role;`,
        orderMatters: false,
      },
      {
        text: 'Which maps were played? List each map once, A to Z.',
        answer: `SELECT DISTINCT map_name
          FROM MatchStats
          ORDER BY map_name;`,
        orderMatters: true,
      },
      {
        text: 'For each match line, show the gamertag, the map, and the kills-per-death ratio rounded to 2 decimal places.',
        answer: `SELECT g.gamertag, ms.map_name, ROUND(ms.kills * 1.0 / ms.deaths, 2) AS kill_death_ratio
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id;`,
        orderMatters: false,
      },
      {
        text: 'Which gamers averaged at least 15 kills per match?',
        answer: `SELECT g.gamertag, AVG(ms.kills) AS average_kills
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          GROUP BY g.gamertag
          HAVING AVG(ms.kills) >= 15;`,
        orderMatters: false,
      },
    ],
    tiktok: [
      {
        text: 'How many total views did each meme format get?',
        answer: `SELECT v.meme_format, SUM(d.views) AS total_views
          FROM DailyViews d
          JOIN Videos v ON v.video_id = d.video_id
          GROUP BY v.meme_format;`,
        orderMatters: false,
      },
      {
        text: 'How many total likes did each creator get?',
        answer: `SELECT c.handle, SUM(d.likes) AS total_likes
          FROM DailyViews d
          JOIN Videos v ON v.video_id = d.video_id
          JOIN Creators c ON c.creator_id = v.creator_id
          GROUP BY c.handle;`,
        orderMatters: false,
      },
      {
        text: 'What did comedy creators post in the first half of April 2026?',
        answer: `SELECT c.handle, v.caption, v.post_date
          FROM Videos v
          JOIN Creators c ON c.creator_id = v.creator_id
          WHERE c.niche = 'Comedy'
            AND v.post_date BETWEEN '2026-04-01' AND '2026-04-15';`,
        orderMatters: false,
      },
      {
        text: 'Which videos have captions that start with "POV"?',
        answer: `SELECT caption
          FROM Videos
          WHERE caption LIKE 'POV%';`,
        orderMatters: false,
      },
      {
        text: 'Which creators have more than 100,000 followers and are not in the Gaming niche? Show the most followers first.',
        answer: `SELECT handle, niche, follower_count
          FROM Creators
          WHERE follower_count > 100000
            AND NOT niche = 'Gaming'
          ORDER BY follower_count DESC;`,
        orderMatters: true,
      },
      {
        text: 'Which videos got more than 1 million total views?',
        answer: `SELECT v.caption, SUM(d.views) AS total_views
          FROM DailyViews d
          JOIN Videos v ON v.video_id = d.video_id
          GROUP BY v.video_id, v.caption
          HAVING SUM(d.views) > 1000000;`,
        orderMatters: false,
      },
    ],
    festival: [
      {
        text: 'How many minutes of music does each stage host?',
        answer: `SELECT st.stage_name, SUM(s.set_length_min) AS total_minutes
          FROM SetTimes s
          JOIN Stages st ON st.stage_id = s.stage_id
          GROUP BY st.stage_name;`,
        orderMatters: false,
      },
      {
        text: 'Which acts play the Main Stage on Saturday?',
        answer: `SELECT a.act_name, s.set_length_min
          FROM SetTimes s
          JOIN Stages st ON st.stage_id = s.stage_id
          JOIN Acts a ON a.act_id = s.act_id
          WHERE st.stage_name = 'Main Stage'
            AND s.festival_date = '2026-04-11';`,
        orderMatters: false,
      },
      {
        text: 'How many headliners play each day?',
        answer: `SELECT s.festival_date, COUNT(*) AS headliners
          FROM SetTimes s
          JOIN Acts a ON a.act_id = s.act_id
          WHERE a.headliner = 'Yes'
          GROUP BY s.festival_date;`,
        orderMatters: false,
      },
      {
        text: 'List the acts that are not headliners, A to Z.',
        answer: `SELECT act_name
          FROM Acts
          WHERE NOT headliner = 'Yes'
          ORDER BY act_name;`,
        orderMatters: true,
      },
      {
        text: 'Which genres have "Pop" in their name? List each genre once.',
        answer: `SELECT DISTINCT genre
          FROM Acts
          WHERE genre LIKE '%Pop%';`,
        orderMatters: false,
      },
      {
        text: 'Which stages host more than one set?',
        answer: `SELECT st.stage_name, COUNT(*) AS number_of_sets
          FROM SetTimes s
          JOIN Stages st ON st.stage_id = s.stage_id
          GROUP BY st.stage_name
          HAVING COUNT(*) > 1;`,
        orderMatters: false,
      },
    ],
  };

  const isAssessment = datasetNumber => datasetNumber >= ASSESSMENT_FROM;
  const exerciseLabel = (datasetNumber, index) => `${datasetNumber}.${index + 1}`;

  const api = { EXERCISES, ASSESSMENT_FROM, isAssessment, exerciseLabel };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the exercise tests and the formatter tests that use them**

Run: `node --test tools/sql-studio/test/exercises.test.js tools/sql-studio/test/format.test.js`
Expected: PASS (7 + 9 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/exercises.js tools/sql-studio/test/exercises.test.js
git commit -m "SQL Studio: add 60 exercises (3 from the Query Explorer + 3 SQL-only per data set)"
```

---

### Task 9: Random query generator

**Files:**
- Create: `tools/sql-studio/src/randomq.js`
- Test: `tools/sql-studio/test/randomq.test.js`

**Interfaces:**
- Consumes: `isKeyword` (Task 2), `formatSql` (Task 6). The generator is given `run(sql) => Result` (Task 4) instead of a database, so it works with any schema, including uploads.
- Produces:
  - `FEATURES` (11 keys in popover order), `FEATURE_LABELS`, `DEFAULT_OPTIONS` (WHERE, JOIN, ORDER BY, LIMIT on), `NEEDS`.
  - `normalizeOptions(opts): { options, added: string[] }`.
  - `mulberry32(seed): () => number`.
  - `generateQuery({ schema, run, options, seed }): { sql, features: string[], tries, errors, rows }`. `sql` is formatted and ends with `;`.

**How it works (spec §7):**
- Each allowed feature is used about 60% of the time, and features pull in what they depend on.
- Joins walk 1–2 real relationships, and the newly joined table's column comes first in `ON`, as the book writes it.
- WHERE values come from a real sampled row, so at least that row matches.
- HAVING limits are picked from the real group values, preferring one that drops at least one group.
- A candidate that errors is counted in `errors` and retried. The test requires `errors === 0`, so a generator bug can't hide behind a retry.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/randomq.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../src/randomq.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const T = require('../src/sql-text.js');
const F = require('../src/format.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const ALL_ON = Object.fromEntries(Q.FEATURES.map(f => [f, true]));
const ALL_OFF = Object.fromEntries(Q.FEATURES.map(f => [f, false]));
const stripSemi = s => s.replace(/;\s*$/, '');

// Signs of each feature in the generated SQL text (formatted, so top-level AND/OR start a line).
const SIGNS = {
  where: /\nWHERE\b/, join: /\nJOIN\b/, groupBy: /\nGROUP BY\b/, having: /\nHAVING\b/, orderBy: /\nORDER BY\b/,
  limit: /\nLIMIT\b/, distinct: /\bDISTINCT\b/, like: /\bLIKE\b/, andOr: /\n\s+(AND|OR)\b/,
  aggregate: /\b(COUNT|SUM|AVG|MIN|MAX)\(/,
};

test('normalizeOptions adds what a feature needs', () => {
  const { options, added } = Q.normalizeOptions({ having: true, like: true });
  assert.equal(options.groupBy, true);
  assert.equal(options.aggregate, true);
  assert.equal(options.where, true);
  assert.deepEqual(added.sort(), ['aggregate', 'groupBy', 'where']);
});

test('the same seed gives the same query', async () => {
  const SQL = await getSQL();
  const st = D.openStudio(SQL, S.buildSchema(loadDatasets()[0]));
  const run = sql => D.runQuery(st, sql);
  const a = Q.generateQuery({ schema: st.schema, run, options: ALL_ON, seed: 42 });
  const b = Q.generateQuery({ schema: st.schema, run, options: ALL_ON, seed: 42 });
  assert.equal(a.sql, b.sql);
  D.closeStudio(st);
});

test('hundreds of random queries per data set all run, use real joins, and honor the toggles', async () => {
  const SQL = await getSQL();
  const seen = Object.fromEntries(Q.FEATURES.map(f => [f, 0]));
  for (const d of loadDatasets()) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    const run = sql => D.runQuery(st, sql);
    const rels = new Set(st.schema.relationships.flatMap(r => [
      `${r.from.table}.${r.from.column}=${r.to.table}.${r.to.column}`, `${r.to.table}.${r.to.column}=${r.from.table}.${r.from.column}`]));
    let withRows = 0;
    const cases = [];
    for (let i = 0; i < 300; i++) {
      const rnd = Q.mulberry32(i * 7919 + d.number);
      cases.push(Object.fromEntries(Q.FEATURES.map(f => [f, rnd() < 0.5])));
    }
    for (let i = 0; i < 100; i++) cases.push(ALL_ON, ALL_OFF);
    cases.forEach((opts, i) => {
      const g = Q.generateQuery({ schema: st.schema, run, options: opts, seed: 1000 * d.number + i });
      const label = `${d.id} #${i}\n${g.sql}`;
      assert.equal(g.errors, 0, label);
      const r = run(stripSemi(g.sql));
      assert.equal(r.ok, true, `${label}\n${r.error && r.error.message}`);
      if (r.rows.length) withRows++;
      const allowed = Q.normalizeOptions(opts).options;
      for (const [f, re] of Object.entries(SIGNS)) {
        if (re.test(g.sql)) { assert.ok(allowed[f], `${f} used but off: ${label}`); seen[f]++; }
      }
      if (g.features.includes('calc')) { assert.ok(allowed.calc, label); seen.calc++; }
      // Every JOIN ... ON a.x = b.y matches a real relationship.
      const aliases = T.aliasMap(stripSemi(g.sql), st.schema.tables.map(t => t.name));
      for (const m of g.sql.matchAll(/JOIN \w+ \w+ ON (\w+)\.(\w+) = (\w+)\.(\w+)/g)) {
        const key = `${aliases.get(m[1])}.${m[2]}=${aliases.get(m[3])}.${m[4]}`;
        assert.ok(rels.has(key), `not a real key: ${key}\n${label}`);
      }
    });
    assert.ok(withRows / cases.length >= 0.95, `${d.id}: only ${withRows}/${cases.length} returned rows`);
    D.closeStudio(st);
  }
  for (const f of Q.FEATURES) assert.ok(seen[f] > 0, `feature never used: ${f}`);
});

test('formatting never changes the result of random queries', async () => {
  const SQL = await getSQL();
  const ds = loadDatasets();
  for (let i = 0; i < 300; i++) {
    const d = ds[i % ds.length];
    const st = D.openStudio(SQL, S.buildSchema(d));
    const run = sql => D.runQuery(st, sql);
    const g = Q.generateQuery({ schema: st.schema, run, options: ALL_ON, seed: 5000 + i });
    const oneLine = stripSemi(g.sql).replace(/\s+/g, ' ');
    assert.deepEqual(run(stripSemi(F.formatSql(oneLine))), run(oneLine), g.sql);
    D.closeStudio(st);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/randomq.test.js`
Expected: FAIL with "Cannot find module '../src/randomq.js'".

- [ ] **Step 3: Implement `randomq.js`**

`tools/sql-studio/src/randomq.js`:

```js
// SQL Studio: writes a random, valid query for the current schema, using only real keys for joins.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./format.js')) : root.SS;

  const FEATURES = ['where', 'andOr', 'join', 'aggregate', 'groupBy', 'having', 'calc', 'orderBy', 'limit', 'distinct', 'like'];
  const FEATURE_LABELS = {
    where: 'WHERE', andOr: 'AND/OR', join: 'JOIN', aggregate: 'Aggregate (COUNT/SUM/AVG/MIN/MAX)', groupBy: 'GROUP BY',
    having: 'HAVING', calc: 'Calculated field', orderBy: 'ORDER BY', limit: 'LIMIT', distinct: 'DISTINCT', like: 'LIKE',
  };
  const DEFAULT_OPTIONS = { where: true, andOr: false, join: true, aggregate: false, groupBy: false, having: false, calc: false, orderBy: true, limit: true, distinct: false, like: false };
  // Turning on the key turns on everything in its list.
  const NEEDS = { having: ['groupBy'], groupBy: ['aggregate'], andOr: ['where'], like: ['where'] };
  const USE_CHANCE = 0.6;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeOptions(opts) {
    const options = Object.assign({}, ...FEATURES.map(f => ({ [f]: false })), opts);
    const added = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const [f, deps] of Object.entries(NEEDS)) {
        if (!options[f]) continue;
        for (const d of deps) if (!options[d]) { options[d] = true; added.push(d); changed = true; }
      }
    }
    return { options, added };
  }

  const SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const ident = name => (SAFE.test(name) && !X.isKeyword(name) ? name : `"${name.replace(/"/g, '""')}"`);
  const lit = v => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

  function makeRng(seed) {
    const r = mulberry32(seed);
    const rng = {
      next: r,
      chance: p => r() < p,
      int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
      pick: arr => arr[Math.floor(r() * arr.length)],
      shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
    return rng;
  }

  function aliasFor(name, used) {
    const lower = name.toLowerCase();
    for (const a of [lower[0], lower.slice(0, 2), lower.slice(0, 3)]) if (/^[a-z]/.test(a) && !used.has(a) && !X.isKeyword(a)) { used.add(a); return a; }
    let k = 2;
    while (used.has(lower[0] + k)) k++;
    used.add(lower[0] + k);
    return lower[0] + k;
  }

  // Picks the FROM table and (maybe) a join path of 1–2 real relationships.
  function buildFrom(schema, rng, useJoin) {
    const linked = schema.tables.filter(t => schema.relationships.some(r => r.from.table === t.name || r.to.table === t.name));
    const joinable = useJoin && linked.length >= 2;
    const start = rng.pick(joinable ? linked : schema.tables);
    const parts = [{ table: start }];
    const joins = [];
    if (joinable) {
      const hops = rng.int(1, 2);
      for (let h = 0; h < hops; h++) {
        const inSet = new Set(parts.map(p => p.table.name));
        const options = schema.relationships.filter(r => inSet.has(r.from.table) !== inSet.has(r.to.table));
        if (!options.length) break;
        const rel = rng.pick(options);
        const newName = inSet.has(rel.from.table) ? rel.to.table : rel.from.table;
        const table = schema.tables.find(t => t.name === newName);
        parts.push({ table });
        joins.push(rel);
      }
    }
    const aliased = parts.length > 1;
    const used = new Set();
    parts.forEach(p => { p.alias = aliased ? aliasFor(p.table.name, used) : null; });
    const aliasOf = name => parts.find(p => p.table.name === name).alias;
    const ref = (tableName, col) => (aliased ? `${aliasOf(tableName)}.${ident(col)}` : ident(col));
    let sql = `FROM ${ident(start.name)}${aliased ? ' ' + parts[0].alias : ''}`;
    joins.forEach((rel, k) => {
      const p = parts[k + 1];
      // The book writes the newly joined table's column first: JOIN Songs so ON so.song_id = st.song_id
      const [mine, theirs] = rel.from.table === p.table.name ? [rel.from, rel.to] : [rel.to, rel.from];
      sql += `\nJOIN ${ident(p.table.name)} ${p.alias} ON ${ref(mine.table, mine.column)} = ${ref(theirs.table, theirs.column)}`;
    });
    const columns = parts.flatMap(p => p.table.columns.map(c => ({ expr: ref(p.table.name, c.name), name: c.name, type: c.type, key: c.pk || !!c.fk })));
    return { sql, columns, joined: joins.length > 0 };
  }

  function condition(col, value, sampleValues, rng, asLike) {
    if (asLike) {
      const s = String(value);
      if (col.type !== 'text' || s.length < 2 || /[%_']/.test(s)) return null;
      const len = Math.min(s.length, rng.int(2, 4));
      const mode = rng.pick(['contains', 'starts', 'ends']);
      const piece = mode === 'starts' ? s.slice(0, len) : mode === 'ends' ? s.slice(-len) : s.slice(rng.int(0, s.length - len)).slice(0, len);
      if (!piece.trim()) return null;
      const pat = mode === 'starts' ? `${piece}%` : mode === 'ends' ? `%${piece}` : `%${piece}%`;
      return `${col.expr} LIKE ${lit(pat)}`;
    }
    const others = [...new Set(sampleValues.filter(v => v !== null && v !== value))];
    const other = others.length ? rng.pick(others) : null;
    if (col.type === 'text') {
      const kind = rng.pick(['eq', 'eq', 'in', 'ne']);
      if (kind === 'in' && other !== null) return `${col.expr} IN (${lit(value)}, ${lit(other)})`;
      if (kind === 'ne' && other !== null) return `${col.expr} <> ${lit(other)}`;
      return `${col.expr} = ${lit(value)}`;
    }
    const kind = rng.pick(['ge', 'le', 'between']);
    if (kind === 'between' && other !== null) {
      const [lo, hi] = value < other ? [value, other] : [other, value];
      return `${col.expr} BETWEEN ${lit(lo)} AND ${lit(hi)}`;
    }
    return `${col.expr} ${kind === 'le' ? '<=' : '>='} ${lit(value)}`;
  }

  const AGG_NAMES = { SUM: 'total', AVG: 'average', MIN: 'lowest', MAX: 'highest' };

  function attempt(schema, run, o, rng, forceNoWhere) {
    const use = f => o[f] && rng.chance(USE_CHANCE);
    const having = use('having');
    const groupBy = having || use('groupBy');
    const aggregate = groupBy || use('aggregate');
    const like = !forceNoWhere && use('like');
    const andOr = !forceNoWhere && use('andOr');
    const where = !forceNoWhere && (like || andOr || use('where'));
    const join = use('join');
    const calc = use('calc');
    const distinct = use('distinct');
    const orderBy = use('orderBy');
    const limit = use('limit');
    const features = new Set();

    const from = buildFrom(schema, rng, join);
    if (from.joined) features.add('join');
    const sample = run(`SELECT ${from.columns.map(c => c.expr).join(', ')}\n${from.sql}\nLIMIT 500`);
    if (!sample.ok || !sample.rows.length) return null;
    const row = rng.pick(sample.rows);
    const colIndex = new Map(from.columns.map((c, i) => [c, i]));
    const valuesOf = c => sample.rows.map(r => r[colIndex.get(c)]);
    const plain = from.columns.filter(c => !c.key);
    const pool = plain.length ? plain : from.columns;
    const nums = pool.filter(c => c.type === 'number');
    const groupable = pool.filter(c => c.type !== 'number');

    // WHERE
    const conds = [];
    if (where) {
      const cands = rng.shuffle(pool.filter(c => row[colIndex.get(c)] !== null));
      if (like) {
        for (const c of cands) {
          const cond = condition(c, row[colIndex.get(c)], valuesOf(c), rng, true);
          if (cond) { conds.push({ col: c, cond }); features.add('like'); break; }
        }
      }
      const want = andOr ? 2 : 1;
      for (const c of cands) {
        if (conds.length >= want) break;
        if (conds.some(x => x.col === c)) continue;
        const cond = condition(c, row[colIndex.get(c)], valuesOf(c), rng, false);
        if (cond) conds.push({ col: c, cond });
      }
      if (conds.length) features.add('where');
      if (conds.length === 2) features.add('andOr');
    }
    const joiner = rng.chance(0.5) ? 'AND' : 'OR';
    const whereSql = conds.length ? `\nWHERE ${conds.map(x => x.cond).join(` ${joiner} `)}` : '';

    // SELECT
    const usedNames = new Set();
    const asName = base => { let n = base; let k = 2; while (usedNames.has(n)) n = `${base}_${k++}`; usedNames.add(n); return n; };
    const items = []; // { sql, name, aggExpr? }
    let groupSql = '';
    let havingSql = '';
    if (aggregate) {
      features.add('aggregate');
      let g = null;
      if (groupBy) {
        g = rng.pick(groupable.length ? groupable : pool);
        items.push({ sql: g.expr, name: asName(g.name) });
        groupSql = `\nGROUP BY ${g.expr}`;
        features.add('groupBy');
      }
      const aggs = [];
      const distinctable = groupable.filter(c => c !== g);
      if (distinct && distinctable.length) {
        const d = rng.pick(distinctable);
        aggs.push({ expr: `COUNT(DISTINCT ${d.expr})`, base: `distinct_${d.name}` });
        features.add('distinct');
      }
      if (calc && nums.length) {
        if (nums.length >= 2) {
          const [a, b] = rng.shuffle(nums);
          aggs.push({ expr: `SUM(${a.expr} * ${b.expr})`, base: `total_${a.name}_times_${b.name}` });
        } else {
          const a = nums[0];
          aggs.push({ expr: `MAX(${a.expr}) - MIN(${a.expr})`, base: `${a.name}_range` });
        }
        features.add('calc');
      }
      const howMany = aggs.length ? rng.int(0, 1) : rng.int(1, 2);
      for (let k = 0; k < howMany; k++) {
        if (nums.length && rng.chance(0.7)) {
          const fn = rng.pick(['SUM', 'AVG', 'MIN', 'MAX']);
          const c = rng.pick(nums);
          aggs.push({ expr: `${fn}(${c.expr})`, base: `${AGG_NAMES[fn]}_${c.name}` });
        } else aggs.push({ expr: 'COUNT(*)', base: 'number_of_rows' });
      }
      for (const a of aggs) items.push({ sql: `${a.expr} AS ${asName(a.base)}`, name: [...usedNames].pop(), aggExpr: a.expr });
      if (having && groupSql) {
        const target = rng.pick(items.filter(i => i.aggExpr));
        const probe = run(`SELECT ${target.aggExpr}\n${from.sql}${whereSql}${groupSql}`);
        const vals = probe.ok ? probe.rows.map(r => r[0]).filter(v => typeof v === 'number') : [];
        if (vals.length) {
          // Prefer a limit that drops at least one group.
          const above = vals.filter(x => x > Math.min(...vals));
          const v = rng.pick(above.length ? above : vals);
          const t = Number.isInteger(v) ? v : Math.floor(v * 100) / 100;
          havingSql = `\nHAVING ${target.aggExpr} >= ${t}`;
          features.add('having');
        }
      }
    } else {
      let chosen;
      if (distinct && groupable.length) {
        chosen = rng.shuffle(groupable).slice(0, rng.int(1, Math.min(2, groupable.length)));
        features.add('distinct');
      } else {
        const keyCols = from.columns.filter(c => c.key);
        chosen = rng.shuffle(pool).slice(0, rng.int(2, Math.min(4, Math.max(2, pool.length))));
        if (keyCols.length && rng.chance(0.2)) chosen.unshift(rng.pick(keyCols));
      }
      for (const c of chosen) items.push({ sql: c.expr, name: asName(c.name) });
      if (calc && nums.length && !features.has('distinct')) {
        if (nums.length >= 2) {
          const [a, b] = rng.shuffle(nums);
          items.push({ sql: `${a.expr} * ${b.expr} AS ${asName(`${a.name}_times_${b.name}`)}`, name: [...usedNames].pop() });
        } else {
          const a = nums[0];
          items.push({ sql: `ROUND(${a.expr} / 1000.0, 2) AS ${asName(`${a.name}_in_thousands`)}`, name: [...usedNames].pop() });
        }
        features.add('calc');
      }
    }

    let orderSql = '';
    if (orderBy) {
      const target = rng.pick(items);
      const by = target.sql.includes(' AS ') ? target.name : target.sql;
      orderSql = `\nORDER BY ${by}${rng.chance(0.5) ? ' DESC' : ''}`;
      features.add('orderBy');
    }
    let limitSql = '';
    if (limit) { limitSql = `\nLIMIT ${rng.int(3, 10)}`; features.add('limit'); }

    const head = `SELECT${features.has('distinct') && !aggregate ? ' DISTINCT' : ''} ${items.map(i => i.sql).join(', ')}`;
    return { sql: `${head}\n${from.sql}${whereSql}${groupSql}${havingSql}${orderSql}${limitSql}`, features: [...features] };
  }

  // run(sqlText) -> { ok, columns, rows } (db.runQuery bound to a studio).
  function generateQuery({ schema, run, options = DEFAULT_OPTIONS, seed = Date.now() }) {
    const { options: o } = normalizeOptions(options);
    const rng = makeRng(seed);
    let errors = 0;
    for (let tries = 1; tries <= 20; tries++) {
      const got = attempt(schema, run, o, rng, tries === 20);
      if (!got) continue;
      const sql = X.formatSql(got.sql) + ';';
      const res = run(got.sql);
      if (!res.ok) { errors++; continue; }
      if (res.rows.length || tries === 20) return { sql, features: got.features, tries, errors, rows: res.rows.length };
    }
    const t = schema.tables[0];
    return { sql: `SELECT *\nFROM ${ident(t.name)}\nLIMIT 10;`, features: [], tries: 21, errors, rows: Math.min(10, t.rows.length) };
  }

  const api = { FEATURES, FEATURE_LABELS, DEFAULT_OPTIONS, NEEDS, mulberry32, normalizeOptions, generateQuery };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/randomq.test.js`
Expected: PASS (4 tests, about 2 seconds; 5,000 queries across the 10 data sets).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/randomq.js tools/sql-studio/test/randomq.test.js
git commit -m "SQL Studio: add random query generator with feature toggles"
```

---

### Task 10: TSV, CSV, and homework text

**Files:**
- Create: `tools/sql-studio/src/export.js`
- Test: `tools/sql-studio/test/export.test.js`

**Interfaces:**
- Produces: `toTSV(result)`, `toCSV(result)`, `textTable(columns, rows)`, `homeworkText({ datasetLabel, exerciseLabel, question, sql, result })`, `homeworkFilename(label)`, `cleanLine(s)`, `PUBLIC_URL`, `HOMEWORK_ROWS = 20`.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/export.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../src/export.js');

const result = { ok: true, columns: ['name', 'total'], rows: [['Bad Bunny', 5950000], ['Say "hi", ok', 2.5], ['two\nlines', null]] };

test('TSV: tabs and newlines in cells become spaces, NULL is empty', () => {
  assert.equal(X.toTSV({ columns: ['a', 'b'], rows: [['x\ty', null], ['p\nq', 3]] }), 'a\tb\nx y\t\np q\t3\n');
});

test('CSV: quotes, commas, and newlines are quoted; CRLF line ends', () => {
  assert.equal(X.toCSV(result), 'name,total\r\nBad Bunny,5950000\r\n"Say ""hi"", ok",2.5\r\n"two\nlines",\r\n');
});

test('formula-looking text is made safe; negative numbers are not changed', () => {
  const r = { columns: ['v'], rows: [['=HYPERLINK("x")'], ['+1'], ['-dash'], ['@me'], [-5]] };
  assert.equal(X.toTSV(r), "v\n'=HYPERLINK(\"x\")\n'+1\n'-dash\n'@me\n-5\n");
  assert.equal(X.toCSV(r).split('\r\n')[1], '"\'=HYPERLINK(""x"")"');
  assert.equal(X.toCSV(r).split('\r\n')[5], '-5');
});

test('textTable pads columns and right-aligns numbers', () => {
  assert.equal(X.textTable(['artist_name', 'total'], [['Bad Bunny', 5950000], ['SZA', 1120000], ['X', null]]), [
    'artist_name | total',
    '------------+--------',
    'Bad Bunny   | 5950000',
    'SZA         | 1120000',
    'X           |    NULL',
  ].join('\n'));
});

test('homeworkText: header, SQL, result, and the 20-row cap', () => {
  const rows = Array.from({ length: 31 }, (_, i) => [`r${i}`, i]);
  const text = X.homeworkText({
    datasetLabel: '1. Spotify Streams', exerciseLabel: '1.1',
    question: 'How many [total]\nstreams?', sql: 'SELECT a, b\nFROM t;  ', result: { ok: true, columns: ['a', 'b'], rows },
  });
  const lines = text.split('\n');
  assert.equal(lines[0], 'SQL Studio — Exercise 1.1');
  assert.equal(lines[1], 'How many \\[total\\] streams?');
  assert.equal(lines[2], 'Data set: 1. Spotify Streams');
  assert.equal(lines[4], 'SQL:');
  assert.equal(lines[5], 'SELECT a, b');
  assert.equal(lines[6], 'FROM t;');
  assert.equal(lines[8], 'Result (31 rows × 2 columns):');
  assert.ok(text.includes('(showing 20 of 31 rows)'));
  assert.ok(text.includes('r19'));
  assert.ok(!text.includes('r20 '));
  assert.ok(text.trimEnd().endsWith(X.PUBLIC_URL));
});

test('homeworkText when the query did not run or had an error or no rows', () => {
  const base = { datasetLabel: 'd', exerciseLabel: '1.2', question: 'q', sql: 'SELECT 1' };
  assert.ok(X.homeworkText({ ...base, result: null }).includes('(this query did not run)'));
  assert.ok(X.homeworkText({ ...base, result: { ok: false, error: {} } }).includes('it has an error'));
  assert.ok(X.homeworkText({ ...base, result: { ok: true, columns: ['a'], rows: [] } }).includes('(no rows)'));
});

test('homeworkFilename', () => {
  assert.equal(X.homeworkFilename('1.3'), 'sql-studio-1.3.txt');
  assert.equal(X.homeworkFilename('my question?'), 'sql-studio-my-question-.txt');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/export.test.js`
Expected: FAIL with "Cannot find module '../src/export.js'".

- [ ] **Step 3: Implement `export.js`**

`tools/sql-studio/src/export.js`:

```js
// SQL Studio: results as TSV (for Copy), CSV (for Export), and plain text for "Copy for homework". No DOM.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const PUBLIC_URL = 'https://kalendar.github.io/relational-thinking/sql-studio.html';
  const HOMEWORK_ROWS = 20;

  // Text that starts like a formula would run in Excel; a leading ' makes it plain text. Numbers are never touched.
  const safeText = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const show = v => (v === null || v === undefined ? '' : String(v));

  function toTSV({ columns, rows }) {
    const cell = v => show(safeText(v)).replace(/[\t\r\n]+/g, ' ');
    return [columns.map(cell).join('\t'), ...rows.map(r => r.map(cell).join('\t'))].join('\n') + '\n';
  }

  function toCSV({ columns, rows }) {
    const cell = v => {
      const s = show(safeText(v));
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\r\n') + '\r\n';
  }

  // Same cleanup the Query Explorer uses for lines it copies: no newlines, no live [links].
  const cleanLine = s => String(s).replace(/\r?\n|\r/g, ' ').replace(/[[\]]/g, '\\$&');
  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

  // A simple monospace table: columns padded, numbers right-aligned, NULL spelled out.
  function textTable(columns, rows) {
    const text = v => (v === null || v === undefined ? 'NULL' : String(v).replace(/[\t\r\n]+/g, ' '));
    const isNum = columns.map((_, i) => rows.length > 0 && rows.every(r => r[i] === null || typeof r[i] === 'number'));
    const widths = columns.map((c, i) => Math.max(String(c).length, ...rows.map(r => text(r[i]).length)));
    const fmt = (vals, header) => vals.map((v, i) => (isNum[i] && !header ? text(v).padStart(widths[i]) : text(v).padEnd(widths[i]))).join(' | ').replace(/\s+$/, '');
    return [fmt(columns, true), widths.map(w => '-'.repeat(w)).join('-+-'), ...rows.map(r => fmt(r, false))].join('\n');
  }

  // result: a runQuery result, or null if the query has not run.
  function homeworkText({ datasetLabel, exerciseLabel, question, sql, result }) {
    const lines = [`SQL Studio — Exercise ${exerciseLabel}`, cleanLine(question), `Data set: ${cleanLine(datasetLabel)}`, '', 'SQL:', sql.trim(), ''];
    if (!result) lines.push('(this query did not run)');
    else if (!result.ok) lines.push('(this query did not run: it has an error)');
    else {
      const total = result.rows.length;
      lines.push(`Result (${plural(total, 'row', 'rows')} × ${plural(result.columns.length, 'column', 'columns')}):`);
      if (!total) lines.push('(no rows)');
      else {
        lines.push(textTable(result.columns, result.rows.slice(0, HOMEWORK_ROWS)));
        if (total > HOMEWORK_ROWS) lines.push(`(showing ${HOMEWORK_ROWS} of ${total.toLocaleString('en-US')} rows)`);
      }
    }
    lines.push('', `Made with SQL Studio: ${PUBLIC_URL}`, '');
    return lines.join('\n');
  }

  const homeworkFilename = exerciseLabel => `sql-studio-${String(exerciseLabel).replace(/[^\w.-]+/g, '-')}.txt`;

  const api = { PUBLIC_URL, HOMEWORK_ROWS, toTSV, toCSV, textTable, homeworkText, homeworkFilename, cleanLine };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/export.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/export.js tools/sql-studio/test/export.test.js
git commit -m "SQL Studio: add TSV/CSV export and homework text"
```

---

### Task 11: Parsing uploaded data

**Files:**
- Create: `tools/sql-studio/src/upload-parse.js`
- Test: `tools/sql-studio/test/upload-parse.test.js`

**Interfaces:**
- Consumes: `isKeyword`, `relationshipsOf`.
- Produces: `LIMITS = { maxBytes, maxTables, maxRows }`, `UploadError`, `parseCSV(text): string[][]`, `cleanColumnName(raw, usedSet)`, `cleanTableName(raw, usedSet)`, `inferColumn(values): { type, values }`, `buildUploadSchema(sheets, limits?): { schema, renamed: [{ table, from, to }] }` (schema shape as in File Structure, `id: 'upload'`, `number: 0`), `guessKeys(tables)`.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/upload-parse.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../src/upload-parse.js');
const D = require('../src/db.js');
const { getSQL } = require('./helpers.js');

test('parseCSV: quotes, doubled quotes, commas and newlines inside quotes, CRLF, BOM, blank lines', () => {
  const text = '﻿name,notes\r\n"Swift, Taylor","said ""hi""\nthen left"\r\n\r\nSZA,\n';
  assert.deepEqual(U.parseCSV(text), [['name', 'notes'], ['Swift, Taylor', 'said "hi"\nthen left'], ['SZA', '']]);
});

test('parseCSV: an unclosed quote is a clear error', () => {
  assert.throws(() => U.parseCSV('a,b\n"oops,1\n'), /never closed/);
});

test('cleanColumnName: snake_case, digits, keywords, duplicates', () => {
  const used = new Set();
  assert.equal(U.cleanColumnName('Order Date', used), 'order_date');
  assert.equal(U.cleanColumnName('2025 Sales', used), 'c_2025_sales');
  assert.equal(U.cleanColumnName('Group', used), 'group_col');
  assert.equal(U.cleanColumnName('order date', used), 'order_date_2');
  assert.equal(U.cleanColumnName('', used), 'column');
});

test('cleanTableName keeps case and drops the extension', () => {
  const used = new Set();
  assert.equal(U.cleanTableName('My Orders.csv', used), 'My_Orders');
  assert.equal(U.cleanTableName('my orders.xlsx', used), 'my_orders_2');
  assert.equal(U.cleanTableName('Order', used), 'Order_table');
});

test('inferColumn: numbers with commas, dates in two forms, text, empties', () => {
  assert.deepEqual(U.inferColumn(['1,200', '3.5', '', '-4']), { type: 'number', values: [1200, 3.5, null, -4] });
  assert.deepEqual(U.inferColumn(['2026-03-01', '3/9/2026', null]), { type: 'date', values: ['2026-03-01', '2026-03-09', null] });
  assert.deepEqual(U.inferColumn(['12', 'twelve']), { type: 'text', values: ['12', 'twelve'] });
  assert.deepEqual(U.inferColumn([new Date(2026, 0, 5)]), { type: 'date', values: ['2026-01-05'] });
  assert.equal(U.inferColumn(['', '']).type, 'text');
});

test('buildUploadSchema guesses keys and relationships, and loads into SQLite', async () => {
  const { schema, renamed } = U.buildUploadSchema([
    { name: 'Customers.csv', rows: [['customer_id', 'Full Name'], ['1', 'Ana'], ['2', 'Ben']] },
    { name: 'Orders.csv', rows: [['order_id', 'customer_id', 'Order Date', 'Total'], ['10', '1', '2026-03-01', '19.99'], ['11', '1', '2026-03-02', '5'], ['12', '2', '', '7.5']] },
  ]);
  assert.deepEqual(schema.tables.map(t => t.name), ['Customers', 'Orders']);
  const orders = schema.tables[1];
  assert.equal(orders.columns[0].pk, true);
  assert.deepEqual(orders.columns[1].fk, { table: 'Customers', column: 'customer_id' });
  assert.equal(orders.columns[2].type, 'date');
  assert.equal(orders.columns[3].sqlType, 'REAL');
  assert.deepEqual(schema.relationships, [{ from: { table: 'Orders', column: 'customer_id' }, to: { table: 'Customers', column: 'customer_id' } }]);
  assert.deepEqual(renamed.map(r => `${r.from}->${r.to}`), ['Full Name->full_name', 'Order Date->order_date', 'Total->total']);
  const st = D.openStudio(await getSQL(), schema);
  const r = D.runQuery(st, 'SELECT c.full_name, SUM(o.total) FROM Orders o JOIN Customers c ON c.customer_id = o.customer_id GROUP BY c.full_name');
  assert.deepEqual(r.rows, [['Ana', 24.99], ['Ben', 7.5]]);
  D.closeStudio(st);
});

test('"id" primary keys link from "<table>_id" columns, singular or plural', () => {
  const { schema } = U.buildUploadSchema([
    { name: 'Artists', rows: [['id', 'name'], [1, 'SZA'], [2, 'Drake']] },
    { name: 'Songs', rows: [['id', 'artist_id', 'title'], [1, 1, 'Saturn'], [2, 2, 'NOKIA']] },
  ]);
  assert.deepEqual(schema.relationships, [{ from: { table: 'Songs', column: 'artist_id' }, to: { table: 'Artists', column: 'id' } }]);
});

test('a column with repeated values is not a primary key', () => {
  const { schema } = U.buildUploadSchema([{ name: 'T', rows: [['team_id', 'x'], [1, 'a'], [1, 'b']] }]);
  assert.equal(schema.tables[0].columns[0].pk, false);
});

test('limits and bad shapes give plain messages', () => {
  assert.throws(() => U.buildUploadSchema([{ name: 'a', rows: [] }]), /couldn't find any data/);
  assert.throws(() => U.buildUploadSchema([{ name: 'a', rows: [['x'], [1, 2]] }]), /Row 2 in a has more values/);
  assert.throws(() => U.buildUploadSchema([{ name: 'a', rows: [['x'], [1], [2], [3]] }], { maxTables: 5, maxRows: 2 }), /up to 2 per table/);
  const many = Array.from({ length: 3 }, (_, i) => ({ name: `t${i}`, rows: [['x'], [1]] }));
  assert.throws(() => U.buildUploadSchema(many, { maxTables: 2, maxRows: 10 }), /up to 2\./);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tools/sql-studio/test/upload-parse.test.js`
Expected: FAIL with "Cannot find module '../src/upload-parse.js'".

- [ ] **Step 3: Implement `upload-parse.js`**

`tools/sql-studio/src/upload-parse.js`:

```js
// SQL Studio: turns uploaded CSV text or spreadsheet rows into a schema (same shape as schema.buildSchema). No DOM.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./schema.js')) : root.SS;

  const LIMITS = { maxBytes: 5 * 1024 * 1024, maxTables: 20, maxRows: 50000 };

  class UploadError extends Error {}

  // RFC 4180: quoted fields, "" escapes, commas/newlines inside quotes, CRLF, BOM. Drops blank lines.
  function parseCSV(text) {
    const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let i = 0;
    const endField = () => { row.push(field); field = ''; };
    const endRow = () => { endField(); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; };
    while (i < s.length) {
      const c = s[i];
      if (quoted) {
        if (c === '"' && s[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { quoted = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { quoted = true; i++; continue; }
      if (c === ',') { endField(); i++; continue; }
      if (c === '\r' && s[i + 1] === '\n') { endRow(); i += 2; continue; }
      if (c === '\n' || c === '\r') { endRow(); i++; continue; }
      field += c; i++;
    }
    if (quoted) throw new UploadError('This file has a quote (") that is never closed.');
    if (field !== '' || row.length) endRow();
    return rows;
  }

  function cleanColumnName(raw, used) {
    let n = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = 'column';
    if (/^[0-9]/.test(n)) n = `c_${n}`;
    if (X.isKeyword(n)) n = `${n}_col`;
    return unique(n, used);
  }

  function cleanTableName(raw, used) {
    let n = String(raw || '').replace(/\.(csv|xlsx|xls)$/i, '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = 'Table';
    if (/^[0-9]/.test(n)) n = `T_${n}`;
    if (X.isKeyword(n)) n = `${n}_table`;
    return unique(n, used);
  }

  function unique(n, used) {
    let name = n;
    let k = 2;
    while (used.has(name.toLowerCase())) name = `${n}_${k++}`;
    used.add(name.toLowerCase());
    return name;
  }

  const NUM = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const pad = n => String(n).padStart(2, '0');
  const isoOfDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const empty = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  function inferColumn(values) {
    const present = values.filter(v => !empty(v));
    const asNumber = v => (typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, '')));
    if (present.length && present.every(v => typeof v === 'number' || (typeof v === 'string' && NUM.test(v.trim()) && /\d/.test(v)))) {
      return { type: 'number', values: values.map(v => (empty(v) ? null : asNumber(v))) };
    }
    const toDate = v => {
      if (v instanceof Date && !isNaN(v)) return isoOfDate(v);
      const s = String(v).trim();
      if (ISO.test(s)) return s;
      const m = US.exec(s);
      return m ? `${m[3]}-${pad(m[1])}-${pad(m[2])}` : null;
    };
    if (present.length && present.every(v => toDate(v) !== null)) return { type: 'date', values: values.map(v => (empty(v) ? null : toDate(v))) };
    return { type: 'text', values: values.map(v => (empty(v) ? null : v instanceof Date ? isoOfDate(v) : String(v))) };
  }

  // sheets: [{ name, rows: any[][] }] where rows[0] is the header.
  function buildUploadSchema(sheets, limits = LIMITS) {
    const usable = sheets.filter(s => s.rows.length && s.rows[0].some(h => !empty(h)));
    if (!usable.length) throw new UploadError("We couldn't find any data. The first row should hold the column names.");
    if (usable.length > limits.maxTables) throw new UploadError(`That's ${usable.length} tables. SQL Studio can load up to ${limits.maxTables}.`);
    const usedTables = new Set();
    const renamed = [];
    const tables = usable.map(sheet => {
      const name = cleanTableName(sheet.name, usedTables);
      const header = sheet.rows[0];
      const body = sheet.rows.slice(1);
      if (body.length > limits.maxRows) throw new UploadError(`${name} has ${body.length.toLocaleString('en-US')} rows. SQL Studio can load up to ${limits.maxRows.toLocaleString('en-US')} per table.`);
      body.forEach((r, k) => {
        if (r.length > header.length && r.slice(header.length).some(v => !empty(v))) {
          throw new UploadError(`Row ${k + 2} in ${name} has more values than there are column names.`);
        }
      });
      const usedCols = new Set();
      const columns = header.map((raw, i) => {
        const clean = cleanColumnName(raw, usedCols);
        if (String(raw).trim() !== clean) renamed.push({ table: name, from: String(raw === null || raw === undefined ? '' : raw).trim(), to: clean });
        const inferred = inferColumn(body.map(r => r[i]));
        return { name: clean, type: inferred.type, values: inferred.values };
      });
      const rows = body.map((_, k) => columns.map(c => c.values[k]));
      return {
        name,
        columns: columns.map(c => ({ name: c.name, type: c.type, sqlType: c.type === 'number' ? (c.values.every(v => v === null || Number.isInteger(v)) ? 'INTEGER' : 'REAL') : 'TEXT', pk: false, fk: null })),
        rows,
      };
    });
    guessKeys(tables);
    return {
      schema: { id: 'upload', number: 0, name: 'Your data', description: tables.map(t => t.name).join(' · '), tables, relationships: X.relationshipsOf(tables) },
      renamed,
    };
  }

  const singular = s => s.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');

  // Primary key: first "id" or "<x>_id" column with unique, non-empty values.
  // Foreign key: "<x>_id" in another table, pointing at the table whose primary key is "<x>_id",
  // or at a table named like <x> (singular or plural) whose primary key is "id".
  function guessKeys(tables) {
    for (const t of tables) {
      const pk = t.columns.findIndex((c, i) => (c.name === 'id' || /_id$/.test(c.name)) && t.rows.length > 0
        && t.rows.every(r => r[i] !== null) && new Set(t.rows.map(r => r[i])).size === t.rows.length);
      if (pk !== -1) t.columns[pk].pk = true;
    }
    for (const t of tables) {
      for (const c of t.columns) {
        if (c.pk || !/_id$/.test(c.name)) continue;
        const stem = c.name.slice(0, -3);
        const target = tables.find(o => o !== t && o.columns.some(oc => oc.pk && oc.name === c.name))
          || tables.find(o => o !== t && singular(o.name) === singular(stem) && o.columns.some(oc => oc.pk && oc.name === 'id'));
        if (!target) continue;
        const pkCol = target.columns.find(oc => oc.pk);
        if (pkCol.type !== c.type) continue;
        c.fk = { table: target.name, column: pkCol.name };
      }
    }
    return tables;
  }

  const api = { LIMITS, UploadError, parseCSV, cleanColumnName, cleanTableName, inferColumn, buildUploadSchema, guessKeys };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/upload-parse.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/sql-studio/src/upload-parse.js tools/sql-studio/test/upload-parse.test.js
git commit -m "SQL Studio: parse uploaded CSV/sheet data and guess keys"
```

---

### Task 12: Page shell, styles, DOM helpers, icons, and the build

**Files:**
- Create: `tools/sql-studio/build.js`, `tools/sql-studio/src/index.html`, `tools/sql-studio/src/styles.css`, `tools/sql-studio/src/dom.js`, `tools/sql-studio/src/icons.js`
- Test: `tools/sql-studio/test/build.test.js`

**Interfaces:**
- Consumes: all vendored files (Task 1).
- Produces:
  - `build(): string` (the output path), with `SCRIPT_ORDER`, `VENDOR_JS`, and `DATASETS` exported.
  - Globals: `window.SS_WASM_BASE64`, `window.QE_DATASETS` (pushed by each data set file), `window.initSqlJs`, `window.CodeMirror`, `window.XLSX`.
  - `dom.js`: `SS.h(tag, attrs, ...children)`, `SS.s(...)` (SVG), `SS.clear(el)`, `SS.rich(str)` (backticks → `<code>`), `SS.plain(str)`, `SS.announce(text)` (the `#live` region), `SS.copyText(text): Promise<'copied'|'failed'>`, `SS.downloadBlob(name, blob)`, `SS.downloadText(name, text, type)`, `SS.isMac`, `SS.modKey`, `SS.reducedMotion()`, `SS.popover(button, panel, { onOpen }): { wrap, close }`.
  - `icons.js`: `SS.ICON_PATHS`, `SS.icon(name, { label })`, `SS.iconButton(name, label, attrs)`.

**Notes:**
- Each vendored file and each source file goes in its **own** `<script>` tag. That way, a top-level `var` in one library can't collide with another file's code.
- The build skips `SCRIPT_ORDER` files that don't exist yet. This lets the build test pass at every task, and the "every file exists" test turns on once `app.js` exists (Task 19).
- `styles.css` starts with the Query Explorer's token block **pasted unchanged**, and a test checks this. SQL Studio's own extra tokens (`--surface` for the white cards, `--grid` for the ERD dots, and `--code-*` for syntax colors) sit in a separate block below it, with the same three-way dark mode.

- [ ] **Step 1: Write the failing build test**

`tools/sql-studio/test/build.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, OUT, SCRIPT_ORDER, DATASETS } = require('../build.js');
const { ROOT } = require('./helpers.js');

const html = fs.readFileSync(build(), 'utf8');

test('build writes one file to dist/sql-studio.html', () => {
  assert.equal(OUT, path.join(ROOT, 'dist', 'sql-studio.html'));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.length > 1_000_000, 'includes the vendored libraries and wasm');
});

test('every src/*.js file is in the load order', () => {
  const listed = SCRIPT_ORDER.filter(f => f !== 'DATASETS');
  for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(n => n.endsWith('.js'))) assert.ok(listed.includes(f), `${f} is missing from SCRIPT_ORDER`);
});

const appDone = fs.existsSync(path.join(ROOT, 'src', 'app.js'));
test('every file in the load order exists', { skip: !appDone && 'app.js arrives in Task 19' }, () => {
  for (const f of SCRIPT_ORDER.filter(n => n !== 'DATASETS')) assert.ok(fs.existsSync(path.join(ROOT, 'src', f)), f);
});

test('data sets are read in place from the Query Explorer, one per file', () => {
  const files = fs.readdirSync(DATASETS).filter(f => f.endsWith('.js'));
  assert.equal(files.length, 10);
  for (const f of files) assert.ok(html.includes(`// ---- ../query-explorer/src/datasets/${f} ----`), f);
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'datasets')), false, 'no copied data sets');
});

test('the wasm is inlined as base64', () => {
  const wasm = fs.readFileSync(path.join(ROOT, 'vendor', 'sql.js', 'sql-wasm.wasm')).toString('base64');
  assert.ok(html.includes(`window.SS_WASM_BASE64 = "${wasm}";`));
});

test('the only outside URLs are Google Fonts and the published page', () => {
  const loads = [...html.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(loads.map(u => new URL(u).host), ['fonts.googleapis.com']);
  assert.ok(!/\bfetch\(\s*['"]https?:/.test(html));
});

test('the color tokens are exactly the Query Explorer ones', () => {
  const qe = fs.readFileSync(path.join(ROOT, '..', 'query-explorer', 'src', 'styles.css'), 'utf8');
  const tokens = qe.slice(0, qe.indexOf('*{box-sizing'));
  const ours = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8');
  assert.ok(ours.includes(tokens.trim()), 'paste the Query Explorer :root token block unchanged at the top of styles.css');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tools/sql-studio/test/build.test.js`
Expected: FAIL with "Cannot find module '../build.js'".

- [ ] **Step 3: Write `build.js`**

`tools/sql-studio/build.js`:

```js
// Combines vendor/, the Query Explorer data sets, and src/ into one self-contained file: dist/sql-studio.html
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const VENDOR = path.join(ROOT, 'vendor');
const DATASETS = path.join(ROOT, '..', 'query-explorer', 'src', 'datasets');
const OUT = path.join(ROOT, 'dist', 'sql-studio.html');

const VENDOR_CSS = ['codemirror/codemirror.css', 'codemirror/show-hint.css'];
const VENDOR_JS = ['codemirror/codemirror.js', 'codemirror/mode-sql.js', 'codemirror/show-hint.js', 'codemirror/sql-hint.js',
  'codemirror/active-line.js', 'codemirror/matchbrackets.js', 'sql.js/sql-wasm.js', 'sheetjs/xlsx.mini.min.js'];

// Load order matters: each file reads what earlier files put on window.SS.
const SCRIPT_ORDER = ['sql-text.js', 'schema.js', 'db.js', 'errors.js', 'format.js', 'check.js', 'exercises.js', 'randomq.js',
  'export.js', 'upload-parse.js', 'prefs.js', 'sessions.js', 'erd-model.js', 'DATASETS',
  'dom.js', 'icons.js', 'layout.js', 'editor.js', 'results-view.js', 'exercises-view.js', 'export-dialog.js',
  'random-ui.js', 'erd.js', 'data-view.js', 'upload.js', 'app.js'];

function datasetFiles() {
  return fs.readdirSync(DATASETS).filter(f => f.endsWith('.js')).sort().map(f => path.join(DATASETS, f));
}

const read = p => fs.readFileSync(p, 'utf8');
const label = p => path.relative(ROOT, p);

function build() {
  const vendorJs = VENDOR_JS.map(f => `// ---- vendor/${f} ----\n${read(path.join(VENDOR, f))}`);
  const wasm = fs.readFileSync(path.join(VENDOR, 'sql.js', 'sql-wasm.wasm')).toString('base64');
  // Files not written yet (the DOM files arrive over Tasks 12–19) are skipped, so the build works at every step.
  const ours = SCRIPT_ORDER.flatMap(f => (f === 'DATASETS' ? datasetFiles() : [path.join(SRC, f)]))
    .filter(p => fs.existsSync(p))
    .map(p => `// ---- ${label(p)} ----\n${read(p)}`);
  // Each part is its own <script>, so one file's top-level names can't clash with another's strict-mode code.
  const scripts = [...vendorJs, `window.SS_WASM_BASE64 = "${wasm}";`, ...ours];
  for (const s of scripts) if (/<\/script/i.test(s)) throw new Error('A script contains "</script", which would break the page.');
  const css = [...VENDOR_CSS.map(f => read(path.join(VENDOR, f))), read(path.join(SRC, 'styles.css'))].join('\n');
  const html = read(path.join(SRC, 'index.html'))
    .replace('/* INLINE_CSS */', () => css)
    .replace('<!-- INLINE_JS -->', () => scripts.map(s => `<script>\n${s}\n</script>`).join('\n'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return OUT;
}

if (require.main === module) {
  const out = build();
  console.log(`Built ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
}
module.exports = { build, OUT, SCRIPT_ORDER, VENDOR_JS, DATASETS };
```

- [ ] **Step 4: Write `src/index.html`**

`tools/sql-studio/src/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SQL Studio</title>
<meta name="description" content="Write real SQL against ten practice data sets. Goes with Chapter 8 of Relational Thinking.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Nunito+Sans:wght@300;400;600;700;800&display=swap">
<style>
/* INLINE_CSS */
</style>
</head>
<body>
<div id="app" class="booting"><p class="boot-note">Loading SQL Studio…</p></div>
<div id="live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<noscript>SQL Studio needs JavaScript turned on.</noscript>
<!-- INLINE_JS -->
</body>
</html>
```

- [ ] **Step 5: Write `src/styles.css`**

The first 40 lines are copied from `tools/query-explorer/src/styles.css`, from the start of the file up to the line before `*{box-sizing:border-box;}`. Copy them with `awk '/^\*\{box-sizing/{exit} {print}' tools/query-explorer/src/styles.css > tools/sql-studio/src/styles.css`, then append the rest:

```css
/* … the Query Explorer token block (40 lines), unchanged … */

/* SQL Studio additions (not part of the shared tokens above) */
:root{ --surface:#ffffff; --grid:#e9e5dc; --code-kw:#0c5850; --code-str:#7a4600; --code-num:#37395f; --code-com:#6f6357; --code-fn:#7a374a; }
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --surface:#1d1f22; --grid:#2c2f34; --code-kw:#8fe3d6; --code-str:#f0bd6f; --code-num:#b6b8ec; --code-com:#a8a296; --code-fn:#eeb0bf; }
}
:root[data-theme="dark"]{ --surface:#1d1f22; --grid:#2c2f34; --code-kw:#8fe3d6; --code-str:#f0bd6f; --code-num:#b6b8ec; --code-com:#a8a296; --code-fn:#eeb0bf; }

*{box-sizing:border-box;}
html,body{height:100%;}
body{margin:0; background:var(--bg); color:var(--body); font-family:'Nunito Sans',system-ui,sans-serif; font-size:15px; line-height:1.45;}
h1,h2,h3{font-family:'Montserrat',system-ui,sans-serif; color:var(--ink); margin:0;}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
code{font-size:.9em; background:var(--card-2); color:var(--ink); padding:.05em .35em; border-radius:4px;}
button,select,input{font:inherit; color:inherit;}
:focus-visible{outline:3px solid var(--indigo); outline-offset:2px;}
svg :focus-visible, svg :focus{outline:none;}
[hidden]{display:none !important;}
.sr-only{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap;}
.boot-note{padding:40px; color:var(--muted);}
.icon{width:16px; height:16px; flex:none; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;}

/* buttons: outlined; only .primary is filled */
.btn{display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:var(--surface); color:var(--ink); border-radius:8px; padding:5px 10px; cursor:pointer; font-weight:600; font-size:.88rem; white-space:nowrap;}
.btn:hover{background:var(--card-2);}
.btn.primary{background:var(--teal); border-color:var(--teal); color:var(--on-teal);}
.btn.primary:hover{filter:brightness(1.07);}
.btn:disabled{opacity:.45; cursor:not-allowed;}
.btn.icon-only{padding:5px 7px;}
.btn[aria-pressed="true"]{background:var(--teal-soft); border-color:var(--teal); color:var(--teal-ink);}
.btn-link{background:none; border:0; padding:2px 4px; cursor:pointer; color:var(--teal-ink); text-decoration:underline; font-weight:600;}
.check-label{display:inline-flex; align-items:center; gap:6px; font-size:.88rem; cursor:pointer;}
input[type=checkbox]{accent-color:var(--teal); width:16px; height:16px;}
select{background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:5px 8px;}

/* app shell */
.app{display:flex; flex-direction:column; gap:10px; padding:12px 16px 24px; max-width:1800px; margin:0 auto;}
.top{display:flex; flex-wrap:wrap; align-items:center; gap:10px 20px;}
.brand{display:flex; align-items:center; gap:10px;}
.brand .logo{width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:var(--teal-soft); color:var(--teal-ink);}
.brand .logo .icon{width:20px; height:20px;}
.brand h1{font-weight:600; font-size:1.25rem; letter-spacing:-.01em;}
.brand .sub{margin:0; font-size:.8rem; color:var(--muted);}
.picker-wrap{margin-left:auto; display:flex; flex-direction:column; align-items:flex-end; gap:2px;}
.picker-row{display:flex; align-items:center; gap:8px;}
.picker-row label{font-family:'Montserrat',sans-serif; font-weight:600; font-size:.7rem; text-transform:uppercase; letter-spacing:.12em; color:var(--muted);}
select.picker{background:var(--teal); border-color:var(--teal); color:var(--on-teal); font-weight:700; padding:6px 10px;}
select.picker option{background:var(--surface); color:var(--ink);}
.picker-desc{margin:0; font-size:.82rem; color:var(--muted);}
.footnote{margin:6px 0 0; color:var(--muted); font-size:.8rem; text-align:center;}

/* panels */
.panel{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden;}
.panel-head{display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:7px 10px; border-bottom:1px solid var(--line);}
.panel.collapsed .panel-head{border-bottom:0;}
.panel.collapsed .panel-body{display:none;}
.panel-title{display:flex; align-items:center; gap:6px; font-family:'Montserrat',sans-serif; font-weight:700; color:var(--ink); font-size:.92rem;}
.chev{border:0; background:none; padding:2px; border-radius:6px; cursor:pointer; color:var(--muted); display:grid; place-items:center;}
.chev .icon{transition:transform .15s;}
.panel.collapsed .chev .icon{transform:rotate(-90deg);}
.panel-tools{display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-left:auto;}
.zoom{display:inline-flex; align-items:center; gap:2px;}
.zoom output{min-width:3.4em; text-align:center; font-size:.8rem; color:var(--muted); font-variant-numeric:tabular-nums;}
.panel-body{flex:1; min-height:0; overflow:auto; font-size:calc(var(--zoom, 100) * 1% );}
.hint-text{font-size:.82rem; color:var(--muted); display:flex; align-items:center; gap:4px;}

/* layout.js sets grid-template-rows / -columns from the saved sizes and collapsed panels */
.workspace{display:grid; min-width:0;}
.toprow{display:grid; min-height:0; min-width:0;}
.panel.collapsed .panel-tools,.panel.collapsed .hint-text{display:none;}
.ex-strip.collapsed .panel-tools{display:flex;}
.splitter{background:transparent; position:relative; touch-action:none;}
.splitter::after{content:''; position:absolute; border-radius:2px; background:var(--line);}
.splitter.v{cursor:col-resize;}
.splitter.v::after{top:30%; bottom:30%; left:4px; width:2px;}
.splitter.h{cursor:row-resize;}
.splitter.h::after{left:45%; right:45%; top:4px; height:2px;}
.splitter:hover::after,.splitter:focus-visible::after,.splitter.dragging::after{background:var(--teal);}

/* exercises strip */
.ex-strip .panel-head{gap:6px 12px;}
.ex-current{display:flex; align-items:center; gap:8px; min-width:0; flex:1;}
.ex-current .text{white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ex-num{font-family:'Montserrat',sans-serif; font-weight:700; color:var(--teal-ink);}
.ex-list{list-style:none; margin:0; padding:8px 14px 12px; display:flex; flex-direction:column; gap:10px;}
.ex-item{padding:8px 10px; border-radius:10px; border:1px solid transparent;}
.ex-item.current{border-color:var(--teal); background:var(--teal-soft);}
.ex-item .q{display:flex; gap:8px; align-items:baseline;}
.ex-item .note{margin:2px 0 0 2.6em; font-style:italic; color:var(--muted);}
.ex-actions{display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 0 2.6em;}
.ex-hint{margin:6px 0 0 2.6em; padding:7px 10px; background:var(--teal-soft); border-left:4px solid var(--teal); border-radius:6px;}
.ex-feedback{margin:6px 0 0 2.6em; padding:7px 10px; border-radius:6px; background:var(--warn-soft); color:var(--amber-ink);}
.ex-feedback.ok{background:var(--good-soft); color:var(--good);}
.ex-empty{padding:10px 14px; margin:0;}

/* SQL panel */
.sql-panel .panel-body{display:flex; flex-direction:column;}
.run-row{display:flex; justify-content:flex-end; align-items:center; gap:12px; padding:6px 10px; border-bottom:1px solid var(--line);}
.editor-host{flex:1; min-height:120px; position:relative;}
.editor-host .CodeMirror{position:absolute; inset:0; height:auto; font-size:1em; background:var(--surface); color:var(--ink); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.CodeMirror-gutters{background:var(--card); border-right:1px solid var(--line);}
.CodeMirror-linenumber{color:var(--muted);}
.CodeMirror-cursor{border-left-color:var(--ink);}
.CodeMirror-activeline-background{background:var(--card);}
.CodeMirror-selected,.CodeMirror-focused .CodeMirror-selected{background:var(--indigo-soft);}
.cm-s-studio .cm-keyword{color:var(--code-kw); font-weight:700;}
.cm-s-studio .cm-string{color:var(--code-str);}
.cm-s-studio .cm-number{color:var(--code-num);}
.cm-s-studio .cm-comment{color:var(--code-com); font-style:italic;}
.cm-s-studio .cm-builtin,.cm-s-studio .cm-variable-2{color:var(--code-fn);}
.cm-s-studio .cm-operator{color:var(--ink);}
.cm-error-mark{text-decoration:underline wavy var(--bad); text-decoration-skip-ink:none; background:var(--bad-soft);}
.cm-ran{background:var(--teal-soft); transition:background-color 1s;}
.err-gutter{width:10px;}
.err-dot{width:8px; height:8px; border-radius:50%; background:var(--bad); margin:5px 0 0 1px;}
.CodeMirror-hints{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; background:var(--surface); border:1px solid var(--line); z-index:40;}
.CodeMirror-hint{color:var(--ink);}
li.CodeMirror-hint-active{background:var(--teal); color:var(--on-teal);}

/* popovers */
.pop-wrap{position:relative; display:inline-flex;}
.popover{position:absolute; top:calc(100% + 6px); left:0; z-index:30; min-width:240px; background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.18); padding:10px 12px; display:flex; flex-direction:column; gap:6px;}
.popover[hidden]{display:none;}
.popover h3{font-size:.8rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted);}
.popover .added{font-size:.8rem; color:var(--teal-ink); margin:0;}

/* results */
.results-panel .panel-body{display:flex; flex-direction:column;}
.res-bar{display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:6px 10px; border-bottom:1px solid var(--line);}
.res-count{font-family:'Montserrat',sans-serif; color:var(--muted); font-size:.88em;}
.res-count strong{color:var(--ink);}
.res-bar .spacer{flex:1;}
.res-body{flex:1; min-height:0; overflow:auto; padding:10px;}
.empty-box{border:2px dashed var(--line); border-radius:12px; padding:28px 16px; text-align:center; color:var(--muted);}
.err-box{border:1px solid var(--bad); border-left:6px solid var(--bad); background:var(--bad-soft); color:var(--ink); border-radius:10px; padding:10px 12px; margin-bottom:10px;}
.err-box .headline{margin:0; font-weight:700;}
.err-box .where{margin:4px 0 0;}
.err-box details{margin-top:6px; font-size:.85em; color:var(--muted);}
.note-box{border-radius:10px; padding:8px 12px; background:var(--warn-soft); color:var(--amber-ink); margin-bottom:10px;}
table.data{border-collapse:collapse; width:max-content; min-width:100%; font-size:.92em;}
table.data caption{text-align:left;}
table.data th{position:sticky; top:0; z-index:1; background:var(--card-2); color:var(--ink); text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); white-space:nowrap; font-weight:700;}
table.data td{padding:5px 10px; border-bottom:1px solid var(--line); white-space:nowrap;}
table.data .num{text-align:right; font-variant-numeric:tabular-nums;}
table.data .null{color:var(--muted); font-style:italic;}
table.data th.num .th-inner{justify-content:flex-end;}
.th-inner{display:flex; align-items:center; gap:4px;}
th.num .popover{left:auto; right:0;}
.col-opts{opacity:0; border:1px solid var(--line); background:var(--surface); border-radius:6px; padding:0 5px; line-height:1.2; cursor:pointer;}
th:hover .col-opts, th:focus-within .col-opts, .col-opts[aria-expanded="true"]{opacity:1;}
.pager{display:flex; align-items:center; justify-content:center; gap:10px; padding:8px; border-top:1px solid var(--line); font-size:.88em;}

/* ERD */
.erd-panel .panel-body{position:relative; overflow:hidden;}
.erd-canvas{position:absolute; inset:0; touch-action:none; cursor:grab; background-color:var(--surface);
  background-image:radial-gradient(var(--grid) 1.2px, transparent 1.2px); background-size:18px 18px;}
.erd-canvas.panning{cursor:grabbing;}
.erd-canvas svg{width:100%; height:100%; display:block;}
.erd-table rect.box{fill:var(--surface); stroke:var(--line); stroke-width:1.2;}
.erd-table rect.head{fill:var(--card-2);}
.erd-table:focus rect.box,.erd-table.dragging rect.box{stroke:var(--indigo); stroke-width:3;}
.erd-table text{fill:var(--body); font-size:12.5px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.erd-table text.tname{fill:var(--ink); font-family:'Montserrat',system-ui,sans-serif; font-weight:700; font-size:13.5px;}
.erd-table text.ctype{fill:var(--muted); font-size:11px;}
.erd-table text.badge-pk{fill:var(--amber-ink); font-weight:700; font-size:10.5px;}
.erd-table text.badge-fk{fill:var(--indigo-ink); font-weight:700; font-size:10.5px;}
.erd-table .tbtn{cursor:pointer;}
.erd-table .tbtn rect{fill:transparent;}
.erd-table .tbtn:hover rect,.erd-table .tbtn:focus rect{fill:var(--card);}
.erd-table .tbtn:focus rect{stroke:var(--indigo); stroke-width:2;}
.erd-table .tbtn path{stroke:var(--muted); fill:none; stroke-width:1.6;}
.erd-table .col-row rect{fill:transparent;}
.erd-table .col-row.linkable{cursor:crosshair;}
.erd-table .col-row.target rect{fill:var(--teal-soft);}
.erd-link path.line{fill:none; stroke:var(--muted); stroke-width:1.6;}
.erd-link line,.erd-link circle{stroke:var(--muted); stroke-width:1.6; fill:var(--surface);}
.erd-link path.hit{fill:none; stroke:transparent; stroke-width:12;}
.erd-link:focus path.line,.erd-link.selected path.line{stroke:var(--indigo); stroke-width:3;}
.erd-link.editing{cursor:pointer;}
.erd-ghost{stroke:var(--teal); stroke-width:2; stroke-dasharray:5 4; fill:none;}
.erd-chips{position:absolute; left:10px; bottom:10px; display:flex; flex-wrap:wrap; gap:6px; z-index:2;}
.chip{display:inline-flex; align-items:center; gap:4px; border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:2px 6px 2px 10px; font-size:.82rem;}
.erd-links-form{position:absolute; right:10px; top:10px; z-index:2; width:min(360px, calc(100% - 20px)); max-height:calc(100% - 20px); overflow:auto; background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:10px 12px; box-shadow:0 6px 18px rgba(0,0,0,.12); font-size:.88rem;}
.erd-links-form ul{list-style:none; padding:0; margin:6px 0; display:flex; flex-direction:column; gap:4px;}
.erd-links-form li{display:flex; align-items:center; justify-content:space-between; gap:6px;}
.erd-links-form .row{display:flex; flex-wrap:wrap; align-items:center; gap:6px;}
.erd-note{position:absolute; left:10px; top:10px; z-index:2; max-width:60%; font-size:.82rem; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:6px 10px;}

/* data preview */
.tabs{display:flex; flex-wrap:wrap; gap:6px;}
.tab{border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:3px 12px; cursor:pointer; font-size:.88rem;}
.tab[aria-selected="true"]{background:var(--ink); color:var(--bg); border-color:var(--ink);}
.data-body{padding:10px;}
.data-count{margin:0 0 8px; color:var(--muted); font-size:.88em;}

/* dialogs (Copy for homework), same pattern as the Query Explorer */
.modal-backdrop{position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(18,20,23,.3);}
.modal{width:100%; max-width:640px; max-height:85vh; overflow:auto; background:var(--bg); color:var(--body); border:1px solid var(--line); border-top:5px solid var(--teal); border-radius:var(--radius); box-shadow:0 10px 30px rgba(0,0,0,.25); padding:16px 20px 18px;}
.modal h2{font-size:1.05rem; font-weight:700;}
.modal-body{margin:8px 0 12px;}
.modal-actions{display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px;}
.hw-label{display:block; font-weight:700; color:var(--ink); margin-bottom:6px;}
.modal select,.modal input[type=text]{width:100%; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:6px 10px;}
.hw-small{margin:12px 0 4px; font-size:.78rem; text-transform:uppercase; letter-spacing:.12em; color:var(--muted);}
.hw-preview{margin:0 0 14px; max-height:34vh; overflow:auto; padding:10px 12px; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:8px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.78rem; white-space:pre; }
.hw-status{margin:10px 0 0; min-height:1.5em; color:var(--good); font-weight:700;}

/* narrow screens: stack in the order Exercises, SQL, Results, ERD, Data */
@media (max-width:759px){
  .app{padding:10px 10px 20px;}
  .picker-wrap{margin-left:0; align-items:flex-start;}
  .workspace{display:flex; flex-direction:column; gap:10px;}
  .toprow{display:flex; flex-direction:column; gap:10px;}
  .splitter{display:none;}
  .sql-panel .panel-body{min-height:260px;}
  .results-panel .panel-body{max-height:70vh;}
  .erd-panel .panel-body{height:360px; flex:none;}
  .data-panel .panel-body{max-height:60vh;}
}

@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{transition:none !important; animation:none !important; scroll-behavior:auto !important;}
}
```

- [ ] **Step 6: Write `src/dom.js` and `src/icons.js`**

`tools/sql-studio/src/dom.js`:

```js
// SQL Studio: small DOM helpers. Never uses innerHTML.
(function (root) {
  'use strict';
  const SS = root.SS;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function setAttrs(el, attrs) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }

  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : String(c));
    }
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    setAttrs(el, attrs);
    append(el, children);
    return el;
  }

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    setAttrs(el, attrs);
    append(el, children);
    return el;
  }

  const clear = el => { while (el.firstChild) el.firstChild.remove(); return el; };

  // `code` in backticks becomes <code>; everything else is plain text.
  function rich(str) {
    const out = [];
    const re = /`([^`]+)`/g;
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(h('code', null, m[1]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }
  const plain = str => String(str).replace(/`([^`]+)`/g, '$1');

  // One polite live region for the whole page (index.html has <div id="live">).
  let liveTimer = null;
  function announce(text) {
    const live = document.getElementById('live');
    if (!live) return;
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = plain(text); }, 30);
  }

  // Returns 'copied' or 'failed'. Plain text only.
  async function copyText(text) {
    try {
      await root.navigator.clipboard.writeText(text);
      return 'copied';
    } catch (e) {
      // Older or locked-down browsers: a hidden textarea and execCommand.
      try {
        const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' }, 'aria-hidden': 'true' });
        ta.value = text;
        document.body.append(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok ? 'copied' : 'failed';
      } catch (e2) {
        return 'failed';
      }
    }
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const downloadText = (filename, text, type = 'text/plain') => downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));

  const isMac = /Mac|iPhone|iPad/.test((root.navigator && (root.navigator.platform || root.navigator.userAgent)) || '');
  const modKey = isMac ? '⌘' : 'Ctrl';
  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // A disclosure popover: a button that shows/hides a panel. Escape or a click outside closes it and returns focus.
  function popover(button, panel, { onOpen } = {}) {
    const wrap = h('span', { class: 'pop-wrap' }, button, panel);
    const id = panel.id || `pop-${Math.random().toString(36).slice(2, 8)}`;
    panel.id = id;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);
    const close = (refocus = true) => {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      if (refocus) button.focus();
    };
    const outside = e => { if (!wrap.contains(e.target)) close(false); };
    button.addEventListener('click', () => {
      if (!panel.hidden) { close(); return; }
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outside, true);
      if (onOpen) onOpen();
      const first = panel.querySelector('input,button,select,[tabindex]');
      if (first) first.focus();
    });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); } });
    return { wrap, close };
  }

  root.SS = Object.assign(SS, { h, s, clear, rich, plain, announce, copyText, downloadBlob, downloadText, isMac, modKey, reducedMotion, popover });
})(this);
```

`tools/sql-studio/src/icons.js`:

```js
// SQL Studio: simple line icons as inline SVG (24×24, stroke = currentColor).
(function (root) {
  'use strict';
  const SS = root.SS;

  const PATHS = {
    db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    chevron: 'M6 9l6 6 6-6',
    play: 'M7 4l13 8-13 8z',
    wand: 'M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3 1.3.7-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z',
    dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
    sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
    copy: 'M9 9h10v12H9zM5 15H4V3h12v1',
    download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
    key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z',
    link: 'M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6l-1.5 1.5M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6l1.5-1.5',
    image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    check: 'M5 12l5 5 9-10',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
    table: 'M3 4h18v16H3zM3 10h18M9 10v10',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1',
    x: 'M6 6l12 12M18 6L6 18',
    tidy: 'M4 5h6v5H4zM14 14h6v5h-6zM10 7.5h2a2 2 0 0 1 2 2v7',
    prev: 'M15 6l-6 6 6 6',
    next: 'M9 6l6 6-6 6',
    results: 'M4 5h16M4 10h16M4 15h10M4 20h7',
    homework: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  };

  function icon(name, { label } = {}) {
    const svg = SS.s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null },
      SS.s('path', { d: PATHS[name] || PATHS.info }));
    return svg;
  }

  // An icon-only button with a visible tooltip (title) and an accessible name.
  const iconButton = (name, label, attrs = {}) => SS.h('button', Object.assign({ type: 'button', class: 'btn icon-only', 'aria-label': label, title: label }, attrs), icon(name));

  root.SS = Object.assign(SS, { ICON_PATHS: PATHS, icon, iconButton });
})(this);
```

- [ ] **Step 7: Build and run the tests**

Run: `node tools/sql-studio/build.js && node --test tools/sql-studio/test/build.test.js`
Expected: `Built …/dist/sql-studio.html (about 1.8 MB)`, then PASS, with 1 skipped ("app.js arrives in Task 19").

Also add `tools/sql-studio/dist/` to git (the Query Explorer commits its `dist/` file the same way).

- [ ] **Step 8: Commit**

```bash
git add tools/sql-studio/build.js tools/sql-studio/src/index.html tools/sql-studio/src/styles.css tools/sql-studio/src/dom.js tools/sql-studio/src/icons.js tools/sql-studio/test/build.test.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add page shell, styles, DOM helpers, icons, and build"
```

---

### Task 13: Preferences, per-data-set sessions, and the panel layout

**Files:**
- Create: `tools/sql-studio/src/prefs.js`, `tools/sql-studio/src/sessions.js`, `tools/sql-studio/src/layout.js`
- Test: `tools/sql-studio/test/prefs.test.js`, `tools/sql-studio/test/sessions.test.js`

**Interfaces:**
- Consumes: `FEATURES`, `DEFAULT_OPTIONS`, `normalizeOptions` (Task 9); `h`, `icon`, `iconButton`, `announce` (Task 12).
- Produces:
  - `prefs.js`: `STORAGE_KEY`, `PANELS`, `TEXT_ZOOM`, `ERD_ZOOM`, `DEFAULT_PREFS`, `sanitizePrefs(raw)`, `loadPrefs(storage)`, `savePrefs(storage, prefs): boolean`, `stepZoom(value, dir, range?)`.
  - `sessions.js`: `starterSql(schema)`, `createSessions(): { leave(id, { text, cursor, exerciseIndex }), enter(id, schema): { text, cursor, exerciseIndex }, forget(id) }`.
  - `layout.js`: `SS.createLayout(appEl, prefs, persist): { header, exercises, sql, results, erd, data, applySizes, save, onPanelToggle(fn) }`. Each panel is `{ el, head, headSlot, tools, body, setCollapsed, title }`. Also exports `SS.makePanel` and `SS.splitter`.

**Layout rules:**
- `layout.js` sets `grid-template-rows` (workspace) and `grid-template-columns` (top row) inline from `prefs`. A collapsed panel's row or column becomes `auto`.
- Below 760px, CSS switches both to flex columns, and the inline grid values no longer apply.
- Splitters are `role="separator"` with values. The vertical splitter's value is the SQL panel's width in percent; the horizontal splitters' values are heights in pixels.
- There are three horizontal splitters, one under each of the top row, the ERD, and Data, so every panel can be resized.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/prefs.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/prefs.js');

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test('defaults when nothing is saved', () => {
  const p = P.loadPrefs(memoryStorage());
  assert.equal(p.sqlWidth, 0.5);
  assert.equal(p.collapsed.exercises, true);
  assert.equal(p.tidyOnRun, true);
  assert.equal(p.random.join, true);
});

test('round trip through storage', () => {
  const s = memoryStorage();
  const p = P.loadPrefs(s);
  p.sqlWidth = 0.6;
  p.collapsed.erd = true;
  p.zoom.results = 130;
  assert.equal(P.savePrefs(s, p), true);
  const back = P.loadPrefs(s);
  assert.equal(back.sqlWidth, 0.6);
  assert.equal(back.collapsed.erd, true);
  assert.equal(back.zoom.results, 130);
});

test('bad JSON, wrong types, and out-of-range values fall back', () => {
  const s = memoryStorage();
  s.setItem(P.STORAGE_KEY, '{not json');
  assert.deepEqual(P.loadPrefs(s), P.sanitizePrefs({}));
  const p = P.sanitizePrefs({ sqlWidth: 5, zoom: { sql: 999, results: 'big' }, collapsed: { sql: 'yes' }, erdZoom: 3, random: { having: true } });
  assert.equal(p.sqlWidth, 0.8);
  assert.equal(p.zoom.sql, 200);
  assert.equal(p.zoom.results, 100);
  assert.equal(p.collapsed.sql, false);
  assert.equal(p.erdZoom, 30);
  assert.equal(p.random.groupBy, true, 'HAVING pulls in GROUP BY');
});

test('blocked storage: load gives defaults, save returns false, nothing throws', () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.deepEqual(P.loadPrefs(blocked), P.sanitizePrefs({}));
  assert.equal(P.savePrefs(blocked, P.sanitizePrefs({})), false);
  assert.equal(P.savePrefs(null, P.sanitizePrefs({})), false);
});

test('stepZoom moves by 10 and stops at the ends', () => {
  assert.equal(P.stepZoom(100, 1), 110);
  assert.equal(P.stepZoom(200, 1), 200);
  assert.equal(P.stepZoom(70, -1), 70);
  assert.equal(P.stepZoom(30, -1, P.ERD_ZOOM), 30);
});
```

`tools/sql-studio/test/sessions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Ss = require('../src/sessions.js');

const spotify = { tables: [{ name: 'Artists' }] };
const concert = { tables: [{ name: 'Venues' }] };

test('a data set starts with a starter query on its first table', () => {
  const s = Ss.createSessions();
  const st = s.enter('concert', concert);
  assert.equal(st.text, '-- Write a query, then press Run (or Ctrl+Enter).\nSELECT *\nFROM Venues;\n');
  assert.equal(st.cursor, null);
  assert.equal(st.exerciseIndex, 0);
});

test('switching away and back restores text, cursor, and exercise, and nothing else', () => {
  const s = Ss.createSessions();
  s.enter('spotify', spotify);
  s.leave('spotify', { text: 'SELECT 1', cursor: { line: 0, ch: 8 }, exerciseIndex: 3, result: { rows: [] }, error: 'x' });
  s.enter('concert', concert);
  const back = s.enter('spotify', spotify);
  assert.deepEqual(back, { text: 'SELECT 1', cursor: { line: 0, ch: 8 }, exerciseIndex: 3 });
  assert.equal('result' in back, false);
  assert.equal('error' in back, false);
});

test('forget drops the saved text', () => {
  const s = Ss.createSessions();
  s.leave('upload', { text: 'SELECT * FROM Old' });
  s.forget('upload');
  assert.match(s.enter('upload', { tables: [{ name: 'New' }] }).text, /FROM New;/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tools/sql-studio/test/prefs.test.js tools/sql-studio/test/sessions.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `prefs.js` and `sessions.js`**

`tools/sql-studio/src/prefs.js`:

```js
// SQL Studio: layout preferences, cleaned up and saved in localStorage. Storage may be missing or blocked.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Q = isNode ? require('./randomq.js') : root.SS;

  const STORAGE_KEY = 'sqlStudio.layout.v1';
  const PANELS = ['exercises', 'sql', 'results', 'erd', 'data'];
  const TEXT_ZOOM = { min: 70, max: 200, step: 10 };
  const ERD_ZOOM = { min: 30, max: 250, step: 10 };

  const DEFAULT_PREFS = Object.freeze({
    sqlWidth: 0.5,          // SQL panel's share of the top row (0.2–0.8)
    topHeight: 360,         // px, SQL + Results row
    erdHeight: 340,         // px
    dataHeight: 280,        // px
    collapsed: { exercises: true, sql: false, results: false, erd: false, data: false },
    zoom: { sql: 100, results: 100, data: 100 },
    erdZoom: 100,
    attributes: true,
    tidyOnRun: true,
    random: Q.DEFAULT_OPTIONS,
  });

  const clamp = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
  const bool = (v, dflt) => (typeof v === 'boolean' ? v : dflt);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const snap = (v, step) => Math.round(v / step) * step;

  // Anything missing, wrong, or out of range falls back to the default.
  function sanitizePrefs(raw) {
    const r = obj(raw);
    const d = DEFAULT_PREFS;
    const collapsed = obj(r.collapsed);
    const zoom = obj(r.zoom);
    const random = obj(r.random);
    return {
      sqlWidth: clamp(r.sqlWidth, 0.2, 0.8, d.sqlWidth),
      topHeight: clamp(r.topHeight, 160, 2000, d.topHeight),
      erdHeight: clamp(r.erdHeight, 160, 2000, d.erdHeight),
      dataHeight: clamp(r.dataHeight, 120, 2000, d.dataHeight),
      collapsed: Object.fromEntries(PANELS.map(p => [p, bool(collapsed[p], d.collapsed[p])])),
      zoom: Object.fromEntries(['sql', 'results', 'data'].map(p => [p, snap(clamp(zoom[p], TEXT_ZOOM.min, TEXT_ZOOM.max, 100), TEXT_ZOOM.step)])),
      erdZoom: snap(clamp(r.erdZoom, ERD_ZOOM.min, ERD_ZOOM.max, 100), ERD_ZOOM.step),
      attributes: bool(r.attributes, d.attributes),
      tidyOnRun: bool(r.tidyOnRun, d.tidyOnRun),
      random: Q.normalizeOptions(Object.fromEntries(Q.FEATURES.map(f => [f, bool(random[f], d.random[f])]))).options,
    };
  }

  function loadPrefs(storage) {
    try {
      const text = storage && storage.getItem(STORAGE_KEY);
      return sanitizePrefs(text ? JSON.parse(text) : {});
    } catch (e) {
      return sanitizePrefs({});
    }
  }

  // Returns true if saved.
  function savePrefs(storage, prefs) {
    try {
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitizePrefs(prefs)));
      return true;
    } catch (e) {
      return false;
    }
  }

  const stepZoom = (value, dir, range = TEXT_ZOOM) => clamp(snap(value, range.step) + dir * range.step, range.min, range.max, 100);

  const api = { STORAGE_KEY, PANELS, TEXT_ZOOM, ERD_ZOOM, DEFAULT_PREFS, sanitizePrefs, loadPrefs, savePrefs, stepZoom };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

`tools/sql-studio/src/sessions.js`:

```js
// SQL Studio: keeps each data set's editor text for this visit. Results, errors, and checks are never kept,
// so switching back never shows them against the wrong data.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  function starterSql(schema) {
    const first = schema.tables[0] ? schema.tables[0].name : 'TableName';
    return `-- Write a query, then press Run (or Ctrl+Enter).\nSELECT *\nFROM ${first};\n`;
  }

  function createSessions() {
    const saved = new Map();
    return {
      // Call before switching away from a data set.
      leave(id, { text, cursor = null, exerciseIndex = 0 }) {
        saved.set(id, { text, cursor, exerciseIndex });
      },
      // Returns the editor state to show for a data set: the saved one, or a fresh starter.
      enter(id, schema) {
        const s = saved.get(id);
        return s ? { text: s.text, cursor: s.cursor, exerciseIndex: s.exerciseIndex } : { text: starterSql(schema), cursor: null, exerciseIndex: 0 };
      },
      // A new upload replaces "Your data", so its old text goes too.
      forget(id) {
        saved.delete(id);
      },
    };
  }

  const api = { starterSql, createSessions };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/prefs.test.js tools/sql-studio/test/sessions.test.js`
Expected: PASS (5 + 3 tests).

- [ ] **Step 5: Write `layout.js`**

`tools/sql-studio/src/layout.js`:

```js
// SQL Studio: the page shell: header, Exercises strip, and four panels with collapse, text zoom, and splitters.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon, iconButton } = SS;

  // A panel: chevron + icon + bold name, a tools area, optional text zoom, and a body.
  function makePanel({ key, title, iconName, cls = '', zoomable = false, prefs, save, onToggle }) {
    const bodyId = `panel-${key}-body`;
    const titleId = `panel-${key}-title`;
    const chev = h('button', { type: 'button', class: 'chev', 'aria-controls': bodyId }, icon('chevron'));
    const headSlot = h('div', { class: 'head-slot', style: { display: 'contents' } });
    const tools = h('div', { class: 'panel-tools' });
    const body = h('div', { class: 'panel-body', id: bodyId, role: 'region', 'aria-labelledby': titleId });
    const head = h('div', { class: 'panel-head' }, chev, h('h2', { class: 'panel-title', id: titleId }, icon(iconName), title), headSlot, tools);
    const el = h('section', { class: `panel ${cls}`, 'aria-labelledby': titleId }, head, body);

    function setCollapsed(c) {
      el.classList.toggle('collapsed', c);
      chev.setAttribute('aria-expanded', String(!c));
      chev.setAttribute('aria-label', `${c ? 'Expand' : 'Collapse'} ${title}`);
      chev.title = `${c ? 'Expand' : 'Collapse'} ${title}`;
    }
    chev.addEventListener('click', () => {
      prefs.collapsed[key] = !prefs.collapsed[key];
      setCollapsed(prefs.collapsed[key]);
      save();
      onToggle(key, prefs.collapsed[key]);
    });
    setCollapsed(!!prefs.collapsed[key]);

    if (zoomable) {
      const out = h('output', { 'aria-live': 'off' });
      const apply = () => { body.style.setProperty('--zoom', prefs.zoom[key]); out.textContent = `${prefs.zoom[key]}%`; };
      const step = dir => () => { prefs.zoom[key] = SS.stepZoom(prefs.zoom[key], dir); apply(); save(); SS.announce(`${title} text ${prefs.zoom[key]}%`); };
      tools.append(h('span', { class: 'zoom', role: 'group', 'aria-label': `${title} text size` },
        iconButton('minus', `Smaller text in ${title}`, { onclick: step(-1) }), out, iconButton('plus', `Bigger text in ${title}`, { onclick: step(1) })));
      apply();
    }
    return { el, head, headSlot, tools, body, setCollapsed, title };
  }

  // A draggable, keyboard-movable splitter (role="separator").
  // get/set work in the splitter's own unit; `toValue` turns a pointer move (px) into that unit.
  function splitter({ orientation, label, controls, get, set, min, max, step, toValue, reset, format }) {
    const el = h('div', { class: `splitter ${orientation === 'vertical' ? 'v' : 'h'}`, role: 'separator', tabindex: '0',
      'aria-orientation': orientation, 'aria-label': label, 'aria-controls': controls, title: `${label} (drag, or use the arrow keys)` });
    const sync = () => {
      el.setAttribute('aria-valuemin', String(min));
      el.setAttribute('aria-valuemax', String(max));
      el.setAttribute('aria-valuenow', String(Math.round(get())));
      el.setAttribute('aria-valuetext', format(get()));
    };
    const put = v => { set(Math.min(max, Math.max(min, v))); sync(); };
    el.addEventListener('keydown', e => {
      const big = e.shiftKey ? 5 : 1;
      const back = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
      const fwd = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
      if (e.key === back) put(get() - step * big);
      else if (e.key === fwd) put(get() + step * big);
      else if (e.key === 'Home') put(min);
      else if (e.key === 'End') put(max);
      else if (e.key === 'Enter') { reset(); sync(); } else return;
      e.preventDefault();
    });
    el.addEventListener('dblclick', () => { reset(); sync(); });
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      const start = orientation === 'vertical' ? e.clientX : e.clientY;
      const startVal = get();
      const move = ev => put(startVal + toValue((orientation === 'vertical' ? ev.clientX : ev.clientY) - start));
      const up = () => { el.classList.remove('dragging'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    sync();
    return { el, sync };
  }

  function createLayout(appEl, prefs, persist) {
    let saveTimer = null;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => persist(prefs), 250); };
    const toggles = [];
    const onToggle = (key, collapsed) => { applySizes(); toggles.forEach(fn => fn(key, collapsed)); };
    const common = { prefs, save, onToggle };

    const header = h('header', { class: 'top' });
    const exercises = makePanel({ key: 'exercises', title: 'Exercises', iconName: 'bulb', cls: 'ex-strip', ...common });
    const sql = makePanel({ key: 'sql', title: 'SQL', iconName: 'db', cls: 'sql-panel', zoomable: true, ...common });
    const results = makePanel({ key: 'results', title: 'Results', iconName: 'results', cls: 'results-panel', zoomable: true, ...common });
    const erd = makePanel({ key: 'erd', title: 'ERD', iconName: 'grid', cls: 'erd-panel', ...common });
    const data = makePanel({ key: 'data', title: 'Data', iconName: 'table', cls: 'data-panel', zoomable: true, ...common });

    const toprow = h('div', { class: 'toprow' });
    const workspace = h('div', { class: 'workspace' });
    const D = SS.DEFAULT_PREFS;
    const px = v => `${Math.round(v)} pixels`;

    const vSplit = splitter({
      orientation: 'vertical', label: 'Resize SQL and Results', controls: `${sql.body.id} ${results.body.id}`,
      get: () => prefs.sqlWidth * 100, set: v => { prefs.sqlWidth = v / 100; applySizes(); save(); },
      min: 20, max: 80, step: 2, toValue: dx => (dx / Math.max(1, toprow.clientWidth)) * 100,
      reset: () => { prefs.sqlWidth = D.sqlWidth; applySizes(); save(); }, format: v => `SQL panel ${Math.round(v)}% wide`,
    });
    const hSplit = (key, label, controls) => splitter({
      orientation: 'horizontal', label, controls,
      get: () => prefs[key], set: v => { prefs[key] = v; applySizes(); save(); },
      min: key === 'dataHeight' ? 120 : 160, max: 2000, step: 20, toValue: dy => dy,
      reset: () => { prefs[key] = D[key]; applySizes(); save(); }, format: v => `${label}: ${px(v)} tall`,
    });
    const topSplit = hSplit('topHeight', 'Resize SQL and Results height', `${sql.body.id} ${results.body.id}`);
    const erdSplit = hSplit('erdHeight', 'Resize ERD height', erd.body.id);
    const dataSplit = hSplit('dataHeight', 'Resize Data height', data.body.id);

    toprow.append(sql.el, vSplit.el, results.el);
    workspace.append(exercises.el, toprow, topSplit.el, erd.el, erdSplit.el, data.el, dataSplit.el);
    const footnote = h('p', { class: 'footnote' }, 'Real names, made-up numbers. All data is invented for practice.');
    appEl.append(h('div', { class: 'app' }, header, workspace, footnote));

    function applySizes() {
      const c = prefs.collapsed;
      const w = prefs.sqlWidth;
      toprow.style.gridTemplateColumns = c.sql && c.results ? 'auto 10px auto'
        : c.sql ? 'auto 10px minmax(0,1fr)' : c.results ? 'minmax(0,1fr) 10px auto' : `minmax(0,${w}fr) 10px minmax(0,${(1 - w).toFixed(3)}fr)`;
      const topBoth = c.sql && c.results;
      workspace.style.gridTemplateRows = [
        'auto',
        topBoth ? 'auto' : `${prefs.topHeight}px`, '10px',
        c.erd ? 'auto' : `${prefs.erdHeight}px`, '10px',
        c.data ? 'auto' : `${prefs.dataHeight}px`, '10px',
      ].join(' ');
      vSplit.el.hidden = c.sql || c.results;
      vSplit.sync(); topSplit.sync(); erdSplit.sync(); dataSplit.sync();
    }
    applySizes();

    return { header, exercises, sql, results, erd, data, applySizes, save, onPanelToggle: fn => toggles.push(fn) };
  }

  root.SS = Object.assign(SS, { createLayout, makePanel, splitter });
})(this);
```

- [ ] **Step 6: Syntax-check, build, and run all tests**

Run: `node --check tools/sql-studio/src/layout.js && node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS (1 skipped).

- [ ] **Step 7: Commit**

```bash
git add tools/sql-studio/src/prefs.js tools/sql-studio/src/sessions.js tools/sql-studio/src/layout.js tools/sql-studio/test/prefs.test.js tools/sql-studio/test/sessions.test.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add saved layout preferences, per-data-set editor sessions, and panel layout"
```

---

### Task 14: The SQL editor and the Results panel

**Files:**
- Create: `tools/sql-studio/src/editor.js`, `tools/sql-studio/src/results-view.js`

**Interfaces:**
- Consumes: `window.CodeMirror` with the SQL mode, show-hint, sql-hint, active-line, and matchbrackets (Task 1); `h`, `rich`, `popover`, `copyText`, `downloadText`, `announce` (Task 12); `toTSV`, `toCSV` (Task 10).
- Produces:
  - `SS.createEditor(host, { onRun, onFormat, onChange })` returns:
    - `getText()`;
    - `setText(text, cursorIndex?, { keepHistory })`;
    - `replaceRange(start, end, text)`;
    - `getCursorIndex()`, `getCursor()`, `setCursor(pos)`, `setCursorIndex(i)`;
    - `setSchema(schema)`, which loads autocomplete tables;
    - `markError(absOffset, length)`, `clearMarks()`;
    - `flash(start, end)`, `focus()`, `refresh()`.
  - `SS.createResults(panel)` returns `{ showEmpty(), showResult(result), showError(explained, where, onJump), errorBox(...), result }`. Also exported: `SS.renderDataTable(columns, rows, { caption, display, headerExtra })`, `SS.formatCell(v, display)`, and `SS.isNumericColumn(rows, i)`.

**Notes:**
- `extraKeys: { Tab: false, 'Shift-Tab': false }` stops CodeMirror from capturing Tab, so focus can always leave the editor. Indentation comes from Format.
- Autocomplete opens 150 ms after a letter or `.` is typed (not inside strings or comments). `sql-hint` resolves `alias.` against the FROM/JOIN clause by itself, using the `tables` we pass in.
- The number-display popover changes only the cell text. Copy, CSV, and Check always use the raw `result`.

- [ ] **Step 1: Write `editor.js`**

`tools/sql-studio/src/editor.js`:

```js
// SQL Studio: the CodeMirror 5 editor: SQLite mode, autocomplete from the schema, error marks, run flash.
(function (root) {
  'use strict';
  const SS = root.SS;
  const CM = root.CodeMirror;

  function createEditor(host, { onRun, onFormat, onChange }) {
    const cm = CM(host, {
      mode: 'text/x-sqlite',
      theme: 'default studio',
      lineNumbers: true,
      styleActiveLine: true,
      matchBrackets: true,
      inputStyle: 'contenteditable',
      screenReaderLabel: 'SQL editor. Press Control Enter to run. Press Tab to leave the editor.',
      indentUnit: 2,
      tabSize: 2,
      gutters: ['err-gutter', 'CodeMirror-linenumbers'],
      // Tab and Shift-Tab move focus out of the editor, so keyboard users are never stuck.
      extraKeys: { 'Ctrl-Enter': () => onRun(), 'Cmd-Enter': () => onRun(), 'Shift-Alt-F': () => onFormat(), 'Ctrl-Space': 'autocomplete', Tab: false, 'Shift-Tab': false },
      hintOptions: { completeSingle: false, tables: {} },
    });

    // Open suggestions after a letter or "." (short pause), but not inside strings or comments.
    let hintTimer = null;
    cm.on('inputRead', (_, change) => {
      const ch = change.text[change.text.length - 1].slice(-1);
      if (!/[A-Za-z_.]/.test(ch)) return;
      const tok = cm.getTokenAt(cm.getCursor());
      if (tok.type && /string|comment/.test(tok.type)) return;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { if (!cm.state.completionActive) cm.showHint({ completeSingle: false }); }, 150);
    });

    let errorMarks = [];
    const clearMarks = () => {
      errorMarks.forEach(m => m.clear());
      errorMarks = [];
      cm.clearGutter('err-gutter');
    };
    cm.on('change', () => { clearMarks(); onChange(cm.getValue()); });

    function setSchema(schema) {
      const tables = {};
      for (const t of schema.tables) tables[t.name] = t.columns.map(c => c.name);
      cm.setOption('hintOptions', { completeSingle: false, tables });
    }

    // Underlines the problem spot (absolute offsets into the whole editor text) and marks its line.
    function markError(offset, length) {
      clearMarks();
      if (offset === null || offset === undefined) return;
      const total = cm.getValue().length;
      let from = Math.min(offset, total);
      let to = Math.min(offset + Math.max(length, 1), total);
      if (from === to && from > 0) from -= 1;
      const a = cm.posFromIndex(from);
      const b = cm.posFromIndex(to);
      errorMarks.push(cm.markText(a, b, { className: 'cm-error-mark', attributes: { title: 'The problem starts here' } }));
      cm.setGutterMarker(a.line, 'err-gutter', SS.h('div', { class: 'err-dot', title: 'Error on this line' }));
    }

    // Briefly highlights the statement that ran.
    function flash(start, end) {
      const m = cm.markText(cm.posFromIndex(start), cm.posFromIndex(end), { className: 'cm-ran' });
      setTimeout(() => m.clear(), SS.reducedMotion() ? 400 : 900);
    }

    return {
      cm,
      getText: () => cm.getValue(),
      // Replaces all text (kept in undo history) and puts the cursor at `cursorIndex` or the end.
      setText(text, cursorIndex = null, { keepHistory = true } = {}) {
        if (keepHistory) cm.replaceRange(text, { line: 0, ch: 0 }, cm.posFromIndex(cm.getValue().length));
        else { cm.setValue(text); cm.clearHistory(); }
        cm.setCursor(cm.posFromIndex(cursorIndex === null ? text.length : Math.min(cursorIndex, text.length)));
      },
      replaceRange(start, end, text) { cm.replaceRange(text, cm.posFromIndex(start), cm.posFromIndex(end)); },
      getCursorIndex: () => cm.indexFromPos(cm.getCursor()),
      getCursor: () => cm.getCursor(),
      setCursor: pos => { if (pos) cm.setCursor(pos); },
      setCursorIndex(i) { cm.setCursor(cm.posFromIndex(i)); cm.focus(); },
      setSchema,
      markError,
      clearMarks,
      flash,
      focus: () => cm.focus(),
      refresh: () => cm.refresh(),
    };
  }

  root.SS = Object.assign(SS, { createEditor });
})(this);
```

- [ ] **Step 2: Write `results-view.js`**

`tools/sql-studio/src/results-view.js`:

```js
// SQL Studio: the Results panel (count, table, paging, number display, Copy, Export CSV, error box).
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, clear, icon, rich } = SS;

  const PAGE = 100;
  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
  const isNumericColumn = (rows, i) => rows.some(r => r[i] !== null) && rows.every(r => r[i] === null || typeof r[i] === 'number');

  // display: { sep: bool, dec: null | 0..3 } — changes what is shown, never the data.
  function formatCell(v, display) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v !== 'number' || !display || (!display.sep && display.dec === null)) return String(v);
    const opts = { useGrouping: !!display.sep };
    if (display.dec !== null) { opts.minimumFractionDigits = display.dec; opts.maximumFractionDigits = display.dec; } else opts.maximumFractionDigits = 10;
    return v.toLocaleString('en-US', opts);
  }

  // A real <table>. `headerExtra(i)` can add controls to a numeric header.
  function renderDataTable(columns, rows, { caption, display = [], headerExtra = null } = {}) {
    const numeric = columns.map((_, i) => isNumericColumn(rows, i));
    return h('table', { class: 'data' },
      h('caption', { class: 'sr-only' }, caption),
      h('thead', null, h('tr', null, columns.map((c, i) => h('th', { scope: 'col', class: numeric[i] ? 'num' : null },
        h('span', { class: 'th-inner' }, h('span', null, c), numeric[i] && headerExtra ? headerExtra(i, c) : null))))),
      h('tbody', null, rows.map(r => h('tr', null, r.map((v, i) => h('td', { class: [numeric[i] ? 'num' : '', v === null ? 'null' : ''].join(' ').trim() || null }, formatCell(v, display[i])))))));
  }

  function createResults(panel) {
    const count = h('span', { class: 'res-count' });
    const copyBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: onCopy }, icon('copy'), 'Copy');
    const csvBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: onCsv }, icon('download'), 'Export CSV');
    const bar = h('div', { class: 'res-bar' }, count, h('span', { class: 'spacer' }), copyBtn, csvBtn);
    const body = h('div', { class: 'res-body' });
    const pager = h('nav', { class: 'pager', 'aria-label': 'Result pages', hidden: true });
    panel.body.append(bar, body, pager);

    let result = null;
    let page = 0;
    let display = [];

    function showEmpty() {
      result = null;
      count.textContent = '';
      copyBtn.hidden = csvBtn.hidden = true;
      pager.hidden = true;
      clear(body).append(h('div', { class: 'empty-box' }, 'Run a query to display results.'));
    }

    function showResult(r, { before = null } = {}) {
      result = r;
      page = 0;
      display = r.columns.map(() => ({ sep: false, dec: null }));
      count.replaceChildren(h('strong', null, plural(r.rows.length, 'row', 'rows')), ' × ', h('strong', null, plural(r.columns.length, 'column', 'columns')));
      copyBtn.hidden = csvBtn.hidden = false;
      draw(before);
    }

    function draw(before) {
      clear(body);
      if (before) body.append(before);
      if (result.truncated) body.append(h('p', { class: 'note-box' }, `Showing the first ${result.rows.length.toLocaleString('en-US')} rows. Your query made even more than that. Is a JOIN missing its ON condition?`));
      if (!result.rows.length) {
        body.append(h('div', { class: 'empty-box' }, 'Your query ran, but no rows matched. Does that make sense for your question?'));
        pager.hidden = true;
        return;
      }
      const pages = Math.ceil(result.rows.length / PAGE);
      const rows = result.rows.slice(page * PAGE, page * PAGE + PAGE);
      body.append(renderDataTable(result.columns, rows, {
        caption: `Query results: ${plural(result.rows.length, 'row', 'rows')}, ${plural(result.columns.length, 'column', 'columns')}`,
        display,
        headerExtra: numberOptions,
      }));
      pager.hidden = pages < 2;
      if (pages > 1) {
        const first = page * PAGE + 1;
        const last = Math.min(result.rows.length, (page + 1) * PAGE);
        pager.replaceChildren(
          h('button', { type: 'button', class: 'btn', disabled: page === 0, onclick: () => go(page - 1) }, '« Prev'),
          h('span', null, `Rows ${first.toLocaleString('en-US')}–${last.toLocaleString('en-US')} of ${result.rows.length.toLocaleString('en-US')}`),
          h('button', { type: 'button', class: 'btn', disabled: page >= pages - 1, onclick: () => go(page + 1) }, 'Next »'));
      }
    }

    function go(p) {
      page = p;
      draw(null);
      body.scrollTop = 0;
      const first = page * PAGE + 1;
      SS.announce(`Showing rows ${first} to ${Math.min(result.rows.length, first + PAGE - 1)}.`);
    }

    // The ⋯ button on a numeric header: thousands separators and decimal places (display only).
    function numberOptions(i, name) {
      const btn = h('button', { type: 'button', class: 'col-opts', 'aria-label': `Number display for ${name}`, title: 'Number display' }, '⋯');
      const sep = h('input', { type: 'checkbox', id: `sep-${i}` });
      sep.checked = display[i].sep;
      const dec = h('select', { id: `dec-${i}`, 'aria-label': 'Decimal places' },
        [['', 'Auto'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']].map(([v, t]) => h('option', { value: v, selected: String(display[i].dec ?? '') === v }, t)));
      const apply = () => {
        display[i] = { sep: sep.checked, dec: dec.value === '' ? null : Number(dec.value) };
        // Update the cells in place so the popover stays open.
        const tbody = body.querySelector('tbody');
        const rows = result.rows.slice(page * PAGE, page * PAGE + PAGE);
        if (tbody) [...tbody.rows].forEach((tr, k) => { tr.cells[i].textContent = formatCell(rows[k][i], display[i]); });
      };
      sep.addEventListener('change', apply);
      dec.addEventListener('change', apply);
      const pop = h('div', { class: 'popover', role: 'group', 'aria-label': `Number display for ${name}` },
        h('h3', null, name),
        h('label', { class: 'check-label', for: `sep-${i}` }, sep, 'Thousands separators'),
        h('label', { class: 'check-label', for: `dec-${i}` }, 'Decimal places', dec),
        h('p', { class: 'added' }, 'This only changes how numbers look.'));
      return SS.popover(btn, pop).wrap;
    }

    async function onCopy() {
      if (!result) return;
      const how = await SS.copyText(SS.toTSV(result));
      SS.announce(how === 'copied' ? `Copied ${plural(result.rows.length, 'row', 'rows')}. Paste into Excel or Google Sheets.` : 'Your browser would not let us copy. Try Export CSV instead.');
    }

    function onCsv() {
      if (!result) return;
      SS.downloadText('sql-studio-results.csv', SS.toCSV(result), 'text/csv');
      SS.announce('Saved sql-studio-results.csv.');
    }

    // explained: from SS.explainError; where: { line, col } or null.
    function errorBox(explained, where, onJump) {
      return h('div', { class: 'err-box', role: 'alert' },
        h('p', { class: 'headline' }, rich(explained.headline)),
        where ? h('p', { class: 'where' }, h('button', { type: 'button', class: 'btn-link', onclick: onJump }, `Line ${where.line}, column ${where.col}`)) : null,
        explained.raw ? h('details', null, h('summary', null, 'What SQLite said'), h('code', null, explained.raw)) : null);
    }

    function showError(explained, where, onJump) {
      result = null;
      count.textContent = '';
      copyBtn.hidden = csvBtn.hidden = true;
      pager.hidden = true;
      clear(body).append(errorBox(explained, where, onJump));
    }

    showEmpty();
    return { showEmpty, showResult, showError, errorBox, get result() { return result; } };
  }

  root.SS = Object.assign(SS, { createResults, renderDataTable, formatCell, isNumericColumn });
})(this);
```

- [ ] **Step 3: Syntax-check, build, and run all tests**

Run: `node --check tools/sql-studio/src/editor.js && node --check tools/sql-studio/src/results-view.js && node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS (1 skipped). Browser behavior is checked in Tasks 19–20.

- [ ] **Step 4: Commit**

```bash
git add tools/sql-studio/src/editor.js tools/sql-studio/src/results-view.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add CodeMirror editor and Results panel"
```

---

### Task 15: Exercises strip and Copy for homework

**Files:**
- Create: `tools/sql-studio/src/exercises-view.js`, `tools/sql-studio/src/export-dialog.js`

**Interfaces:**
- Consumes: `exerciseLabel` (Task 8); `homeworkText`, `homeworkFilename` (Task 10); `h`, `rich`, `icon`, `iconButton`, `announce`, `copyText`, `downloadText`, `modKey` (Task 12); a panel from `createLayout` (Task 13).
- Produces:
  - `SS.createExercises(panel, { onSelect(i), onCheck(i), onHomework(openerEl) })` returns `{ setData({ schema, list, assessment, index }), setCurrent(i), setFeedback(i, { ok, message }), clearFeedback(), index }`.
  - `SS.showHomeworkDialog({ schema, list, index, sql, result, opener })` and `SS.closeHomeworkDialog()`.

**Notes:**
- When collapsed, the strip's header shows "Exercises (6)", ‹ › buttons, and the current "1.1 question". "Copy for homework" stays visible even when the strip is collapsed (CSS rule `.ex-strip.collapsed .panel-tools{display:flex;}`).
- Assessment sets (`isAssessment(number)`) show only the question and note: no hint button and no Check button.
- The dialog copies **plain text** only, as the spec asks. Its focus trap, Escape handling, `inert` background, and focus return are the same as the Query Explorer's `export-dialog.js`.

- [ ] **Step 1: Write `exercises-view.js`**

`tools/sql-studio/src/exercises-view.js`:

```js
// SQL Studio: the Exercises strip (current question when collapsed; full list with hints and Check when open).
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, clear, icon, iconButton } = SS;

  function createExercises(panel, { onSelect, onCheck, onHomework }) {
    const countEl = h('span', { class: 'ex-count' });
    panel.head.querySelector('.panel-title').append(countEl);
    const numEl = h('span', { class: 'ex-num' });
    const textEl = h('span', { class: 'text' });
    const prev = iconButton('prev', 'Previous exercise', { onclick: () => move(-1) });
    const next = iconButton('next', 'Next exercise', { onclick: () => move(1) });
    const current = h('div', { class: 'ex-current', 'aria-live': 'off' }, prev, numEl, textEl, next);
    panel.headSlot.append(current);
    const hwBtn = h('button', { type: 'button', class: 'btn', onclick: e => onHomework(e.currentTarget) }, icon('homework'), 'Copy for homework');
    panel.tools.append(hwBtn);

    let data = { schema: null, list: [], assessment: false, index: 0 };
    const items = [];

    function setData({ schema, list, assessment, index }) {
      data = { schema, list, assessment, index: Math.min(index || 0, Math.max(0, list.length - 1)) };
      countEl.textContent = list.length ? ` (${list.length})` : '';
      items.length = 0;
      clear(panel.body);
      if (!list.length) {
        panel.body.append(h('p', { class: 'ex-empty' }, 'There are no exercises for your own data. Try ', h('strong', null, 'Random Query'), ' to get started.'));
      } else {
        panel.body.append(h('ol', { class: 'ex-list' }, list.map((ex, i) => item(ex, i))));
      }
      setCurrent(data.index, { quiet: true });
    }

    function item(ex, i) {
      const label = SS.exerciseLabel(data.schema.number, i);
      const hintId = `ex-hint-${i}`;
      const hint = !data.assessment && ex.hint ? h('p', { class: 'ex-hint', id: hintId, hidden: true }, icon('bulb'), ' ', SS.rich(ex.hint)) : null;
      const feedback = h('p', { class: 'ex-feedback', role: 'status', hidden: true });
      const hintBtn = hint ? h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', 'aria-controls': hintId, onclick: e => {
        hint.hidden = !hint.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!hint.hidden));
        e.currentTarget.lastChild.textContent = hint.hidden ? 'Show hint' : 'Hide hint';
      } }, icon('bulb'), h('span', null, 'Show hint')) : null;
      const checkBtn = data.assessment ? null : h('button', { type: 'button', class: 'btn', onclick: () => { setCurrent(i, { quiet: true }); onCheck(i); } }, icon('check'), 'Check my answer');
      const numBtn = h('button', { type: 'button', class: 'btn-link ex-num', 'aria-label': `Make ${label} the current exercise`, onclick: () => setCurrent(i) }, label);
      const li = h('li', { class: 'ex-item' },
        h('div', { class: 'q' }, numBtn, h('span', null, ex.text)),
        ex.note ? h('p', { class: 'note' }, ex.note) : null,
        hintBtn || checkBtn ? h('div', { class: 'ex-actions' }, hintBtn, checkBtn) : null,
        hint, feedback);
      items[i] = { li, numBtn, feedback };
      return li;
    }

    function setCurrent(i, { quiet = false } = {}) {
      if (!data.list.length) {
        numEl.textContent = '';
        textEl.textContent = 'No exercises for this data';
        prev.disabled = next.disabled = true;
        return;
      }
      data.index = i;
      const ex = data.list[i];
      numEl.textContent = SS.exerciseLabel(data.schema.number, i);
      textEl.textContent = ex.text;
      textEl.title = ex.text;
      prev.disabled = i === 0;
      next.disabled = i === data.list.length - 1;
      items.forEach((it, k) => {
        it.li.classList.toggle('current', k === i);
        if (k === i) it.numBtn.setAttribute('aria-current', 'true'); else it.numBtn.removeAttribute('aria-current');
      });
      if (!quiet) SS.announce(`Exercise ${numEl.textContent}: ${ex.text}`);
      onSelect(i);
    }

    function move(dir) {
      const i = Math.min(data.list.length - 1, Math.max(0, data.index + dir));
      if (i !== data.index) setCurrent(i);
    }

    // check: { ok, message } from SS.checkExercise.
    function setFeedback(i, check) {
      const it = items[i];
      if (!it) return;
      it.feedback.hidden = false;
      it.feedback.classList.toggle('ok', !!check.ok);
      it.feedback.replaceChildren(check.ok ? icon('check') : '', check.ok ? ' ' : '', check.message);
      SS.announce(check.message);
    }

    const clearFeedback = () => items.forEach(it => { it.feedback.hidden = true; it.feedback.textContent = ''; });

    return { setData, setCurrent, setFeedback, clearFeedback, get index() { return data.index; } };
  }

  root.SS = Object.assign(SS, { createExercises });
})(this);
```

- [ ] **Step 2: Write `export-dialog.js`**

`tools/sql-studio/src/export-dialog.js`:

```js
// SQL Studio: the "Copy for homework" dialog (pick an exercise, preview, copy or download). Same pattern as the Query Explorer's.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h } = SS;

  let current = null;
  const closeHomeworkDialog = () => { if (current) current.close(); };

  // schema: current schema; list: exercises (empty for uploads); index: current exercise;
  // sql: the statement to copy; result: SS.runQuery(...) of it, or null if there is none.
  function showHomeworkDialog({ schema, list, index, sql, result, opener }) {
    closeHomeworkDialog();
    const appEl = document.getElementById('app');
    const previous = opener || document.activeElement;
    const datasetLabel = schema.number ? `${schema.number}. ${schema.name}` : `${schema.name} (${schema.description})`;
    let done = false;

    const pickId = 'ss-hw-pick';
    const pick = list.length
      ? h('select', { id: pickId, onchange: update }, list.map((ex, i) => h('option', { value: String(i), selected: i === index }, `${SS.exerciseLabel(schema.number, i)} – ${ex.text}`)))
      : h('input', { id: pickId, type: 'text', placeholder: 'For example: Which customers spent the most?', oninput: update });
    const preview = h('pre', { class: 'hw-preview', tabindex: '0', 'aria-label': 'Preview of what will be copied' });
    const status = h('p', { class: 'hw-status', role: 'status' });
    const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: onCopy }, 'Copy');
    const dlBtn = h('button', { class: 'btn', type: 'button', onclick: onDownload }, 'Download .txt');
    const closeBtn = h('button', { class: 'btn', type: 'button', onclick: close }, 'Close');
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ss-hw-title' },
      h('h2', { id: 'ss-hw-title' }, 'Copy for homework'),
      h('p', { class: 'modal-body' }, 'This copies your SQL and your result as plain text, so you can paste them into your homework.'),
      h('label', { for: pickId, class: 'hw-label' }, list.length ? 'Which exercise is this an answer to?' : 'What question does this answer?'),
      pick,
      h('p', { class: 'hw-small' }, 'Preview'),
      preview,
      h('div', { class: 'modal-actions' }, copyBtn, dlBtn, closeBtn),
      status);
    const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

    let text = '';
    let label = '';
    function update() {
      if (list.length) {
        const i = Number(pick.value);
        label = SS.exerciseLabel(schema.number, i);
        text = SS.homeworkText({ datasetLabel, exerciseLabel: label, question: list[i].text, sql, result });
      } else {
        label = 'my-question';
        text = SS.homeworkText({ datasetLabel, exerciseLabel: '(your own question)', question: pick.value || '(type your question above)', sql, result });
      }
      preview.textContent = text;
      status.textContent = '';
    }

    async function onCopy() {
      const how = await SS.copyText(text);
      if (done) return;
      if (how === 'copied') status.textContent = 'Copied! Paste it into your homework.';
      else {
        const range = document.createRange();
        range.selectNodeContents(preview);
        const sel = root.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        preview.focus({ preventScroll: true });
        status.textContent = `Your browser would not let us copy. The text is selected. Press ${SS.modKey}+C to copy it.`;
      }
    }

    function onDownload() {
      const name = SS.homeworkFilename(label);
      SS.downloadText(name, text);
      status.textContent = `Saved as ${name}.`;
    }

    function close() {
      if (done) return;
      done = true;
      current = null;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
      backdrop.remove();
      if (appEl) appEl.inert = false;
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const order = [pick, preview, copyBtn, dlBtn, closeBtn];
      const i = order.indexOf(document.activeElement);
      const n = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : (i === order.length - 1 ? 0 : i + 1);
      e.preventDefault();
      order[n].focus();
    }
    function onFocusIn(e) { if (!dialog.contains(e.target)) pick.focus({ preventScroll: true }); }

    current = { close };
    if (appEl) appEl.inert = true;
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    update();
    pick.focus({ preventScroll: true });
  }

  root.SS = Object.assign(SS, { showHomeworkDialog, closeHomeworkDialog });
})(this);
```

- [ ] **Step 3: Syntax-check, build, and run all tests**

Run: `node --check tools/sql-studio/src/exercises-view.js && node --check tools/sql-studio/src/export-dialog.js && node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS (1 skipped).

- [ ] **Step 4: Commit**

```bash
git add tools/sql-studio/src/exercises-view.js tools/sql-studio/src/export-dialog.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add Exercises strip and Copy for homework dialog"
```

---

### Task 16: Random Query button and Complexity popover

**Files:**
- Create: `tools/sql-studio/src/random-ui.js`

**Interfaces:**
- Consumes: `FEATURES`, `FEATURE_LABELS`, `normalizeOptions` (Task 9); `popover`, `icon` (Task 12); `prefs.random` (Task 13).
- Produces: `SS.createRandomControls(toolbar, { prefs, save, onGenerate(options) }): { randomBtn }`.

When a student checks a feature that needs others (for example, HAVING), those features are checked too, and the popover says so in a status line: "Also turned on: GROUP BY, Aggregate (COUNT/SUM/AVG/MIN/MAX) (needed for HAVING)."

- [ ] **Step 1: Write `random-ui.js`**

`tools/sql-studio/src/random-ui.js`:

```js
// SQL Studio: the Random Query button and its Complexity popover.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon } = SS;

  // Appends [Random Query] [Complexity] to `toolbar`. prefs.random holds the allowed features.
  function createRandomControls(toolbar, { prefs, save, onGenerate }) {
    const randomBtn = h('button', { type: 'button', class: 'btn', title: 'Write a random query for this data set', onclick: () => onGenerate(prefs.random) }, icon('dice'), 'Random Query');
    const complexBtn = h('button', { type: 'button', class: 'btn', title: 'Choose what random queries can include' }, icon('sliders'), 'Complexity');
    const note = h('p', { class: 'added', role: 'status' });
    const boxes = {};
    const list = SS.FEATURES.map(f => {
      const cb = h('input', { type: 'checkbox', id: `rq-${f}` });
      boxes[f] = cb;
      cb.addEventListener('change', () => {
        const wanted = Object.fromEntries(SS.FEATURES.map(k => [k, boxes[k].checked]));
        const { options, added } = SS.normalizeOptions(wanted);
        prefs.random = options;
        sync();
        save();
        note.textContent = added.length ? `Also turned on: ${added.map(a => SS.FEATURE_LABELS[a]).join(', ')} (needed for ${SS.FEATURE_LABELS[f]}).` : '';
      });
      return h('label', { class: 'check-label', for: `rq-${f}` }, cb, SS.FEATURE_LABELS[f]);
    });
    const panel = h('div', { class: 'popover', role: 'group', 'aria-label': 'What random queries can include' },
      h('h3', null, 'Random queries can use'), list, note);
    function sync() { SS.FEATURES.forEach(f => { boxes[f].checked = !!prefs.random[f]; }); }
    sync();
    const pop = SS.popover(complexBtn, panel, { onOpen: () => { note.textContent = ''; } });
    toolbar.append(randomBtn, pop.wrap);
    return { randomBtn };
  }

  root.SS = Object.assign(SS, { createRandomControls });
})(this);
```

- [ ] **Step 2: Syntax-check, build, and run all tests**

Run: `node --check tools/sql-studio/src/random-ui.js && node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS (1 skipped).

- [ ] **Step 3: Commit**

```bash
git add tools/sql-studio/src/random-ui.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add Random Query button and Complexity options"
```

---

### Task 17: The ERD

**Files:**
- Create: `tools/sql-studio/src/erd-model.js`, `tools/sql-studio/src/erd.js`
- Test: `tools/sql-studio/test/erd-model.test.js`

**Interfaces:**
- Consumes: `buildSchema` (for tests); `h`, `s`, `clear`, `icon`, `iconButton`, `announce`, `downloadBlob` (Task 12); `ERD_ZOOM`, `stepZoom`, `prefs.attributes`, and `prefs.erdZoom` (Task 13).
- Produces:
  - `erd-model.js`: `BOX`, `boxSize(table, { showColumns })`, `layers(schema, hidden)`, `tidyLayout(schema, { showColumns, hidden }): { [name]: { x, y } }`, `linkRoute(fromBox, fromTable, fromCol, toBox, toTable, toCol, showFrom, showTo): { points, fromSide, toSide }`, `crowFoot(point, side, 'one'|'many'): { lines, circle }`, `pathData(points)`.
  - `erd.js`: `SS.createErd(panel, { prefs, save, onChange({ tables, relationships }) })` returns `{ setSchema(schema, { renamed }), tidy(), fit(), counts(), addLink(...), removeLink(i) }`.
  - Edit Links changes `schema.relationships` and the columns' `fk` **in place**. The random generator and the header count therefore see the edited links, while the database and the exercise answers stay the same.

**Notes:**
- Crow's foot follows Chapter 6. The primary-key end is "exactly one" (two bars). The foreign-key end is "zero or more" (circle plus three prongs).
- Tables are focusable groups. The arrow keys move a table 10px (50px with Shift). The fold and hide buttons inside a table are focusable `role="button"` groups.
- In Edit Links mode, links become focusable buttons, and Delete removes the focused one. The side form (selects plus Add, a Remove button per link, and Reset links) is the keyboard and screen-reader way to do everything that dragging does.
- Pinch uses two pointers on the canvas (`touch-action: none`), and Ctrl/⌘ + wheel zooms. A plain wheel scrolls the page, so students never get stuck inside the diagram.
- PNG: the clone gets computed styles written in, so it matches the current theme. It tries `ClipboardItem` first and falls back to a download.
- Positions are kept per data set for the visit. A new upload whose tables differ gets a fresh tidy layout.

- [ ] **Step 1: Write the failing tests**

`tools/sql-studio/test/erd-model.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/erd-model.js');
const S = require('../src/schema.js');
const { loadDatasets } = require('./helpers.js');

const schemas = loadDatasets().map(S.buildSchema);
const boxesFor = (schema, pos, showColumns = true) => Object.fromEntries(schema.tables.map(t => [t.name, { ...pos[t.name], ...M.boxSize(t, { showColumns }) }]));
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('tidy puts every referenced (parent) table left of the table that references it', () => {
  for (const s of schemas) {
    const pos = M.tidyLayout(s);
    for (const r of s.relationships) assert.ok(pos[r.to.table].x < pos[r.from.table].x, `${s.id}: ${r.to.table} left of ${r.from.table}`);
  }
});

test('tidy boxes never overlap, with or without columns', () => {
  for (const s of schemas) for (const showColumns of [true, false]) {
    const boxes = Object.values(boxesFor(s, M.tidyLayout(s, { showColumns }), showColumns));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), s.id);
  }
});

test('hidden tables get no position', () => {
  const s = schemas[0];
  const pos = M.tidyLayout(s, { hidden: new Set(['Songs']) });
  assert.deepEqual(Object.keys(pos).sort(), ['Artists', 'Streams']);
});

test('a cycle of references does not hang', () => {
  const t = (name, ref) => ({ name, columns: [{ name: 'id', type: 'number', pk: true }, { name: 'o', type: 'number', fk: { table: ref, column: 'id' } }], rows: [] });
  const s = { tables: [t('A', 'B'), t('B', 'A')], relationships: [{ from: { table: 'A', column: 'o' }, to: { table: 'B', column: 'id' } }, { from: { table: 'B', column: 'o' }, to: { table: 'A', column: 'id' } }] };
  assert.equal(Object.keys(M.tidyLayout(s)).length, 2);
});

test('link routes start at the FK row, end at the PK row, and only move straight', () => {
  const s = schemas[0];
  const boxes = boxesFor(s, M.tidyLayout(s));
  const songs = s.tables.find(t => t.name === 'Songs');
  const artists = s.tables.find(t => t.name === 'Artists');
  const r = M.linkRoute(boxes.Songs, songs, 'artist_id', boxes.Artists, artists, 'artist_id');
  const first = r.points[0];
  const last = r.points[r.points.length - 1];
  assert.equal(r.fromSide, 'left');
  assert.equal(first.x, boxes.Songs.x);
  assert.equal(last.x, boxes.Artists.x + boxes.Artists.w);
  assert.equal(first.y, boxes.Songs.y + M.BOX.header + 2 * M.BOX.row + M.BOX.row / 2 + 3);
  for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1];
    const b = r.points[i];
    assert.ok(a.x === b.x || a.y === b.y, 'orthogonal');
  }
});

test("crow's foot: one end has two bars, many end has three prongs and a circle", () => {
  const one = M.crowFoot({ x: 100, y: 50 }, 'right', 'one');
  assert.equal(one.lines.length, 2);
  assert.equal(one.circle, null);
  const many = M.crowFoot({ x: 100, y: 50 }, 'left', 'many');
  assert.equal(many.lines.length, 3);
  assert.ok(many.circle.cx < 100);
  assert.equal(M.pathData([{ x: 1, y: 2 }, { x: 3, y: 2 }]), 'M1 2 L3 2');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tools/sql-studio/test/erd-model.test.js`
Expected: FAIL with "Cannot find module '../src/erd-model.js'".

- [ ] **Step 3: Implement `erd-model.js`**

`tools/sql-studio/src/erd-model.js`:

```js
// SQL Studio: ERD geometry (box sizes, tidy layout, link routes, crow's foot ends). Pure; erd.js draws it.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const BOX = { header: 34, row: 22, padX: 12, minWidth: 170, charWidth: 7.6, gapX: 110, gapY: 36, margin: 40 };

  // Width fits the longest "name  type  PK" line; height depends on whether columns are shown.
  function boxSize(table, { showColumns = true } = {}) {
    const longest = Math.max(table.name.length + 4, ...table.columns.map(c => c.name.length + c.type.length + 6));
    const w = Math.max(BOX.minWidth, Math.ceil(longest * BOX.charWidth + 2 * BOX.padX + 24));
    const h = BOX.header + (showColumns ? table.columns.length * BOX.row + 6 : 0);
    return { w, h };
  }

  // Layer 0 = tables that reference nothing; each table sits one layer right of the deepest table it references.
  function layers(schema, hidden = new Set()) {
    const visible = schema.tables.filter(t => !hidden.has(t.name));
    const parents = name => schema.relationships.filter(r => r.from.table === name && r.to.table !== name && !hidden.has(r.to.table)).map(r => r.to.table);
    const memo = new Map();
    const depth = (name, path) => {
      if (memo.has(name)) return memo.get(name);
      if (path.has(name)) return 0; // cycle
      path.add(name);
      const ps = parents(name);
      const d = ps.length ? 1 + Math.max(...ps.map(p => depth(p, path))) : 0;
      path.delete(name);
      memo.set(name, d);
      return d;
    };
    const out = [];
    visible.forEach(t => { const d = depth(t.name, new Set()); (out[d] = out[d] || []).push(t); });
    return out.filter(Boolean);
  }

  // Returns { [tableName]: { x, y } } (top-left corners).
  function tidyLayout(schema, { showColumns = true, hidden = new Set() } = {}) {
    const cols = layers(schema, hidden);
    const sizes = new Map(schema.tables.map(t => [t.name, boxSize(t, { showColumns })]));
    const colHeight = col => col.reduce((s, t) => s + sizes.get(t.name).h, 0) + BOX.gapY * (col.length - 1);
    const tallest = Math.max(...cols.map(colHeight));
    const pos = {};
    let x = BOX.margin;
    for (const col of cols) {
      let y = BOX.margin + (tallest - colHeight(col)) / 2;
      const w = Math.max(...col.map(t => sizes.get(t.name).w));
      for (const t of col) {
        pos[t.name] = { x: Math.round(x), y: Math.round(y) };
        y += sizes.get(t.name).h + BOX.gapY;
      }
      x += w + BOX.gapX;
    }
    return pos;
  }

  // Where a link meets a box: the column's row (or the header when columns are hidden), on the left or right edge.
  function anchor(box, table, columnName, side, showColumns) {
    const i = table.columns.findIndex(c => c.name === columnName);
    const y = showColumns && i !== -1 ? box.y + BOX.header + i * BOX.row + BOX.row / 2 + 3 : box.y + BOX.header / 2;
    return { x: side === 'right' ? box.x + box.w : box.x, y, side };
  }

  // An orthogonal route from the FK row (many side) to the PK row (one side).
  // boxes: { x, y, w, h } for each end. showFrom/showTo: whether each table shows its columns.
  // Returns { points: [{x,y}...], fromSide, toSide }.
  function linkRoute(fromBox, fromTable, fromCol, toBox, toTable, toCol, showFrom = true, showTo = showFrom) {
    const fromCenter = fromBox.x + fromBox.w / 2;
    const toCenter = toBox.x + toBox.w / 2;
    const overlapX = fromBox.x < toBox.x + toBox.w && toBox.x < fromBox.x + fromBox.w;
    let fromSide;
    let toSide;
    if (overlapX) { fromSide = 'right'; toSide = 'right'; } else if (fromCenter < toCenter) { fromSide = 'right'; toSide = 'left'; } else { fromSide = 'left'; toSide = 'right'; }
    const a = anchor(fromBox, fromTable, fromCol, fromSide, showFrom);
    const b = anchor(toBox, toTable, toCol, toSide, showTo);
    const out = 28;
    const ax = a.x + (fromSide === 'right' ? out : -out);
    const bx = b.x + (toSide === 'right' ? out : -out);
    let points;
    if (fromSide === toSide) {
      const x = Math.max(ax, bx);
      points = [a, { x, y: a.y }, { x, y: b.y }, b];
    } else {
      const midX = Math.round((ax + bx) / 2);
      points = [a, { x: ax, y: a.y }, { x: midX, y: a.y }, { x: midX, y: b.y }, { x: bx, y: b.y }, b];
    }
    return { points: points.map(p => ({ x: p.x, y: p.y })), fromSide, toSide };
  }

  // Crow's foot marks at a line end. `p` is the point on the box edge; `side` is the edge it leaves from.
  // kind 'one' draws || (exactly one); kind 'many' draws o{ (zero or more).
  function crowFoot(p, side, kind) {
    const dir = side === 'right' ? 1 : -1;
    const at = d => p.x + dir * d;
    if (kind === 'one') {
      return { lines: [[at(8), p.y - 7, at(8), p.y + 7], [at(13), p.y - 7, at(13), p.y + 7]], circle: null };
    }
    return {
      lines: [[p.x, p.y - 7, at(12), p.y], [p.x, p.y + 7, at(12), p.y], [p.x, p.y, at(12), p.y]],
      circle: { cx: at(18), cy: p.y, r: 4.5 },
    };
  }

  const pathData = points => points.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');

  const api = { BOX, boxSize, layers, tidyLayout, linkRoute, crowFoot, pathData };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tools/sql-studio/test/erd-model.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Write `erd.js`**

`tools/sql-studio/src/erd.js`:

```js
// SQL Studio: the ERD panel. Draws the schema as SVG; tables drag, tidy, zoom, pan, pinch;
// Edit Links adds/removes relationships; PNG copies or downloads the picture.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, s, clear, icon, iconButton } = SS;
  const B = SS.BOX;

  const TIPS = {
    none: 'Pick a data set to begin.',
    view: 'Drag a table to move it. Pinch or use − / + to zoom.',
    edit: 'Drag from a foreign key to a primary key to add a link. Select a link and press Delete to remove it.',
  };

  function createErd(panel, { prefs, save, onChange }) {
    // ---- header controls ----
    const tip = h('span', { class: 'hint-text' }, icon('info'), h('span', null, TIPS.none));
    panel.headSlot.append(tip);
    const zoomOut = h('output', { 'aria-live': 'off' });
    const zoomGroup = h('span', { class: 'zoom', role: 'group', 'aria-label': 'Diagram zoom' },
      iconButton('minus', 'Zoom out', { onclick: () => zoomBy(-1) }), zoomOut, iconButton('plus', 'Zoom in', { onclick: () => zoomBy(1) }));
    const tidyBtn = h('button', { type: 'button', class: 'btn', title: 'Lay out the diagram neatly', onclick: () => { tidy(); SS.announce('Diagram tidied.'); } }, icon('tidy'), 'Tidy');
    const editBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => setEditing(!editing) }, icon('link'), 'Edit Links');
    const pngBtn = h('button', { type: 'button', class: 'btn', title: 'Copy the diagram as a picture', onclick: copyPng }, icon('image'), 'PNG');
    const attrBox = h('input', { type: 'checkbox', id: 'erd-attrs' });
    attrBox.checked = prefs.attributes;
    attrBox.addEventListener('change', () => { prefs.attributes = attrBox.checked; save(); render(); });
    panel.tools.append(zoomGroup, tidyBtn, editBtn, pngBtn, h('label', { class: 'check-label', for: 'erd-attrs' }, attrBox, 'Attributes'));

    // ---- canvas ----
    const viewport = s('g', { class: 'viewport' });
    const svg = s('svg', { role: 'group', 'aria-label': 'Entity relationship diagram' }, viewport);
    const canvas = h('div', { class: 'erd-canvas' }, svg);
    const chips = h('div', { class: 'erd-chips' });
    const note = h('div', { class: 'erd-note', hidden: true });
    const form = h('div', { class: 'erd-links-form', hidden: true });
    panel.body.append(canvas, chips, note, form);

    // ---- state ----
    let schema = null;
    let original = [];
    const positionsById = new Map();
    let pos = {};
    let hidden = new Set();
    let folded = new Set();
    let editing = false;
    let selected = null; // relationship index
    let view = { scale: prefs.erdZoom / 100, tx: 0, ty: 0 };
    let focusKey = null;

    const showCols = name => prefs.attributes && !folded.has(name);
    const boxOf = t => ({ ...pos[t.name], ...SS.boxSize(t, { showColumns: showCols(t.name) }) });
    const visibleTables = () => schema.tables.filter(t => !hidden.has(t.name));
    const visibleLinks = () => schema.relationships.map((r, i) => ({ r, i })).filter(({ r }) => !hidden.has(r.from.table) && !hidden.has(r.to.table));

    function counts() {
      return { tables: visibleTables().length, relationships: visibleLinks().length };
    }

    // ---- public ----
    function setSchema(next, { renamed = [] } = {}) {
      if (schema) positionsById.set(schema.id, { pos, hidden, folded });
      schema = next;
      original = next.relationships.map(r => JSON.parse(JSON.stringify(r)));
      const old = positionsById.get(next.id);
      // A new upload can reuse the id 'upload' with different tables; only reuse positions that still fit.
      const saved = old && next.tables.every(t => old.pos[t.name]) ? old : null;
      pos = saved ? saved.pos : SS.tidyLayout(next, { showColumns: prefs.attributes });
      hidden = saved ? saved.hidden : new Set();
      folded = saved ? saved.folded : new Set();
      selected = null;
      setEditing(false, { quiet: true });
      note.hidden = !renamed.length;
      note.replaceChildren(renamed.length ? `Renamed for SQL: ${renamed.slice(0, 6).map(r => `${r.from || '(blank)'} → ${r.to}`).join(', ')}${renamed.length > 6 ? ', …' : ''}` : '');
      render();
      fit();
    }

    function setEditing(on, { quiet = false } = {}) {
      editing = on;
      editBtn.setAttribute('aria-pressed', String(on));
      tip.lastChild.textContent = schema ? (on ? TIPS.edit : TIPS.view) : TIPS.none;
      form.hidden = !on;
      if (on) drawForm();
      selected = null;
      if (schema) render();
      if (!quiet) SS.announce(on ? 'Edit Links is on. ' + TIPS.edit : 'Edit Links is off.');
    }

    function tidy() {
      pos = SS.tidyLayout(schema, { showColumns: prefs.attributes, hidden });
      render();
      fit();
    }

    // ---- view transform ----
    function applyView() {
      viewport.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.scale})`);
      zoomOut.textContent = `${Math.round(view.scale * 100)}%`;
    }
    function zoomAt(newScale, cx, cy) {
      const sc = Math.min(SS.ERD_ZOOM.max / 100, Math.max(SS.ERD_ZOOM.min / 100, newScale));
      view.tx = cx - ((cx - view.tx) * sc) / view.scale;
      view.ty = cy - ((cy - view.ty) * sc) / view.scale;
      view.scale = sc;
      prefs.erdZoom = Math.round(sc * 100);
      save();
      applyView();
    }
    function zoomBy(dir) {
      const r = svg.getBoundingClientRect();
      zoomAt(SS.stepZoom(Math.round(view.scale * 100), dir, SS.ERD_ZOOM) / 100, r.width / 2, r.height / 2);
      SS.announce(`Diagram zoom ${Math.round(view.scale * 100)}%`);
    }
    // Centers the visible tables in the canvas at the current zoom.
    function fit() {
      const ts = visibleTables();
      if (!ts.length) { applyView(); return; }
      const boxes = ts.map(boxOf);
      const minX = Math.min(...boxes.map(b => b.x));
      const minY = Math.min(...boxes.map(b => b.y));
      const maxX = Math.max(...boxes.map(b => b.x + b.w));
      const maxY = Math.max(...boxes.map(b => b.y + b.h));
      const r = svg.getBoundingClientRect();
      view.tx = (r.width - (maxX - minX) * view.scale) / 2 - minX * view.scale;
      view.ty = Math.max(10, (r.height - (maxY - minY) * view.scale) / 2) - minY * view.scale;
      applyView();
    }

    // ---- drawing ----
    function render() {
      if (!schema) return;
      const active = document.activeElement;
      focusKey = active && svg.contains(active) ? active.getAttribute('data-key') : null;
      clear(viewport);
      const links = s('g', { class: 'links' });
      const tables = s('g', { class: 'tables' });
      viewport.append(links, tables);
      for (const { r, i } of visibleLinks()) links.append(drawLink(r, i));
      for (const t of visibleTables()) tables.append(drawTable(t));
      drawChips();
      applyView();
      if (focusKey) {
        const el = svg.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
        if (el) el.focus();
      }
      onChange(counts());
    }

    function drawLink(r, i) {
      const ft = schema.tables.find(t => t.name === r.from.table);
      const tt = schema.tables.find(t => t.name === r.to.table);
      const route = SS.linkRoute(boxOf(ft), ft, r.from.column, boxOf(tt), tt, r.to.column, showCols(ft.name), showCols(tt.name));
      const d = SS.pathData(route.points);
      const first = route.points[0];
      const last = route.points[route.points.length - 1];
      const many = SS.crowFoot(first, route.fromSide, 'many');
      const one = SS.crowFoot(last, route.toSide, 'one');
      const shapes = [...many.lines, ...one.lines].map(([x1, y1, x2, y2]) => s('line', { x1, y1, x2, y2 }));
      const label = `Link: ${r.from.table}.${r.from.column} to ${r.to.table}.${r.to.column}. Many ${r.from.table} rows to one ${r.to.table} row.`;
      const g = s('g', {
        class: `erd-link${editing ? ' editing' : ''}${selected === i ? ' selected' : ''}`, 'data-key': `link:${i}`,
        tabindex: editing ? '0' : null, role: editing ? 'button' : null, 'aria-label': label,
      }, s('title', null, label), s('path', { class: 'hit', d }), s('path', { class: 'line', d }), shapes,
      many.circle ? s('circle', { cx: many.circle.cx, cy: many.circle.cy, r: many.circle.r }) : null);
      if (editing) {
        g.addEventListener('click', e => { e.stopPropagation(); selected = i; render(); });
        g.addEventListener('keydown', e => {
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLink(i); }
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected = i; render(); }
        });
      }
      return g;
    }

    function drawTable(t) {
      const b = boxOf(t);
      const cols = showCols(t.name);
      const g = s('g', { class: 'erd-table', transform: `translate(${b.x} ${b.y})`, tabindex: '0', role: 'group', 'data-key': `table:${t.name}`,
        'aria-label': `${t.name} table, ${t.columns.length} columns. Arrow keys move it.` });
      g.append(s('rect', { class: 'box', width: b.w, height: b.h, rx: 10 }));
      g.append(s('rect', { class: 'head', x: 1, y: 1, width: b.w - 2, height: B.header - 2, rx: 9 }));
      g.append(s('text', { class: 'tname', x: B.padX, y: 22 }, t.name));
      g.append(tableButton(b.w - 54, cols ? 'chevron' : 'next', `${cols ? 'Hide' : 'Show'} the columns of ${t.name}`, `fold:${t.name}`, () => {
        if (folded.has(t.name)) folded.delete(t.name); else folded.add(t.name);
        render();
      }));
      g.append(tableButton(b.w - 28, 'eyeOff', `Hide the ${t.name} table`, `hide:${t.name}`, () => {
        hidden.add(t.name);
        render();
        SS.announce(`${t.name} is hidden. Use the Hidden chips to bring it back.`);
      }));
      if (cols) t.columns.forEach((c, i) => g.append(columnRow(t, c, i, b.w)));
      // Dragging by the header.
      g.addEventListener('pointerdown', e => {
        if (e.target.closest('.tbtn') || e.target.closest('.col-row.linkable')) return;
        e.stopPropagation();
        const start = { x: e.clientX, y: e.clientY, px: pos[t.name].x, py: pos[t.name].y };
        g.setPointerCapture(e.pointerId);
        g.classList.add('dragging');
        const move = ev => {
          pos[t.name] = { x: Math.round(start.px + (ev.clientX - start.x) / view.scale), y: Math.round(start.py + (ev.clientY - start.y) / view.scale) };
          g.setAttribute('transform', `translate(${pos[t.name].x} ${pos[t.name].y})`);
          redrawLinks();
        };
        const up = () => { g.classList.remove('dragging'); g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); render(); };
        g.addEventListener('pointermove', move);
        g.addEventListener('pointerup', up);
        g.addEventListener('pointercancel', up);
      });
      g.addEventListener('keydown', e => {
        if (e.target !== g) return;
        const d = e.shiftKey ? 50 : 10;
        const delta = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
        if (!delta) return;
        e.preventDefault();
        pos[t.name] = { x: pos[t.name].x + delta[0], y: pos[t.name].y + delta[1] };
        render();
      });
      return g;
    }

    function redrawLinks() {
      const g = viewport.querySelector('.links');
      clear(g);
      for (const { r, i } of visibleLinks()) g.append(drawLink(r, i));
    }

    function tableButton(x, iconName, label, key, act) {
      const g = s('g', { class: 'tbtn', transform: `translate(${x} 5)`, tabindex: '0', role: 'button', 'aria-label': label, 'data-key': key },
        s('title', null, label), s('rect', { width: 22, height: 22, rx: 5 }), s('path', { d: SS.ICON_PATHS[iconName], transform: 'translate(3 3) scale(.67)' }));
      g.addEventListener('click', e => { e.stopPropagation(); act(); });
      g.addEventListener('pointerdown', e => e.stopPropagation());
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); act(); } });
      return g;
    }

    function columnRow(t, c, i, w) {
      const y = B.header + i * B.row + 3;
      const badge = c.pk ? 'PK' : c.fk ? 'FK' : '';
      const g = s('g', { class: `col-row${editing && !c.pk ? ' linkable' : ''}`, 'data-table': t.name, 'data-col': c.name, transform: `translate(0 ${y})` },
        s('rect', { x: 2, y: 0, width: w - 4, height: B.row }),
        badge ? s('text', { class: c.pk ? 'badge-pk' : 'badge-fk', x: B.padX, y: 15 }, badge) : null,
        s('text', { x: B.padX + 26, y: 15 }, c.name),
        s('text', { class: 'ctype', x: w - B.padX, y: 15, 'text-anchor': 'end' }, c.type));
      if (editing && !c.pk) g.addEventListener('pointerdown', e => startLinkDrag(e, t, c));
      return g;
    }

    // ---- Edit Links: drag from a column to a primary key ----
    function startLinkDrag(e, t, c) {
      e.stopPropagation();
      e.preventDefault();
      const ghost = s('path', { class: 'erd-ghost' });
      viewport.append(ghost);
      const toLocal = ev => {
        const r = svg.getBoundingClientRect();
        return { x: (ev.clientX - r.left - view.tx) / view.scale, y: (ev.clientY - r.top - view.ty) / view.scale };
      };
      const b = boxOf(t);
      const startPt = { x: b.x + b.w, y: b.y + B.header + t.columns.indexOf(c) * B.row + B.row / 2 + 3 };
      let target = null;
      const move = ev => {
        const p = toLocal(ev);
        ghost.setAttribute('d', `M${startPt.x} ${startPt.y} L${p.x} ${p.y}`);
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = under && under.closest && under.closest('.col-row');
        svg.querySelectorAll('.col-row.target').forEach(el => el.classList.remove('target'));
        target = row && row.getAttribute('data-table') !== t.name ? row : null;
        if (target) target.classList.add('target');
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        ghost.remove();
        if (target) addLink(t.name, c.name, target.getAttribute('data-table'), target.getAttribute('data-col'));
        else render();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }

    // Returns a message if the link can't be made, or null if it was added.
    function addLink(fromTable, fromCol, toTable, toCol) {
      const ft = schema.tables.find(t => t.name === fromTable);
      const tt = schema.tables.find(t => t.name === toTable);
      const fc = ft && ft.columns.find(c => c.name === fromCol);
      const tc = tt && tt.columns.find(c => c.name === toCol);
      let problem = null;
      if (!fc || !tc || ft === tt) problem = 'Pick two columns in two different tables.';
      else if (!tc.pk) problem = `Drop on a primary key (PK) column. ${toTable}.${toCol} isn't one.`;
      else if (fc.type !== tc.type) problem = `${fromTable}.${fromCol} holds ${fc.type} values but ${toTable}.${toCol} holds ${tc.type} values, so they can't be linked.`;
      else if (schema.relationships.some(r => r.from.table === fromTable && r.from.column === fromCol)) problem = `${fromTable}.${fromCol} already has a link. Remove it first.`;
      if (problem) { SS.announce(problem); render(); if (!form.hidden) drawForm(problem); return problem; }
      fc.fk = { table: toTable, column: toCol };
      schema.relationships.push({ from: { table: fromTable, column: fromCol }, to: { table: toTable, column: toCol } });
      SS.announce(`Linked ${fromTable}.${fromCol} to ${toTable}.${toCol}.`);
      render();
      drawForm();
      return null;
    }

    function removeLink(i) {
      const r = schema.relationships[i];
      if (!r) return;
      const fc = schema.tables.find(t => t.name === r.from.table).columns.find(c => c.name === r.from.column);
      if (fc) fc.fk = null;
      schema.relationships.splice(i, 1);
      selected = null;
      SS.announce(`Removed the link from ${r.from.table}.${r.from.column} to ${r.to.table}.${r.to.column}.`);
      render();
      drawForm();
    }

    function resetLinks() {
      for (const t of schema.tables) for (const c of t.columns) c.fk = null;
      schema.relationships.length = 0;
      for (const r of original) {
        schema.relationships.push(JSON.parse(JSON.stringify(r)));
        const c = schema.tables.find(t => t.name === r.from.table).columns.find(x => x.name === r.from.column);
        c.fk = { table: r.to.table, column: r.to.column };
      }
      SS.announce('Links reset.');
      render();
      drawForm();
    }

    // The keyboard-friendly way to edit links.
    function drawForm(problem) {
      if (!schema) return;
      const opt = (t, c) => h('option', { value: `${t.name}\u0000${c.name}` }, `${t.name}.${c.name}`);
      const from = h('select', { 'aria-label': 'Link from (foreign key column)' }, schema.tables.flatMap(t => t.columns.filter(c => !c.pk).map(c => opt(t, c))));
      const to = h('select', { 'aria-label': 'Link to (primary key column)' }, schema.tables.flatMap(t => t.columns.filter(c => c.pk).map(c => opt(t, c))));
      const add = h('button', { type: 'button', class: 'btn', onclick: () => {
        const [ft, fc] = from.value.split('\u0000');
        const [tt, tc] = to.value.split('\u0000');
        addLink(ft, fc, tt, tc);
      } }, icon('plus'), 'Add');
      form.replaceChildren(
        h('h3', null, 'Links'),
        h('ul', null, schema.relationships.length ? schema.relationships.map((r, i) => h('li', null,
          h('span', { class: 'mono' }, `${r.from.table}.${r.from.column} → ${r.to.table}.${r.to.column}`),
          h('button', { type: 'button', class: 'btn', onclick: () => removeLink(i), 'aria-label': `Remove the link from ${r.from.table}.${r.from.column} to ${r.to.table}.${r.to.column}` }, 'Remove'))) : h('li', null, 'No links yet.')),
        h('p', { class: 'row' }, 'Add a link:', from, '→', to, add),
        problem ? h('p', { role: 'alert', class: 'added' }, problem) : null,
        h('p', null, h('button', { type: 'button', class: 'btn-link', onclick: resetLinks }, 'Reset links')));
    }

    function drawChips() {
      chips.replaceChildren(...[...hidden].map(name => h('span', { class: 'chip' }, `Hidden: ${name}`,
        iconButton('x', `Show the ${name} table`, { onclick: () => { hidden.delete(name); render(); SS.announce(`${name} is back.`); } }))));
    }

    // ---- pan, wheel zoom, pinch ----
    const pointers = new Map();
    let pinch = null;
    svg.addEventListener('pointerdown', e => {
      if (e.target.closest('.erd-table') || e.target.closest('.erd-link')) return;
      if (editing) { selected = null; render(); }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      svg.setPointerCapture(e.pointerId);
      canvas.classList.add('panning');
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const r = svg.getBoundingClientRect();
        zoomAt(pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (pointers.size === 1) {
        view.tx += e.clientX - prev.x;
        view.ty += e.clientY - prev.y;
        applyView();
      }
    });
    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) canvas.classList.remove('panning');
    };
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls the page as usual.
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(view.scale * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // ---- PNG ----
    const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-weight', 'opacity'];
    async function copyPng() {
      if (!schema) return;
      const ts = visibleTables();
      if (!ts.length) return;
      const boxes = ts.map(boxOf);
      const pad = 30;
      const minX = Math.min(...boxes.map(b => b.x)) - pad;
      const minY = Math.min(...boxes.map(b => b.y)) - pad;
      const w = Math.max(...boxes.map(b => b.x + b.w)) + pad - minX;
      const hgt = Math.max(...boxes.map(b => b.y + b.h)) + pad - minY;
      const clone = svg.cloneNode(true);
      // Copy computed colors and fonts so the picture matches the screen (and the current theme).
      const src = svg.querySelectorAll('*');
      const dst = clone.querySelectorAll('*');
      src.forEach((el, i) => {
        const cs = getComputedStyle(el);
        dst[i].setAttribute('style', STYLE_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';'));
      });
      clone.querySelector('.viewport').removeAttribute('transform');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', `${minX} ${minY} ${w} ${hgt}`);
      clone.setAttribute('width', String(w * 2));
      clone.setAttribute('height', String(hgt * 2));
      const bg = getComputedStyle(canvas).backgroundColor;
      clone.insertBefore(s('rect', { x: minX, y: minY, width: w, height: hgt, fill: bg }), clone.firstChild);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      try {
        const img = new Image();
        await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
        const cv = document.createElement('canvas');
        cv.width = w * 2;
        cv.height = hgt * 2;
        cv.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
        try {
          await root.navigator.clipboard.write([new root.ClipboardItem({ 'image/png': blob })]);
          SS.announce('Copied the diagram as a picture. Paste it anywhere.');
        } catch (e) {
          SS.downloadBlob(`erd-${schema.id}.png`, blob);
          SS.announce(`Your browser would not copy pictures, so we saved erd-${schema.id}.png instead.`);
        }
      } catch (e) {
        SS.announce('Sorry, the picture could not be made in this browser.');
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (root.ResizeObserver) new root.ResizeObserver(() => { if (schema && !panel.el.classList.contains('collapsed')) applyView(); }).observe(canvas);

    return { setSchema, tidy, fit, counts, addLink, removeLink };
  }

  root.SS = Object.assign(SS, { createErd });
})(this);
```

- [ ] **Step 6: Syntax-check, build, and run all tests**

Run: `node --check tools/sql-studio/src/erd.js && node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS (1 skipped).

- [ ] **Step 7: Commit**

```bash
git add tools/sql-studio/src/erd-model.js tools/sql-studio/src/erd.js tools/sql-studio/test/erd-model.test.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add ERD with crow's foot links, drag, tidy, zoom, Edit Links, and PNG"
```

---

### Task 18: Data preview and Upload

**Files:**
- Create: `tools/sql-studio/src/data-view.js`, `tools/sql-studio/src/upload.js`

**Interfaces:**
- Consumes: `runQuery`, `quoteIdent` (Tasks 3–4); `renderDataTable` (Task 14); `parseCSV`, `buildUploadSchema`, `UploadError`, `LIMITS` (Task 11); `window.XLSX` (SheetJS mini).
- Produces:
  - `SS.createDataView(panel): { setStudio(studio) }`.
  - `SS.pickUpload(): Promise<{ schema, renamed } | null>`, which throws `UploadError` with a student-facing message.
  - `SS.hasExcel(): boolean`.

**Notes:**
- The data tabs are a real `tablist`: arrow keys, Home, and End move between tabs, and the tabs use roving `tabindex`.
- If SheetJS is dropped (open question 1 in the spec), delete `sheetjs/xlsx.mini.min.js` from `VENDOR_JS` and from `VERSIONS.md`. `upload.js` already falls back to CSV only, with a clear message.

- [ ] **Step 1: Write `data-view.js`**

`tools/sql-studio/src/data-view.js`:

```js
// SQL Studio: the Data panel. A tab for each table; shows the first 10 rows and the total count.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, clear } = SS;
  const PREVIEW_ROWS = 10;

  function createDataView(panel) {
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Tables' });
    panel.headSlot.append(tabs);
    const body = h('div', { class: 'data-body', role: 'tabpanel', id: 'data-tabpanel', tabindex: '0' });
    panel.body.append(body);
    let studio = null;
    let selected = 0;

    function setStudio(st) {
      studio = st;
      selected = 0;
      drawTabs();
      show(0, false);
    }

    function drawTabs() {
      clear(tabs);
      studio.schema.tables.forEach((t, i) => tabs.append(h('button', {
        type: 'button', class: 'tab', role: 'tab', id: `data-tab-${i}`, 'aria-controls': 'data-tabpanel',
        'aria-selected': String(i === selected), tabindex: i === selected ? '0' : '-1', onclick: () => show(i, true),
        onkeydown: e => {
          const n = studio.schema.tables.length;
          const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          if (k) { e.preventDefault(); show((i + k + n) % n, true); }
          else if (e.key === 'Home') { e.preventDefault(); show(0, true); }
          else if (e.key === 'End') { e.preventDefault(); show(n - 1, true); }
        },
      }, t.name)));
    }

    function show(i, focusTab) {
      selected = i;
      drawTabs();
      if (focusTab) tabs.children[i].focus();
      const t = studio.schema.tables[i];
      body.setAttribute('aria-labelledby', `data-tab-${i}`);
      const q = SS.quoteIdent(t.name);
      const rows = SS.runQuery(studio, `SELECT * FROM ${q} LIMIT ${PREVIEW_ROWS}`);
      const total = SS.runQuery(studio, `SELECT COUNT(*) FROM ${q}`);
      clear(body);
      if (!rows.ok || !total.ok) { body.append(h('p', null, 'This table could not be shown.')); return; }
      const n = total.rows[0][0];
      body.append(h('p', { class: 'data-count' }, n <= PREVIEW_ROWS ? `Showing all ${n} rows of ${t.name}.` : `Showing ${PREVIEW_ROWS} of ${n.toLocaleString('en-US')} rows of ${t.name}.`));
      body.append(SS.renderDataTable(rows.columns, rows.rows, { caption: `First rows of the ${t.name} table` }));
    }

    return { setStudio };
  }

  root.SS = Object.assign(SS, { createDataView });
})(this);
```

- [ ] **Step 2: Write `upload.js`**

`tools/sql-studio/src/upload.js`:

```js
// SQL Studio: "Use my own data". Reads CSV files (our parser) and .xlsx files (SheetJS), then builds a schema.
(function (root) {
  'use strict';
  const SS = root.SS;

  const hasExcel = () => !!(root.XLSX && root.XLSX.read);

  function readAs(file, how) {
    return new Promise((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => bad(new SS.UploadError(`We couldn't read ${file.name}.`));
      if (how === 'text') r.readAsText(file); else r.readAsArrayBuffer(file);
    });
  }

  // Returns [{ name, rows }] for one file.
  async function sheetsFromFile(file) {
    if (file.size > SS.LIMITS.maxBytes) throw new SS.UploadError(`${file.name} is bigger than 5 MB. Try a smaller file.`);
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return [{ name: file.name, rows: SS.parseCSV(await readAs(file, 'text')) }];
    if (/\.xlsx$/i.test(file.name)) {
      if (!hasExcel()) throw new SS.UploadError('Excel files are not supported here. Save the sheet as .csv and upload that.');
      const wb = root.XLSX.read(await readAs(file, 'buffer'), { type: 'array', cellDates: true });
      return wb.SheetNames.map(name => ({ name, rows: root.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }) }));
    }
    throw new SS.UploadError(`${file.name} isn't a .csv${hasExcel() ? ' or .xlsx' : ''} file.`);
  }

  // Opens the file picker. Resolves to { schema, renamed } or null if the student cancels; throws UploadError.
  function pickUpload() {
    return new Promise((resolve, reject) => {
      const input = SS.h('input', { type: 'file', multiple: true, accept: hasExcel() ? '.csv,.xlsx,text/csv' : '.csv,text/csv', style: { display: 'none' } });
      input.addEventListener('change', async () => {
        const files = [...input.files];
        input.remove();
        if (!files.length) { resolve(null); return; }
        try {
          const sheets = (await Promise.all(files.map(sheetsFromFile))).flat();
          resolve(SS.buildUploadSchema(sheets));
        } catch (e) {
          reject(e instanceof SS.UploadError ? e : new SS.UploadError('Something went wrong reading that file.'));
        }
      });
      input.addEventListener('cancel', () => { input.remove(); resolve(null); });
      document.body.append(input);
      input.click();
    });
  }

  root.SS = Object.assign(SS, { pickUpload, hasExcel });
})(this);
```

- [ ] **Step 3: Syntax-check, build, and run all tests**

Run: `node --check tools/sql-studio/src/data-view.js && node --check tools/sql-studio/src/upload.js && node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS (1 skipped).

- [ ] **Step 4: Commit**

```bash
git add tools/sql-studio/src/data-view.js tools/sql-studio/src/upload.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: add Data preview tabs and CSV/Excel upload"
```

---

### Task 19: Wire it together

**Files:**
- Create: `tools/sql-studio/src/app.js`

**Interfaces:**
- Consumes: everything above.
- Produces: the running app. On load it decodes the wasm, calls `initSqlJs({ wasmBinary })`, builds the layout, loads data set 1, and wires everything:
  - **Run** (button and Ctrl/⌘+Enter) runs the statement at the cursor, after Tidy on Run.
  - **Format** reformats all statements.
  - **Check** compares the statement at the cursor with the answer.
  - **Copy for homework** runs the statement at the cursor and opens the dialog.
  - **Random Query** replaces the statement at the cursor.
  - **Upload** adds and selects "Your data".
  - **Switching data sets** saves the editor state through `sessions` and resets results, marks, and feedback.

- [ ] **Step 1: Write `app.js`**

`tools/sql-studio/src/app.js`:

```js
// SQL Studio: starts the app and wires the panels together.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon } = SS;
  const DATASETS = root.QE_DATASETS || [];

  const storage = () => { try { return root.localStorage; } catch (e) { return null; } };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const stripSemi = s => s.replace(/;\s*$/, '');

  function decodeBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function boot() {
    const appEl = document.getElementById('app');
    let SQL;
    try {
      SQL = await root.initSqlJs({ wasmBinary: decodeBase64(root.SS_WASM_BASE64) });
    } catch (e) {
      appEl.replaceChildren(h('p', { class: 'boot-note', role: 'alert' }, "SQL Studio couldn't start in this browser. Try an up-to-date Chrome, Edge, Firefox, or Safari."));
      return;
    }
    appEl.classList.remove('booting');
    appEl.replaceChildren();

    const prefs = SS.loadPrefs(storage());
    const L = SS.createLayout(appEl, prefs, p => SS.savePrefs(storage(), p));
    const sessions = SS.createSessions();
    const schemas = new Map(); // id -> schema (kept so ERD link edits last for the visit)
    let upload = null; // { schema, renamed }
    let studio = null;
    let currentId = null;

    // ---- header ----
    const sub = h('p', { class: 'sub', 'aria-live': 'polite' });
    const picker = h('select', { id: 'ds-picker', class: 'picker' });
    const desc = h('p', { class: 'picker-desc' });
    const uploadBtn = h('button', { type: 'button', class: 'btn', title: 'Use your own CSV or Excel data', onclick: onUpload }, icon('upload'), 'Upload');
    const uploadMsg = h('p', { class: 'picker-desc', role: 'alert' });
    L.header.append(
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, icon('db')), h('div', null, h('h1', null, 'SQL Studio'), sub)),
      h('div', { class: 'picker-wrap' }, h('div', { class: 'picker-row' }, h('label', { for: 'ds-picker' }, 'Data set'), picker, uploadBtn), desc, uploadMsg));
    function fillPicker() {
      picker.replaceChildren(...DATASETS.map(d => h('option', { value: d.id }, `${d.number}. ${d.name}`)),
        upload ? h('option', { value: 'upload' }, 'Your data') : null);
      picker.value = currentId || DATASETS[0].id;
    }
    picker.addEventListener('change', () => switchTo(picker.value));

    // ---- SQL panel ----
    const copyBtn = SS.iconButton('copy', 'Copy the SQL', { onclick: async () => SS.announce((await SS.copyText(editor.getText())) === 'copied' ? 'SQL copied.' : 'Your browser would not let us copy.') });
    const formatBtn = SS.iconButton('wand', `Format SQL (Shift+Alt+F)`, { onclick: formatAll });
    const toolbar = h('div', { class: 'panel-tools sql-toolbar', role: 'toolbar', 'aria-label': 'SQL tools' });
    L.sql.tools.prepend(toolbar);
    SS.createRandomControls(toolbar, { prefs, save: L.save, onGenerate: randomQuery });
    toolbar.append(copyBtn, formatBtn);
    const tidyBox = h('input', { type: 'checkbox', id: 'tidy-run' });
    tidyBox.checked = prefs.tidyOnRun;
    tidyBox.addEventListener('change', () => { prefs.tidyOnRun = tidyBox.checked; L.save(); });
    const runBtn = h('button', { type: 'button', class: 'btn primary', onclick: run, 'aria-keyshortcuts': SS.isMac ? 'Meta+Enter' : 'Control+Enter', title: `Run (${SS.modKey}+Enter)` }, 'Run ', icon('play'));
    const host = h('div', { class: 'editor-host' });
    L.sql.body.append(h('div', { class: 'run-row' }, h('label', { class: 'check-label', for: 'tidy-run' }, tidyBox, 'Tidy on Run'), runBtn), host);
    const editor = SS.createEditor(host, { onRun: run, onFormat: formatAll, onChange: text => { runBtn.disabled = !text.trim(); } });

    // ---- other panels ----
    const results = SS.createResults(L.results);
    const exercises = SS.createExercises(L.exercises, { onSelect: () => {}, onCheck: check, onHomework: homework });
    const erd = SS.createErd(L.erd, { prefs, save: L.save, onChange: c => { sub.textContent = `${plural(c.tables, 'table', 'tables')} · ${plural(c.relationships, 'relationship', 'relationships')}`; } });
    const dataView = SS.createDataView(L.data);
    L.onPanelToggle((key, collapsed) => { if (!collapsed && key === 'sql') editor.refresh(); if (!collapsed && key === 'erd') erd.fit(); });

    // ---- switching data sets ----
    function schemaFor(id) {
      if (id === 'upload') return upload.schema;
      if (!schemas.has(id)) schemas.set(id, SS.buildSchema(DATASETS.find(d => d.id === id)));
      return schemas.get(id);
    }

    function switchTo(id) {
      if (currentId) sessions.leave(currentId, { text: editor.getText(), cursor: editor.getCursor(), exerciseIndex: exercises.index });
      if (studio) SS.closeStudio(studio);
      currentId = id;
      const schema = schemaFor(id);
      studio = SS.openStudio(SQL, schema);
      const st = sessions.enter(id, schema);
      editor.setText(st.text, null, { keepHistory: false });
      editor.setCursor(st.cursor);
      editor.setSchema(schema);
      runBtn.disabled = !st.text.trim();
      results.showEmpty();
      const list = id === 'upload' ? [] : SS.EXERCISES[id] || [];
      exercises.setData({ schema, list, assessment: SS.isAssessment(schema.number), index: st.exerciseIndex });
      erd.setSchema(schema, { renamed: id === 'upload' ? upload.renamed : [] });
      dataView.setStudio(studio);
      desc.textContent = schema.description;
      fillPicker();
      SS.announce(`Loaded ${id === 'upload' ? 'your data' : `${schema.number}. ${schema.name}`}: ${plural(schema.tables.length, 'table', 'tables')}.`);
    }

    // ---- run, format, check ----
    // The statement at the cursor, after Tidy on Run (if on). Returns { text, start } or null.
    function currentStatement({ tidy }) {
      const full = editor.getText();
      let stmt = SS.statementAt(full, editor.getCursorIndex());
      if (!stmt) return null;
      if (tidy) {
        const lead = stmt.text.match(/^\s*/)[0];
        const trail = stmt.text.match(/\s*$/)[0];
        const body = stmt.text.slice(lead.length, stmt.text.length - trail.length);
        const pretty = SS.formatStatement(body);
        if (pretty !== body) {
          editor.replaceRange(stmt.start + lead.length, stmt.start + lead.length + body.length, pretty);
          stmt = { text: lead + pretty + trail, start: stmt.start };
          editor.setCursorIndex(stmt.start + lead.length + pretty.length);
        }
      }
      return stmt;
    }

    function showRunError(stmt, error) {
      const ex = SS.explainError(error, stmt ? stmt.text : '', studio.schema);
      const abs = stmt && ex.offset !== null ? stmt.start + ex.offset : null;
      editor.markError(abs, ex.length);
      const where = abs !== null ? SS.lineCol(editor.getText(), abs) : null;
      results.showError(ex, where, () => editor.setCursorIndex(abs));
      SS.announce(`Error. ${ex.headline}${where ? ` Line ${where.line}, column ${where.col}.` : ''}`);
    }

    function run() {
      const stmt = currentStatement({ tidy: prefs.tidyOnRun });
      if (!stmt) { showRunError(null, { kind: 'empty', message: '' }); return; }
      editor.flash(stmt.start, stmt.start + stmt.text.length);
      const r = SS.runQuery(studio, stmt.text);
      if (!r.ok) { showRunError(stmt, r.error); return; }
      editor.clearMarks();
      results.showResult(r);
      SS.announce(r.rows.length ? `Query ran: ${plural(r.rows.length, 'row', 'rows')}, ${plural(r.columns.length, 'column', 'columns')}.` : 'Query ran: no rows.');
    }

    function formatAll() {
      const before = editor.getText();
      const after = SS.formatSql(before);
      if (after !== before) editor.setText(after, Math.min(editor.getCursorIndex(), after.length));
      SS.announce('SQL formatted.');
    }

    function check(i) {
      const stmt = currentStatement({ tidy: false });
      const ex = SS.EXERCISES[currentId][i];
      if (!stmt) { exercises.setFeedback(i, { ok: false, message: 'Write a query in the SQL panel first, then check it.' }); return; }
      const res = SS.checkExercise(studio, stmt.text, ex);
      if (res.code === 'error') showRunError(stmt, res.error);
      else results.showResult(res.student);
      exercises.setFeedback(i, res);
    }

    function homework(opener) {
      const stmt = currentStatement({ tidy: false });
      const sql = stmt ? stmt.text.trim() : '';
      const result = stmt ? SS.runQuery(studio, stmt.text) : null;
      SS.showHomeworkDialog({ schema: studio.schema, list: currentId === 'upload' ? [] : SS.EXERCISES[currentId], index: exercises.index, sql: sql || '(no SQL yet)', result, opener });
    }

    // Replaces the statement at the cursor (or adds to the end) with a random query.
    function randomQuery(options) {
      const g = SS.generateQuery({ schema: studio.schema, run: q => SS.runQuery(studio, stripSemi(q)), options, seed: Math.floor(Math.random() * 2 ** 31) });
      const full = editor.getText();
      const stmt = SS.statementAt(full, editor.getCursorIndex());
      if (stmt) {
        const lead = stmt.text.match(/^\s*/)[0];
        const endsWithSemi = full.slice(stmt.start + stmt.text.length, stmt.end) === ';';
        const text = endsWithSemi ? stripSemi(g.sql) : g.sql;
        editor.replaceRange(stmt.start + lead.length, stmt.start + stmt.text.length, text);
        editor.setCursorIndex(stmt.start + lead.length);
      } else {
        const sep = full.trim() ? '\n\n' : '';
        editor.setText(full.replace(/\s*$/, '') + sep + g.sql, null);
      }
      SS.announce('A random query is in the editor. Press Run to try it.');
    }

    async function onUpload() {
      uploadMsg.textContent = '';
      try {
        const got = await SS.pickUpload();
        if (!got) return;
        if (currentId === 'upload') { sessions.leave('upload', { text: '' }); currentId = null; }
        sessions.forget('upload');
        upload = got;
        switchTo('upload');
      } catch (e) {
        uploadMsg.textContent = e.message;
      }
    }

    fillPicker();
    switchTo(DATASETS[0].id);
    editor.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(this);
```

- [ ] **Step 2: Build and run all tests**

Run: `node tools/sql-studio/build.js && node --test tools/sql-studio/test/`
Expected: all PASS, with **no skips** (the "every file in the load order exists" test now runs).

- [ ] **Step 3: Smoke-check in headless Chromium**

```bash
CH=$(ls -d ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium | tail -1)
"$CH" --headless=new --disable-gpu --no-first-run --user-data-dir="$(mktemp -d)" --hide-scrollbars \
  --window-size=1366,1100 --virtual-time-budget=8000 --screenshot=/tmp/sql-studio-smoke.png \
  "file://$PWD/tools/sql-studio/dist/sql-studio.html"
```

Open the screenshot. It should match spec §3: the header with the teal data set picker, the Exercises strip, SQL and Results side by side (the Results empty state is a dashed box, and Copy/Export are hidden), the ERD with three tables and two crow's-foot links, and the Data tabs. Repeat with `--force-dark-mode --blink-settings=preferredColorScheme=0` for dark mode.

- [ ] **Step 4: Commit**

```bash
git add tools/sql-studio/src/app.js tools/sql-studio/dist/sql-studio.html
git commit -m "SQL Studio: wire up the app: run, format, check, random, upload, data set switching"
```

---

### Task 20: Browser check: three widths, two themes, keyboard, contrast

**Files:**
- No repo files, unless the check finds problems. The script lives in the scratchpad.

**Interfaces:**
- Consumes: `dist/sql-studio.html`. Produces screenshots for David and a pass/fail list.

- [ ] **Step 1: Install `playwright-core` in a scratch folder (not the repo) and save the script**

```bash
CHECK=$(mktemp -d) && cd "$CHECK" && npm init -y >/dev/null && npm install --silent playwright-core@1.51.1 && cd -
```

`playwright-core` 1.51 matches the pre-installed `chromium-1161`. If `npm` reports a mismatch, pick the `playwright-core` version that matches the newest `~/Library/Caches/ms-playwright/chromium-*` folder.

Save this as `$CHECK/browser-check.js`:

```js
// SQL Studio browser check (not part of the repo). Usage:
//   node browser-check.js <path to dist/sql-studio.html> <output folder for screenshots>
// Needs playwright-core installed next to this script, and the pre-installed Playwright Chromium.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright-core');

const [, , htmlPath, outDir] = process.argv;
const url = 'file://' + path.resolve(htmlPath);
fs.mkdirSync(outDir, { recursive: true });
const cache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
const chromeDir = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(cache, chromeDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');

const SIZES = [
  { name: 'laptop', viewport: { width: 1366, height: 800 } },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
];
const problems = [];
const fail = (where, msg) => { problems.push(`${where}: ${msg}`); console.log(`  ✗ ${msg}`); };
const ok = msg => console.log(`  ✓ ${msg}`);

const setSql = (page, text) => page.evaluate(t => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue(t); cm.setCursor(cm.lineCount(), 0); cm.focus(); }, text);
const getSql = page => page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());

// Every visible text element: its color against the first solid background behind it.
const CONTRAST = () => {
  const parse = c => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0.9) return c; } return [255, 255, 255]; };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || el.closest('[hidden],.sr-only,svg,.CodeMirror-measure')) continue;
    if (el.closest('button:disabled')) continue;
    const a = lum(parse(cs.color));
    const b = lum(bgOf(el));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (big ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 30)}" (${el.tagName.toLowerCase()}.${el.className})`);
  }
  return [...new Set(out)].slice(0, 15);
};

(async () => {
  const browser = await chromium.launch({ executablePath });
  for (const size of SIZES) for (const scheme of ['light', 'dark']) {
    const where = `${size.name}-${scheme}`;
    console.log(where);
    const ctx = await browser.newContext({ viewport: size.viewport, hasTouch: !!size.hasTouch, isMobile: !!size.isMobile, colorScheme: scheme, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    ok('loaded');
    await page.screenshot({ path: path.join(outDir, `${where}-1-start.png`), fullPage: size.name !== 'laptop' });

    // Run a query with Ctrl+Enter.
    await setSql(page, 'select artist_name, genre from Artists where genre = \'Pop\'');
    await page.keyboard.press('Control+Enter');
    const count = await page.textContent('.res-count');
    (/2 rows × 2 columns/.test(count) ? ok : m => fail(where, m))(`run: "${count}"`);
    (/^SELECT artist_name, genre\nFROM Artists\nWHERE genre = 'Pop'/.test(await getSql(page)) ? ok : m => fail(where, m))('Tidy on Run formatted the query');

    // Error box with location.
    await setSql(page, 'SELECT artist_nme\nFROM Artists');
    await page.click('.run-row .btn.primary');
    const err = await page.textContent('.err-box');
    (/no column called artist_nme/.test(err) && /Line 1, column 8/.test(err) ? ok : m => fail(where, m))(`error box: ${err.slice(0, 90)}`);
    if (await page.$('.cm-error-mark')) ok('error underlined in editor'); else fail(where, 'no error mark');
    if (size.name === 'laptop') await page.screenshot({ path: path.join(outDir, `${where}-2-error.png`) });

    // Check my answer on 1.1.
    await page.click('.ex-strip .chev');
    await setSql(page, "SELECT a.artist_name, SUM(s.stream_count) FROM Streams s JOIN Songs so ON so.song_id = s.song_id JOIN Artists a ON a.artist_id = so.artist_id WHERE s.stream_date BETWEEN '2026-03-01' AND '2026-03-31' GROUP BY a.artist_name");
    await page.click('.ex-item:first-child .ex-actions .btn:last-child');
    const fb = await page.textContent('.ex-item:first-child .ex-feedback');
    (/Nice! Your result matches/.test(fb) ? ok : m => fail(where, m))(`check: ${fb}`);
    if (size.name === 'laptop') await page.screenshot({ path: path.join(outDir, `${where}-3-check.png`) });
    await page.click('.ex-strip .chev');

    // Random query runs.
    for (let i = 0; i < 5; i++) {
      await page.click('text=Random Query');
      await page.click('.run-row .btn.primary');
      if (await page.$('.err-box')) fail(where, `random query failed: ${await getSql(page)}`);
    }
    ok('5 random queries ran');

    // Drag an ERD table.
    const t = await page.$('.erd-table');
    const before = await t.getAttribute('transform');
    const box = await t.boundingBox();
    await page.mouse.move(box.x + 30, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 52, { steps: 5 });
    await page.mouse.up();
    const after = await page.$eval('.erd-table', el => el.getAttribute('transform'));
    (before !== after ? ok : m => fail(where, m))(`ERD drag ${before} → ${after}`);

    // Switch data sets and back: text kept.
    await setSql(page, 'SELECT 42 AS answer');
    await page.selectOption('#ds-picker', 'concert');
    await page.selectOption('#ds-picker', 'spotify');
    ((await getSql(page)) === 'SELECT 42 AS answer' ? ok : m => fail(where, m))('editor text kept per data set');
    if (await page.$('.err-box')) fail(where, 'old error still shown after switching');

    const low = await page.evaluate(CONTRAST);
    (low.length ? m => fail(where, m) : ok)(low.length ? `low contrast:\n    ${low.join('\n    ')}` : 'contrast AA');
    await page.screenshot({ path: path.join(outDir, `${where}-4-end.png`), fullPage: size.name !== 'laptop' });
    if (errors.length) fail(where, `console errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  // Keyboard-only pass (laptop, light): Tab through the page and record where focus goes.
  console.log('keyboard');
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('.CodeMirror');
  const stops = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const el = document.activeElement;
      const outline = getComputedStyle(el).outlineStyle;
      return `${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24) || el.tagName}${outline === 'none' && !el.closest('.CodeMirror') ? ' [NO RING]' : ''}`;
    }));
    if (i === 12) await page.screenshot({ path: path.join(outDir, 'keyboard-focus.png') });
  }
  console.log('  focus order: ' + stops.join(' → '));
  if (!stops.some(s => /SQL editor/.test(s))) fail('keyboard', 'never reached the editor');
  if (stops.some(s => /NO RING/.test(s))) fail('keyboard', 'a focused control has no visible ring');
  // From the editor, Ctrl+Enter runs and Tab leaves.
  await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.focus());
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('Tab');
  const left = await page.evaluate(() => !document.activeElement.closest('.CodeMirror'));
  (left ? ok : m => fail('keyboard', m))('Tab leaves the editor');
  await ctx.close();
  await browser.close();
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll checks passed.');
  process.exit(problems.length ? 1 : 0);
})();
```

- [ ] **Step 2: Run it**

```bash
node "$CHECK/browser-check.js" tools/sql-studio/dist/sql-studio.html "$CHECK/shots"
```

Expected: `All checks passed.` It covers laptop (1366×800), tablet (820×1180, touch), and phone (390×844), each in light and dark mode:
- running with Ctrl+Enter, plus Tidy on Run;
- the error box with "Line 1, column 8" and the editor underline;
- Check my answer on 1.1;
- five random queries;
- dragging an ERD table;
- switching data sets and back;
- WCAG AA contrast on all visible text;
- no console errors;
- a keyboard pass: the focus order reaches the editor, every stop has a visible ring, and Tab leaves the editor.

- [ ] **Step 3: Fix what it finds, one commit per fix**

Use superpowers:systematic-debugging for any failure. The usual suspects:
- **Low contrast:** use a darker `-ink` token in light mode, or the light token in dark mode.
- **Phone overflow:** add `min-width:0` or wrap toolbars.

Re-run until it passes. Commit each fix as `SQL Studio: fix <what>`.

- [ ] **Step 4: Manual checks the script can't do**

These need a person (or `mcp__Claude_Browser__*` tools):
- Autocomplete: type `SELECT * FROM Songs s WHERE s.` and confirm that Songs' columns are suggested.
- Number display: hover over a numeric header, open ⋯, turn on thousands separators, and set 2 decimals.
- Paging: run `SELECT * FROM Streams a, Streams b` (576 rows) and step through the pages.
- Copy TSV into a spreadsheet, and Export CSV.
- ERD: Edit Links (add and remove a link, plus the keyboard form), hide or show a table, Attributes, Tidy, PNG (clipboard and download fallback), and pinch on a tablet or simulator.
- Upload: try a two-file CSV (customers and orders) and an `.xlsx` with two sheets.
- Copy for homework: on 1.1, and on "Your data".
- Collapse, resize, and zoom each panel, reload, and confirm the layout is remembered. Then block site data and confirm the tool still works.
- `prefers-reduced-motion`: the run flash and transitions are instant.

- [ ] **Step 5: Send the screenshots to David**

Send `$CHECK/shots/*.png` (laptop/tablet/phone × light/dark, plus `keyboard-focus.png`) with `SendUserFile`, including a one-line caption per group.
---

### Task 21: Course integration and publishing

**Files:**
- Modify: `tools/index.html` (add a Chapter 8 section after Chapter 7)
- Modify: `chapter-08.md` (activities intro and a new Activity 8.0)
- Publish: `gh-pages` branch: `sql-studio.html` and `index.html` (**only after David says yes**)

**Interfaces:**
- Consumes: `dist/sql-studio.html`.

- [ ] **Step 1: Add the Chapter 8 section to `tools/index.html`** (insert after the Chapter 7 `</section>`)

```html
  <section>
    <h2><span class="chapter">Chapter 8</span> Introduction to SQL with AI Assistance</h2>
    <p class="about">Write real SQL against the same ten data sets you used in the Query Explorer. This is Activity 8.0 in the chapter.</p>
    <ul>
      <li><a href="sql-studio.html"><span class="top"><strong>SQL Studio</strong><span class="use">Use with Chapter 8</span></span><span class="desc">Write and run SQL queries, see the results and a diagram of the tables, and check your answers to practice exercises.</span></a></li>
    </ul>
  </section>
```

- [ ] **Step 2: Add Activity 8.0 to `chapter-08.md`**

Change the activities intro (the paragraph under `## Interactive Activities`) to end with: "Activity 8.0 is the one exception: it uses an interactive tool instead of a prompt." Then insert this before `### Activity 8.1`, matching Activity 7.0's markup:

```markdown
### Activity 8.0 - SQL Studio

<blockquote>
<div class="textbox shaded">

<p>Practice writing real SQL queries - SELECT, WHERE, JOIN, GROUP BY, and more - against the same data sets you used in the Query Explorer, using this interactive tool.</p>

<p><a href="https://kalendar.github.io/relational-thinking/sql-studio.html">https://kalendar.github.io/relational-thinking/sql-studio.html</a></p>

</div></blockquote>

---

```

- [ ] **Step 3: Commit on `master`**

```bash
git add tools/index.html chapter-08.md
git commit -m "Chapter 8: add Activity 8.0 and the SQL Studio entry on the tools page"
```

- [ ] **Step 4: Ask David before publishing**

Publishing pushes to the public `gh-pages` branch of `kalendar/relational-thinking`. Show David the exact files that will be published (`sql-studio.html`, `index.html`) and wait for a clear yes.

- [ ] **Step 5: Publish (after the yes)**

```bash
WT=$(mktemp -d)/gh-pages
git worktree add "$WT" gh-pages
cp tools/sql-studio/dist/sql-studio.html "$WT/sql-studio.html"
cp tools/index.html "$WT/index.html"
git -C "$WT" add sql-studio.html index.html
git -C "$WT" commit -m "Publish SQL Studio (Chapter 8)"
git -C "$WT" push origin gh-pages
git worktree remove "$WT"
```

After the push, open `https://kalendar.github.io/relational-thinking/sql-studio.html`, give GitHub Pages a minute, and confirm that the page loads data set 1.
---

## Spec coverage check (done while writing this plan)

| Spec section | Task(s) |
|---|---|
| §2 Delivery: single file, vendored and pinned libraries, wasm inlined, data sets read in place, fonts only | 1, 12 (build tests) |
| §2 CodeMirror 5 vs. 6 | 14 (CodeMirror 5, no bundler) |
| §3 Header, Exercises strip, SQL/Results with splitter, ERD, Data, look and feel, stacking under 760px | 12, 13, 15, 19, 20 |
| §4 Schema types and keys, read-only, per-data-set editor text | 3, 4, 13, 19 |
| §5 Editor: autocomplete, Ctrl+Enter, statement at cursor, Format, Tidy on Run, errors with line and column | 2, 5, 6, 14, 19 |
| §6 Exercises: format, 60 seeded, hints for 1–6 only, Check feedback, Copy for homework | 7, 8, 10, 15, 19 |
| §7 Random query generator and Complexity | 9, 16 |
| §8 Results (paging, counts, number display, Copy/CSV), ERD (crow's foot, drag, tidy, zoom, pinch, hide, Edit Links, PNG), Data preview | 14, 17, 18 |
| §9 Upload (CSV parser, SheetJS, names, types, key guessing, limits) | 11, 18 |
| §10 Layout persistence, accessibility, reduced motion | 13, 12 (CSS), 20 |
| §12 Testing | every task, plus 20 |
| §13 Course integration and publishing | 21 |

Before this plan was written, the code for Tasks 2–19 was run in a scratch copy:
- All 104 Node tests passed. The only failure was the vendor-hash test, which fails there only because the scratch copy has no `VERSIONS.md`.
- The built page loaded in headless Chromium with no console errors, in light and dark mode.
- The browser-check script in Task 20 has **not** been run yet.
