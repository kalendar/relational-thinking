# SQL Studio: Design Spec

**Date:** 2026-10-19
**Status:** Draft for review
**Textbook link:** Chapter 8, *Introduction to SQL with AI Assistance* (sections 8.1–8.4)
**Follows:** the Query Explorer (`tools/query-explorer/`, spec `2026-10-13-query-operations-explorer-design.md`)

## 1. Purpose

SQL Studio is a browser tool where students write real SQL against the same ten data sets they used in the Query Explorer. In Chapter 7 they built queries from four operations without seeing SQL. Now they type the SQL themselves, run it, read the result, and check it.

**Success looks like:** a student can do these things on their own.
- Write a `SELECT … FROM … WHERE` query, run it, and ask "does this row count make sense?" (8.2).
- Turn a Chapter 7 plan (filter, project, join, aggregate) into SQL (8.1).
- Use the ERD to give an AI the schema (8.3).
- Paste in SQL they didn't write, run it, and judge whether it answers the question (8.4).

**Audience:** undergraduate business students, ages 18–25. Many are writing SQL for the first time. All on-screen text is at a 10th-grade reading level: short, friendly, and any jargon is explained.

**Use:** practice, not grading. Data sets 7–10 are kept free of hints and answer checks so instructors can use them as assessment, the same as in the Query Explorer.

## 2. Delivery

- The deliverable is one self-contained file, `tools/sql-studio/dist/sql-studio.html`. It works when opened from a local disk and when hosted at `https://kalendar.github.io/relational-thinking/sql-studio.html`.
- The only network request is Google Fonts (Montserrat, Nunito Sans), with system-font fallbacks.
- Primary target is a laptop-width browser (1024px and up). It also works on a tablet (touch, plus pinch-to-zoom on the ERD). On a phone it is usable, with the panels stacked.
- The look matches the Query Explorer and `tools/index.html`: the same CSS color tokens (copied from the Query Explorer's `styles.css`), the same fonts, and the same dark mode.

### Vendored libraries (pinned, in `tools/sql-studio/vendor/`)

| Library | Version | Files | Size in page |
|---|---|---|---|
| sql.js (SQLite in WebAssembly) | **1.14.2** (Aug 2026) | `sql-wasm.js`, `sql-wasm.wasm` | 47 KB JS + 877 KB (wasm as base64) |
| CodeMirror 5 | **5.65.21** | `lib/codemirror.js`, `lib/codemirror.css`, `mode/sql/sql.js`, `addon/hint/show-hint.js` + `.css`, `addon/hint/sql-hint.js`, `addon/selection/active-line.js` | ≈ 500 KB |
| SheetJS "mini" (Excel upload) | **0.20.3** from `cdn.sheetjs.com` | `xlsx.mini.min.js` | ≈ 260 KB |

- **sql.js version:** 1.15.0 and 1.15.1 came out in the last five days, so we pin 1.14.2, the last release that has been out for a while. `vendor/VERSIONS.md` records each file's version, source URL, and SHA-256 hash.
- **Total size:** about 1.7 MB, or about 1.45 MB without SheetJS. That is fine for a page loaded once from GitHub Pages.
- **SheetJS:** we use 0.20.3 from SheetJS's own CDN, not the npm `xlsx` package. The npm package is stuck at 0.18.5, which has known security problems when reading crafted files. The "mini" build reads `.xlsx` and adds about 18% to the file. **Recommendation:** include it, because most students keep data in Excel or Google Sheets (which exports `.xlsx`). If you'd rather keep the file smaller, we can drop it and accept CSV only. Section 11 lists this as an open question.
- **sql.js loading:** `build.js` base64-encodes `sql-wasm.wasm` into the page. At startup the app decodes it and calls `initSqlJs({ wasmBinary })`, so nothing is fetched at run time and opening from a local disk works.

**CodeMirror 5 vs. 6.** We use **CodeMirror 5**. It ships as plain browser scripts that can be pasted into the page in order, which is exactly how `build.js` already works. CodeMirror 6 is a set of ES modules that would need a bundler (esbuild or rollup), and so an npm install step and a build toolchain the course repo doesn't have today. CodeMirror 6 is better with screen readers and phone keyboards. We get most of that benefit in CodeMirror 5 with `inputStyle: 'contenteditable'` and `screenReaderLabel`, and by letting Tab move focus out of the editor (see §5). Revisit CodeMirror 6 only if testing on tablets shows real problems.

### Source layout

Logic lives in small pure files that load in Node for tests. DOM code is kept separate. Everything joins one namespace, `window.SS`, the way the Query Explorer uses `window.QE`.

```
tools/sql-studio/
  build.js                 # inlines vendor + src into dist/sql-studio.html;
                           # reads ../query-explorer/src/datasets/*.js directly
  vendor/                  # pinned libraries + VERSIONS.md
  src/
    index.html  styles.css
    exercises.js           # SQL Studio's exercises, keyed by data set id (hand-editable)
    -- pure (Node-testable) --
    sql-text.js            # tokenizer, split statements, find statement at cursor, alias map
    schema.js              # data set -> CREATE TABLE / INSERT; relationships; ERD model
    db.js                  # open a database, run a statement, read-only guard (wraps sql.js)
    errors.js              # rewrite SQLite errors into plain words + locate them (line/col)
    format.js              # SQL pretty-printer
    check.js               # compare student result with expected result
    randomq.js             # random query generator
    export.js              # TSV, CSV, homework plain text
    upload-parse.js        # CSV parser, type inference, name cleanup, key guessing
    -- DOM --
    dom.js  icons.js       # h() helper (no innerHTML), inline SVG line icons
    layout.js              # panels, splitters, collapse, per-panel zoom, localStorage
    editor.js              # CodeMirror setup, autocomplete, error marks, Run/Format
    results-view.js        # results table, paging, number display options, copy/export
    erd.js                 # SVG diagram: draw, drag, tidy, zoom/pan/pinch, links, PNG
    data-view.js           # table tabs, first 10 rows
    exercises-view.js      # Exercises strip, hints, Check my answer
    export-dialog.js       # "Copy for homework" (adapted from the Query Explorer's)
    upload.js              # file picker -> new database
    app.js                 # state + wiring
  test/                    # node:test, using only vendored sql.js
  dist/sql-studio.html
```

The data sets are **not copied**. `build.js` reads `../query-explorer/src/datasets/*.js` (sorted by file name) on every build, and the tests `require()` them from the same place. If a data set is edited there, both tools pick up the change on the next build.

## 3. Screen layout

The layout follows the original SQL Studio, using this book's colors and fonts.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [db] SQL Studio                  [Data set: 1. Spotify Streams ▾] [Upload]   │
│      3 tables · 2 relationships  Artists · Songs · Streams                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [v] Exercises (6)   1.1  How many total streams did each artist have…        │
├─────────────────────────────────────────┬┬───────────────────────────────────┤
│ [v] SQL   [-] 100% [+]  [Random Query]  ││ [v] Results          [-] 100% [+] │
│           [Complexity] [Copy] [wand]    ││   7 rows × 2 columns  [Copy] [CSV]│
│              ☑ Tidy on Run    [▶ Run]   ││ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ 1 │ SELECT …                            ││   Run a query to display results. │
├─────────────────────────────────────────┴┴───────────────────────────────────┤
│ [v] ERD  (i) tip…   [-] 100% [+] [Tidy] [Edit Links] [PNG] ☑ Attributes      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [v] Data   [Artists] [Songs] [Streams]   Showing 8 of 8 rows                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Header
- A database icon, the title **SQL Studio**, and a live subtitle: "3 tables · 2 relationships". The counts update when the student hides tables or edits links.
- **Data set picker** (filled teal; the main action in the header): a `<select>` labeled "Data set" listing `1. Spotify Streams` … `10. Music Festival Lineup`, plus "Your data" after an upload. The set's `description` line sits under it.
- **Upload** (outlined, small). See §9.
- A small note at the bottom of the page, as in the Query Explorer: "Real names, made-up numbers. All data is invented for practice."
- Data set 1 loads when the page opens.

### Exercises strip
A full-width collapsible strip. Collapsed (the default), it shows "Exercises (6)" and the current exercise on one line, for example "1.1 How many total streams did each artist have in March 2026?". Expanded, it shows the full list (§6).

### SQL panel (left) and Results panel (right)
- The two panels sit side by side, with a draggable vertical splitter between them.
- Each panel header has a collapse chevron, an icon, a bold name, and its own text zoom (`−`, percentage, `+`, from 70% to 200%).
- The SQL toolbar has, in order: **Random Query**, **Complexity** (a popover of checkboxes, §7), **Copy** (copies the SQL), and **Format** (magic wand icon, labeled "Format SQL" for screen readers).
- Below the toolbar, right-aligned, are a **Tidy on Run** checkbox (on by default) and the teal **Run ▶** button. Run is disabled while the editor is empty. Its tooltip and `aria-keyshortcuts` say "Ctrl+Enter" (or "⌘+Enter" on a Mac).
- The editor has line numbers, and the current line is highlighted.
- The Results panel shows a dashed-border empty state, "Run a query to display results.", until the first run.

### ERD panel
- Full width, below a draggable horizontal splitter.
- The header has the chevron, the label "ERD", and a status hint. The hint reads "Pick a data set to begin." until a diagram is drawn, then shows tips that change with the mode: "Drag a table to move it. Pinch or use − / + to zoom." In Edit Links mode it reads "Drag from a foreign key to a primary key to add a link. Select a link and press Delete to remove it."
- On the right: zoom controls, **Tidy**, **Edit Links** (a toggle button, `aria-pressed`), **PNG**, and an **Attributes** checkbox.
- The canvas has a light dotted-grid background.

### Data panel
Full width, below the ERD, with its own splitter. It has a tab for each table and shows the first 10 rows (or all of them if there are fewer), with "Showing 10 of 24 rows."

### Look and feel
- White cards with thin borders and rounded corners (`--radius`) on the near-white page (`--bg`).
- Buttons are outlined. The only filled buttons are the data set picker and Run, both in `--teal`.
- Icons are simple line icons drawn as inline SVG with `stroke="currentColor"`: database, chevron, play, wand, dice, sliders, copy, download, upload, key, link, image, plus, minus, info, check, and lightbulb.
- In dark mode, everything uses the dark tokens. CodeMirror gets a matching theme built from the same tokens, so there is no second palette.
- Below 760px, the panels stack in this order: Exercises, SQL, Results, ERD, Data. Splitters are hidden, and each panel takes its natural height (the ERD gets a fixed 360px).

## 4. Data and the database

### Building the database from a data set (`schema.js`)
Each switch builds a fresh in-memory SQLite database from the set's `tables`.

| Data set type | SQLite type |
|---|---|
| `number`, all whole numbers | `INTEGER` |
| `number`, any value with decimals | `REAL` |
| `text` | `TEXT` |
| `date` | `TEXT` holding `YYYY-MM-DD` (so `BETWEEN '2026-03-01' AND '2026-03-31'` and `strftime` work) |

- `key: 'pk'` becomes `PRIMARY KEY`.
- `key: 'fk', ref: 'X'` becomes `REFERENCES X(<X's primary key>)`.
- Tables are created in an order where parent tables come before child tables, and rows are inserted with prepared statements.
- **Relationships** come from the `fk` metadata: `{ from: { table, column }, to: { table, column } }`. They drive the ERD, the header count, and the random generator's joins.
- The Query Explorer-only fields (`start`, `questions`, `recipe`) are ignored.

### Read-only queries
SQL Studio runs only statements that read data: `SELECT`, `WITH … SELECT`, and `VALUES`. The database also runs with `PRAGMA query_only = ON` as a second guard. If a student types `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, or `ALTER`, they get a friendly message: "SQL Studio only runs queries that read data (SELECT). Changing data comes later in the course." This keeps every data set unchanged, so exercise checks stay correct. Section 11 lists this as an open question.

### Editor text per data set
Each data set (and "Your data") keeps its own editor text and cursor for the session, in memory. Switching back restores it. Data set 1 starts with a short sample query and a comment:

```sql
-- Write a query, then press Run (or Ctrl+Enter).
SELECT *
FROM Artists;
```

Each set's sample uses its first table.

## 5. SQL editor

- **CodeMirror 5** with `mode: 'text/x-sqlite'`, line numbers, `styleActiveLine`, `matchBrackets`, `inputStyle: 'contenteditable'`, and `screenReaderLabel: 'SQL editor'`.
- **Autocomplete** uses `show-hint` and `sql-hint`, with `tables` set to the current set's `{ Table: [columns] }` and `completeSingle: false`. Hints open automatically after a letter or `.` is typed (after a short pause) and with Ctrl+Space. After `Table.` or `alias.`, `sql-hint` already resolves the alias from the FROM/JOIN clause and suggests that table's columns. Keyword suggestions come from the SQLite mode.
- **Keys:** Ctrl/Cmd+Enter runs the query. Shift+Alt+F formats. Tab and Shift+Tab are **not** captured by the editor (`extraKeys: { Tab: false, 'Shift-Tab': false }`), so keyboard users can always Tab out. Indentation comes from Format.
- **Which statement runs:** `sql-text.js` splits the text on `;`, ignoring semicolons inside strings, quoted names, and comments, and runs the statement the cursor is in. If the cursor sits after the last `;`, it runs the statement just before it. That statement is briefly highlighted when it runs. Comment-only or empty text gives "There's no query here to run."
- **Format (`format.js`):** a tokenizer-based pretty-printer in the book's style (8.2).
  - Keywords are written in UPPERCASE.
  - Each main clause starts a new line: `SELECT`, `FROM`, each `JOIN`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`.
  - When there are several select items, each goes on its own indented line.
  - Each `AND` and `OR` at the top level of `WHERE`/`HAVING` goes on its own indented line.
  - Strings, quoted names, numbers, and comments are kept exactly. Parentheses (subqueries, `IN (…)`) are indented one level.
  - Formatting is idempotent: formatting twice gives the same text.
  - Formatting never changes what a query returns. Tests check this for every exercise answer and hundreds of random queries.
  - When the editor holds several statements, Format reformats all of them. **Tidy on Run** formats only the statement being run, then runs it.

### Errors (`errors.js`)
Errors appear in a red-bordered box (`role="alert"`) above the results. The box has three parts:
1. A plain-words headline.
2. "Line 3, column 8" (a link-styled button that moves the cursor there).
3. SQLite's original message in small text, labeled "What SQLite said", because that's the text students would search for.

The spot is marked in the editor with a wavy underline (`markText`) and a gutter marker, and both clear on the next edit.

sql.js doesn't report where an error happens, so `errors.js` finds the spot by matching the error to tokens in the failing statement. It knows the alias map (`FROM Players p` makes `p` mean `Players`).

| SQLite says | Students see | Where |
|---|---|---|
| `no such column: p.address` | There's no column called `address` in the `Players` table. | the `p.address` token |
| `no such column: address` | There's no column called `address` in the tables this query uses. Check the spelling, or look at the ERD. | first `address` token |
| `no such table: Artist` | There's no table called `Artist`. Did you mean `Artists`? (the closest name, if one is close) | the `Artist` token |
| `near "FORM": syntax error` | SQL didn't understand the word `FORM`. Did you mean `FROM`? (closest keyword, if one is close) | the first `FORM` token |
| `near "X": syntax error` (general) | SQL got confused at `X`. Check the word just before it: a missing comma, quote, or keyword is common. | the token |
| `incomplete input` | The query stops too early. Is something missing at the end, like a closing `)` or `'`? | end of statement |
| `unrecognized token: "'Pop"` | There's a text value with no closing quote. Text values need a `'` on both sides. | the token |
| `ambiguous column name: artist_id` | More than one table has a column called `artist_id`. Say which one you mean, like `Songs.artist_id`. | first token |
| `misuse of aggregate: SUM()` | You can't use `SUM` in `WHERE`. To filter on a total, use `HAVING` after `GROUP BY`. | the `SUM` token |
| `a GROUP BY clause is required before HAVING` | `HAVING` filters groups, so it needs a `GROUP BY` first. | `HAVING` |
| `no such function: X` | SQLite doesn't have a function called `X`. | the token |
| `wrong number of arguments to function X()` | `X` was given the wrong number of values inside its parentheses. | the token |
| `1st ORDER BY term out of range - should be between 1 and 2` | `ORDER BY 3` means "sort by the 3rd column," but your result only has 2 columns. | `ORDER BY` |
| `sub-select returns 2 columns - expected 1` | The query inside the parentheses should return just one column here. | the inner `SELECT` |
| anything else | Something went wrong running this query. (the original message is shown below) | none |

"Did you mean" suggestions use edit distance ≤ 2 against the current table and column names and the SQL keywords.

## 6. Exercises

### Format (`src/exercises.js`)

```js
spotify: [
  {
    text: 'How many total streams did each artist have in March 2026?',
    note: 'Optional extra prompt shown under the question',
    hint: "You'll need Streams, Songs, and Artists, a WHERE on the date, and a GROUP BY.",
    answer: `SELECT a.artist_name, SUM(s.stream_count) AS total_streams
             FROM Streams s
             JOIN Songs so ON so.song_id = s.song_id
             JOIN Artists a ON a.artist_id = so.artist_id
             WHERE s.stream_date BETWEEN '2026-03-01' AND '2026-03-31'
             GROUP BY a.artist_name;`,
    orderMatters: false,
  },
  ...
]
```

- `hint` is used only for data sets 1–6. One constant, `ASSESSMENT_FROM = 7`, marks data sets 7 and up as assessment. Those sets have no hint and no Check button, and any `hint` written for them is ignored (a test checks that none exist).
- Numbering follows the Query Explorer: `1.1`, `1.2`, … by data set number.

### The Exercises panel
- Collapsed (default): "Exercises (6)", then "1.3 How many songs does each artist have?" (the current exercise), plus ‹ and › buttons to move between exercises.
- Expanded: a numbered list with each question and its `note` in italics.
  - Practice sets (1–6): each exercise has **Show hint** (toggles; the hint text sits in a teal-tinted box like the Query Explorer's) and **Check my answer**.
  - Assessment sets (7–10): only the question and note.
  - Clicking an exercise's number makes it the "current" exercise.
- A **Copy for homework** button sits at the end of the strip (see "Copy for homework" below).

### Check my answer (`check.js`)
Check runs the statement at the cursor, and runs the hidden `answer` (both read-only), then compares the results.
- **Columns:** the same number of columns. They are matched by position, not name, so `AS total` and `AS total_streams` both pass.
- **Rows:** the same rows. Order is ignored (both sides are sorted with a stable key) unless `orderMatters` is true.
- **Values:**
  - Numbers match if they differ by at most 0.005, or by at most one part in a million for large numbers. This makes `ROUND(x, 2)` and an unrounded `AVG` both pass.
  - Text must match exactly.
  - `NULL` only matches `NULL`.
- The feedback is plain and kind. It shows the first matching case below, in this order. **It never shows the answer SQL.**

| Situation | Message |
|---|---|
| Error | the error box from §5, plus "Fix the error, then check again." |
| Matches | ✓ "Nice! Your result matches. 7 rows × 2 columns." |
| Wrong column count | "Close! Your result has 3 columns; the expected result has 2. Check your SELECT list." |
| More rows | "Close! Your result has 8 rows; the expected result has 7. Check your WHERE clause, or whether you need GROUP BY." |
| Fewer rows | "Close! Your result has 5 rows; the expected result has 7. Check your WHERE conditions and your JOINs." |
| Same size, different values | "Your result is the right size, but some values are different. Check your calculations and which columns you picked." |
| Right rows, wrong order (`orderMatters`) | "You have the right rows, but not in the right order. Check your ORDER BY." |

The message appears under the exercise (`role="status"`) and is also announced through the page's live region.

### Seed exercises
Each data set gets the three questions from its Query Explorer file (same wording and same `note`), then three SQL-specific ones, ordered from easiest to hardest. Each new question is tagged below with what it practices. Reference answers and hints are written in the plan. Tests check that every answer runs and returns at least one row.

| Set | Added questions |
|---|---|
| 1 Spotify | 1.4 List the five longest songs, longest first. *(ORDER BY DESC, LIMIT)* · 1.5 Show each song's title and its length in minutes. *(calculated column, AS)* · 1.6 Which artists had more than 5 million total streams? *(HAVING)* |
| 2 Concert Tour | 2.4 Which artists have a show in July 2026? List each artist once. *(DISTINCT, BETWEEN)* · 2.5 For each ticket sale, show the ticket type, quantity, and the total money from that sale. *(calculated column)* · 2.6 Which venues sold more than 3,000 tickets in total? *(JOIN + HAVING)* |
| 3 Netflix Binge | 3.4 Which series have a title that starts with "S"? *(LIKE)* · 3.5 List the series released in 2020 or later that are not dramas, newest first. *(AND, NOT, ORDER BY)* · 3.6 Which viewers watched more than 200 minutes in total? *(HAVING)* |
| 4 Basketball | 4.4 Show the three highest-scoring single games by a player: the player, the opponent, and the points. *(JOIN, ORDER BY, LIMIT)* · 4.5 List the games that were home wins, plus any game against App State. *(AND/OR with parentheses)* · 4.6 Which players averaged more than 12 points a game? Round the average to one decimal. *(HAVING, ROUND)* |
| 5 Campus Dining | 5.4 Which dining halls have "the" anywhere in their name? *(LIKE; note that it ignores upper/lower case)* · 5.5 Which residence halls do students on the Unlimited plan live in? List each hall once, A to Z. *(DISTINCT, ORDER BY)* · 5.6 Which students swiped in at 3 or more different dining halls? *(COUNT DISTINCT, HAVING)* |
| 6 Fantasy Football | 6.4 List the wide receivers (WR) and running backs (RB), sorted by name. *(OR / IN, ORDER BY)* · 6.5 Which player had the single highest-scoring week? Show the name, week, and points. *(ORDER BY, LIMIT 1)* · 6.6 For each fantasy team, what was the average weekly score of its players? Only show teams that averaged more than 20. *(two JOINs, HAVING)* |
| 7 Box Office | 7.4 Which R-rated movies are in the data set? Sort them from earliest to latest release. · 7.5 For each weekend, show the movie and how much it earned per theater, in dollars. *(calculated column)* · 7.6 Which studios earned more than $300 million in total? *(HAVING)* |
| 8 Esports | 8.4 Which maps were played? List each map once, A to Z. *(DISTINCT, ORDER BY)* · 8.5 For each match line, show the gamertag, map, and kills-per-death ratio rounded to 2 decimals. *(calculated column, ROUND)* · 8.6 Which gamers averaged at least 15 kills per match? *(HAVING)* |
| 9 TikTok | 9.4 Which videos have captions that start with "POV"? *(LIKE)* · 9.5 Which creators have more than 100,000 followers and are not in the Gaming niche? Most followers first. *(AND, NOT, ORDER BY)* · 9.6 Which videos got more than 1 million total views? *(JOIN + HAVING)* |
| 10 Festival | 10.4 List the acts that are not headliners, A to Z. *(NOT, ORDER BY)* · 10.5 Which genres have "Pop" in their name? List each genre once. *(DISTINCT, LIKE)* · 10.6 Which stages host more than one set? *(COUNT, HAVING)* |

All 60 reference answers were run against the real data while writing this spec: each returns rows, and three thresholds were tuned so the filter actually removes some groups (2.6, 4.6, 10.6).

**Exercises with `orderMatters: true`** must have only one correct row order (no ties in the sort). A test enforces this. It runs each such answer with SQLite's `PRAGMA reverse_unordered_selects` off and then on. If the two row orders differ, the ORDER BY leaves ties, and the test fails.

### Copy for homework (`export.js` + `export-dialog.js`)
This adapts the Query Explorer's dialog: the same modal, focus trap, Escape to close, and focus return.
1. The student picks which exercise this answers. The current exercise is preselected.
2. The dialog shows a preview.
3. **Copy** puts **plain text** on the clipboard, falling back to "the text is selected, press Ctrl+C". **Download .txt** saves it.

```
SQL Studio — Exercise 1.1
How many total streams did each artist have in March 2026?
Data set: 1. Spotify Streams

SQL:
SELECT a.artist_name, SUM(s.stream_count) AS total_streams
FROM Streams s
...

Result (7 rows × 2 columns):
artist_name    | total_streams
---------------+--------------
Bad Bunny      |       9570000
...
(showing 20 of 31 rows)
```

- The table shows the first 20 rows, with the columns padded to line up, numbers right-aligned, and `NULL` shown as `NULL`.
- The Query Explorer's cleanup is reused for the question line and the data set line: newlines become spaces, and `[`/`]` are escaped.
- Cell text has tabs and newlines replaced by spaces.
- The SQL is copied as written (after Tidy, if it ran).
- If the query hasn't run, or it errors, the dialog says so. It offers to copy just the SQL, with a "(this query did not run)" line.
- On "Your data", the exercise list is replaced by a free-text "What question does this answer?" box.

## 7. Random query generator (`randomq.js`)

**Random Query** writes a valid query against the current data set (including uploaded data) and puts it in the editor. It replaces the current statement. The student can undo it with Ctrl+Z.

**Complexity** popover. Each checkbox is an *allowed* feature. When a feature is allowed, the generator uses it about 60% of the time, so the queries vary.
- WHERE
- AND/OR
- JOIN
- Aggregate (COUNT/SUM/AVG/MIN/MAX)
- GROUP BY
- HAVING
- Calculated field
- ORDER BY
- LIMIT
- DISTINCT
- LIKE

Default: WHERE, JOIN, ORDER BY, LIMIT. The choices are saved with the layout.

Some features depend on others. If a student checks one, the popover also checks the ones it needs and says so: HAVING needs GROUP BY, GROUP BY needs an aggregate, and AND/OR and LIKE need WHERE.

How a query is built:
1. **FROM/JOIN:** pick a start table. If JOIN is used, walk 1–2 relationships from the relationship list, so joins only use real keys. Short aliases are used only when a join is present (`Streams s`), as in the book's examples.
2. **WHERE:** conditions on real values from the joined rows, so rows come back. Text gets `=` or `IN`; numbers get `>`, `<`, `>=`, or `BETWEEN`, with values taken from the data; dates get `BETWEEN` using real dates. `LIKE` uses a real 2–4 letter piece of a real value (`'%Swift%'`, `'S%'`). `AND`/`OR` joins two conditions. When `OR` is mixed with a join filter, it is wrapped in parentheses.
3. **SELECT:** either 2–4 columns, or GROUP BY a text (or date) column with 1–2 aggregates of number columns (`COUNT(*)` always works). Aggregates get readable `AS` names (`total_stream_count`). A calculated field is a sensible expression on number columns, such as `quantity * price_each AS quantity_times_price_each` or `duration_sec / 60.0 AS duration_sec_div_60`. DISTINCT applies to a text column list, or becomes `COUNT(DISTINCT col)` when there is an aggregate.
4. **HAVING:** a threshold picked from the real group values (so at least one group passes).
5. **ORDER BY** a selected column or alias, `ASC`/`DESC`. **LIMIT** 3–10.
6. The query is run. If it returns zero rows, it is regenerated (up to 20 tries; the last try drops WHERE). The final query is then run through `format.js`.

The generator takes a seed (`mulberry32`), so tests can repeat a run. It uses only the relationship list and the column types, so it works on uploaded data too.

## 8. Results, ERD, and Data panels

### Results (`results-view.js`)
- Results show in a real `<table>` with a `<caption>` that is hidden from view but read by screen readers. The header row is sticky. Numbers are right-aligned. `NULL` is shown in muted italics.
- Above the table: "7 rows × 2 columns", **Copy** (TSV), and **Export CSV**. Both buttons are always shown; this is simpler than switching at 50 rows.
- **Copy** copies all rows, not just the current page, and confirms "Copied 7 rows. Paste into Excel or Google Sheets."
- **Paging:** 100 rows per page, with « Prev, "Rows 101–200 of 640", and Next ». The live region announces the new page.
- **Number display:** hovering over or focusing a numeric column header shows a small ⋯ button. It opens a popover for that column: ☐ Thousands separators, and Decimal places (Auto / 0 / 1 / 2 / 3). This changes only the display, never the data, copy, CSV, or Check. The choices reset when a new query runs. A column is numeric if every non-null value in it is a number.
- After a run, the live region says "Query ran: 7 rows, 2 columns." or "Query ran: no rows." When there are no rows, the panel says "Your query ran, but no rows matched. Does that make sense for your question?"

### ERD (`erd.js`)
- **Model:** `schema.js` gives tables (name, columns, PK/FK flags) and relationships.
  - Built-in sets come entirely from the metadata, so nothing is guessed.
  - For uploads, the relationships are guessed (§9), and the student can fix them.
- **Drawing (SVG):**
  - Each table is a card: a header with the table name, then one row per column.
  - Key columns get a key icon and a "PK" badge. Foreign keys get a link icon and an "FK" badge. The column type is shown in muted text.
  - Relationship lines use **crow's foot notation, matching Chapter 6**. The primary-key end is "exactly one" (`||`). The foreign-key end is "zero or more" (`o{`), because every data set has rows with no match.
  - Lines are orthogonal connectors routed between the two key columns' rows.
- **Moving:** drag a table by its header (pointer events). Keyboard: tables are focusable (`role="group"`, labeled "Songs table, 5 columns"), and arrow keys move a table 10px (50px with Shift).
- **Tidy:** a layered layout. Parent tables go left and child tables go right, with each layer spaced evenly in a column. Positions are kept per data set for the session.
- **Zoom and pan:** − / + buttons and a percentage (30–250%), Ctrl/⌘+wheel, two-finger pinch (pointer events with `touch-action: none` on the canvas), and dragging the background to pan. Zoom and pan never change the page zoom.
- **Attributes** checkbox: shows or hides all column rows. Each table header also has its own chevron to collapse that table.
- **Hiding tables:** each table header has a "Hide" (eye) button. Hidden tables appear as chips ("Hidden: Streams ×") that bring them back. Hiding affects the diagram only.
- **Edit Links** mode:
  - Drag from an FK-able column to a PK column to add a link. The columns' types must match, or the tool explains why not.
  - Click or focus a line and press Delete (or its × button) to remove it.
  - For keyboard and screen-reader users, the mode also shows a small form: "Add a link: [table.column ▾] → [table.column ▾] [Add]", and a list of current links with Remove buttons.
  - **Reset links** restores the original metadata (built-in sets) or the original guesses (uploads).
  - Links change the ERD, the header count, and the random generator. They never change the database or the exercise answers.
- **PNG:**
  1. Draw the SVG, with computed colors written in, onto a canvas at 2× resolution with a solid background in the current theme.
  2. Try `navigator.clipboard.write([ClipboardItem({'image/png'})])`.
  3. If that's blocked, download `erd-<dataset>.png` instead.
  4. Either way, the status says what happened.

### Data preview (`data-view.js`)
- Tabs (`role="tablist"`, arrow keys move between tabs) for each table.
- Each tab shows the first 10 rows in a real `<table>`, plus "Showing 10 of 24 rows" (or "Showing all 8 rows").
- Rows come from `SELECT * FROM "T" LIMIT 10` and `SELECT COUNT(*)`, so uploads work the same way.

## 9. Use my own data (`upload-parse.js`, `upload.js`)

- **Upload** opens a file picker that accepts `.csv` (several at once) and `.xlsx` (if SheetJS is kept).
  - Each CSV becomes one table, named after the file.
  - Each Excel sheet becomes one table, named after the sheet.
- **CSV parser** (our own code; RFC 4180):
  - Handles quoted fields, `""` escapes, commas and newlines inside quotes, CRLF line endings, a UTF-8 BOM, and blank trailing lines.
  - Uses the first row as the header.
  - Pads short rows with nulls; extra cells cause a clear error.
- **Name cleanup:** lowercase `snake_case` (letters, digits, `_`). It must not start with a digit. Duplicates get `_2`. SQL keywords get `_col` added.
  - Table names keep their case (`Orders`).
  - The ERD shows a note listing any renamed columns: "Renamed: `Order Date` → `order_date`".
- **Types:**
  - `number` if every non-empty value is a number (commas in thousands are allowed and removed).
  - `date` if every non-empty value is `YYYY-MM-DD`, or `M/D/YYYY` (converted), or an Excel date cell.
  - Otherwise `text`.
  - Empty cells become `NULL`.
- **Key guessing:**
  - A table's primary key is the first column named `id` or `<something>_id` whose values are unique and not empty.
  - A column `X_id` in another table becomes a foreign key to the table whose primary key is `X_id`. When `X_id` is the primary key of no table, it can still link to a table named like `X` (singular or plural) with primary key `id`.
  - The student can fix guesses in Edit Links.
- **Limits:** 5 MB per file, 20 tables, 50,000 rows per table. Anything over a limit gets a plain message, and nothing is loaded.
- **Result:** "Your data" becomes the selected item in the data set picker, with the description listing the table names. The Exercises strip says "There are no exercises for your own data. Try **Random Query** to get started." Uploading again replaces "Your data".
- Google Sheets and Drive links are left out on purpose. Browsers block those downloads without a server (CORS). The tip says "In Google Sheets, use File → Download → .xlsx or .csv, then upload."

## 10. Layout, persistence, and accessibility

### Layout (`layout.js`)
- **Splitters** are `role="separator"` with `aria-orientation`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label` (for example, "Resize SQL and Results"). They can be dragged with pointer or touch, moved with the arrow keys (Shift for bigger steps), and reset with a double-click or Enter.
- **Collapse:** each chevron is a `<button aria-expanded aria-controls>`. A collapsed panel shrinks to its header, and the others take the space.
- **Saving:** sizes, collapsed panels, per-panel zoom, Attributes, Tidy on Run, and Complexity choices are saved in `localStorage` under `sqlStudio.layout.v1` as one JSON object.
  - Every read and write is wrapped in try/catch.
  - Bad or missing data falls back to the defaults.
  - The tool works the same with storage blocked.
- **Not saved:** editor text and ERD positions (session only, as described above).

### Accessibility
- **Keyboard:** everything works by keyboard alone. Tab order follows the screen: header → Exercises → SQL toolbar → editor → Run → Results → ERD → Data. Focus rings are visible everywhere (`:focus-visible`, 3px `--indigo`), including inside the SVG.
- **Labels and live regions:**
  - Every control has a label.
  - Icon-only buttons have `aria-label` and a tooltip.
  - Popovers are disclosure buttons (`aria-expanded`), and Escape closes them and returns focus.
  - One polite `aria-live` region announces runs, copies, checks, and page changes. The error box uses `role="alert"`.
- **Contrast:** text and controls meet WCAG AA (4.5:1 for text, 3:1 for UI parts) in both themes. Syntax-highlight colors are chosen from the book's tokens and tested with a contrast script in the browser check.
- **Reduced motion:** with `prefers-reduced-motion`, there are no transitions (popover fades, the statement flash, smooth ERD zoom), and changes happen instantly.

## 11. Open questions (defaults chosen; tell me to change any)

1. **Excel upload:** include SheetJS mini 0.20.3 (+≈260 KB, about +18%)? *Default: yes.*
2. **Read-only:** block INSERT/UPDATE/DELETE/DROP/CREATE? *Default: yes, read-only.* The alternative is allowing changes, with a "Reset data" button, and having Check run against a fresh copy.
3. **Publishing:** after the tool is built, copying `sql-studio.html` to the `gh-pages` branch and pushing it makes it public. I'll ask before that push.

## 12. Testing

**Node tests** (`node --test tools/sql-studio/test/`, using only the vendored sql.js):
- **schema:** type mapping (INTEGER, REAL, TEXT, dates), PK/FK DDL, parent-first order, row counts match, and the relationship count per set equals its number of `fk` columns.
- **datasets:** all ten load from `../query-explorer/src/datasets/`, every FK value finds its row, and `BETWEEN` on dates works.
- **exercises:**
  - Every set has 5–6 exercises.
  - The first three match the Query Explorer text and notes exactly.
  - Every answer runs and returns at least one row.
  - Sets 7–10 have no hints, and sets 1–6 all have hints.
  - `orderMatters` answers have one fixed order (the `reverse_unordered_selects` test).
- **check:** match, wrong column count, more rows, fewer rows, same size with different values, order ignored, order required, numeric tolerance (0.004 passes, 0.01 fails, large numbers), `NULL`s, text exactness, and an error passed through.
- **randomq:**
  - 300 queries per data set with random toggles, plus 100 each with all toggles on and all off: every one runs without error.
  - At least 95% return rows.
  - Every JOIN uses a real relationship.
  - Each toggle shows up in some queries and never when it's off.
  - The same seed gives the same query.
- **errors:** each row of the §5 table, from a real sql.js error to the expected message and line/column, including aliases, multi-line queries, and a statement that isn't the first.
- **format:** expected output for sample queries, idempotence, comments and strings kept, and the same results before and after formatting for all exercise answers and 300 random queries.
- **sql-text:** splitting with `;` inside strings and comments, the statement at the cursor, and the alias map.
- **export:** TSV escaping, CSV quoting (commas, quotes, newlines), the homework text layout, the 20-row cap, and the newline and bracket cleanup.
- **upload-parse:** CSV edge cases, type inference, name cleanup, key guessing, and limits.
- **build:** the output exists, has no `</script` inside inlined code, contains the wasm, has no `http` requests other than fonts, and its data set count equals the number of files in the Query Explorer's folder.

**Browser check** (pre-installed Playwright Chromium, driven by a script in the scratchpad, not a repo dependency):
- Laptop (1366×800), tablet (820×1180, touch), and phone (390×844), each in light and dark mode.
- Load, run a query, see the error box, check an answer, generate a random query, drag an ERD table, switch data sets and back (text kept), and run a keyboard-only pass with focus-ring screenshots.
- Screenshots go to you.

## 13. Course integration

- `tools/index.html` gets a "Chapter 8" section in the same card style, labeled "Use with Chapter 8", linking to `sql-studio.html`.
- `chapter-08.md` gets **Activity 8.0 – SQL Studio** in a gray box like Activity 7.0, linking to `https://kalendar.github.io/relational-thinking/sql-studio.html`. The activities intro adds: "Activity 8.0 is the one exception: it uses an interactive tool instead of a prompt."
- Publishing: copy `dist/sql-studio.html` and the updated `index.html` to the `gh-pages` branch (flat, next to `query-explorer.html`), and push only after you say yes.

## 14. Out of scope

- Saving work between visits.
- Accounts or grading.
- Writing or changing data (see open question 2).
- Google Sheets/Drive links.
- An AI assistant inside the tool (Chapter 8's AI practice stays in the AI activities).
- Query plans or EXPLAIN.
- Outer-join teaching aids (Chapter 9).
- Embedding in Pressbooks.
