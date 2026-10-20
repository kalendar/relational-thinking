# ERD Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ERD Playground: a single-file browser tool where students edit Chapter 6's crow's foot notation on the left and see the diagram on the right, live, with plain-English readings that tie each symbol to the picture.

**Architecture:** This is a sibling of SQL Studio (`tools/sql-studio/`), with the same dual-load `window.SS` pattern, `node:test` tests, and a `build.js` that inlines everything into `dist/`. Pure logic (the notation parser, the readings, the examples) is new and tested in Node. Drawing reuses SQL Studio's code read in place: `erd-model.js` (extended with four end types, lanes, self-loops, and label points) and two new shared files pulled out of SQL Studio, `panels.js` (panel and splitter) and `canvas.js` (zoom, pan, pinch, fit, PNG). CodeMirror 5 is read from SQL Studio's `vendor/`.

**Tech Stack:** Plain JavaScript (ES2020), HTML, and CSS. Node 22 (`node:test`). CodeMirror 5.65.21 (already vendored in SQL Studio). The browser checks use Playwright Chromium from a scratch folder, not as a repo dependency.

**Spec:** `docs/superpowers/specs/2026-10-20-erd-playground-design.md`

## Global Constraints

- One file: `tools/erd-playground/dist/erd-playground.html`. It works from `file://` and at `https://kalendar.github.io/relational-thinking/erd-playground.html`. The only network request is Google Fonts, with system-font fallbacks.
- Reuse by reading in place, never copying:
  - `tools/sql-studio/src/{dom.js, icons.js, erd-model.js, panels.js, canvas.js}`
  - `tools/sql-studio/vendor/codemirror/{codemirror.js, codemirror.css, matchbrackets.js, active-line.js}`
- SQL Studio must keep passing `node --test tools/sql-studio/test/` and its browser checks after every task that touches its files.
- Color tokens are exactly the Query Explorer's `:root` block. A test checks this, as in SQL Studio.
- All on-screen text is at a 10th-grade reading level. The cardinality words are exactly 6.1's: **one and only one**, **zero or one**, **one or more**, **zero or more**.
- Never use `innerHTML` with data. Build DOM with `SS.h()` / `SS.s()`.
- `localStorage` holds layout preferences only, under the key `erdPlayground.layout.v1`, with every access in try/catch.
- Tests live in `tools/erd-playground/test/`. `test/index.js` makes `node --test tools/erd-playground/test/` work on Node 22.
- Commit after each task with a message starting `ERD Playground: `, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Publishing (`gh-pages`), `tools/index.html`, and `chapter-06.md` changes happen only after David says yes.

## Review Focus

1. **Pasted text from Windows or a word processor:** `\r\n` line endings, tabs, trailing spaces, non-breaking spaces, and blank lines all parse the same as clean text. Tested in Task 2.
2. **An unclosed `{` block at the very end:** the error points at the block's opening line, and the last good diagram stays. Tested in Tasks 2 and 9.
3. **The same pair related twice, and an entity related to itself:** both are drawn without lines lying on top of each other. Tested in Task 5 (geometry) and Task 9 (render count).
4. **A large paste** (300 relationship lines): parsing takes under 50 ms, and the page stays responsive. Tested in Task 2.
5. **Names that differ only in case** (`Artist` and `ARTIST`) are two entities, as in Mermaid, and the readings use each one's own spelling. Tested in Tasks 2 and 3.

---

## File Structure

```
tools/sql-studio/src/
  erd-model.js   # Task 5: + four end kinds, lanes, selfLoopRoute, labelPoint (SQL Studio keeps working)
  panels.js      # Task 6: makePanel + splitter, moved out of layout.js (shared)
  canvas.js      # Task 6: zoom/pan/pinch/fit/PNG, moved out of erd.js (shared)
  layout.js, erd.js, build.js   # Task 6: use panels.js / canvas.js
tools/erd-playground/
  build.js                  # Task 1
  src/index.html  src/styles.css      # Task 1 (styles grow in Tasks 7–9)
  src/notation.js           # Tasks 2–3: parseErd
  src/readings.js           # Task 3: readRelationship, MEANING
  src/examples.js           # Task 4: EXAMPLES
  src/prefs.js              # Task 7: layout prefs (+ SS.stepZoom for this page)
  src/editor.js             # Task 7: CodeMirror mode, marks, highlight
  src/diagram-view.js       # Task 8: draws a parsed model with SS.canvas + erd-model
  src/app.js                # Task 9: header, picker, cheat sheet, status, readings, linking
  test/index.js test/helpers.js test/build.test.js test/notation.test.js
  test/readings.test.js test/examples.test.js test/book.test.js test/prefs.test.js
  dist/erd-playground.html
tools/index.html, chapter-06.md   # Task 10, after David says yes
```

### Shared shapes

```js
// End kinds (used by notation.js, readings.js, erd-model.crowFoot):
//   'one' (||)  'zero-one' (|o left / o| right)  'one-many' (}| left / |{ right)  'zero-many' (}o left / o{ right)

// parseErd(text) → Model   (never throws)
{
  hasHeader: true,                        // first non-blank, non-comment line is `erDiagram`
  entities: [ { name: 'ARTIST', display: 'ARTIST', line: 2,
                attributes: [ { type: 'int', name: 'artist_id', keys: ['PK'], comment: '' } ] } ],
  relationships: [ { a: 'ARTIST', b: 'SONG', aEnd: 'one', bEnd: 'zero-many', dashed: false,
                     label: 'records', line: 2,
                     aSym: { line: 2, col: 12, length: 2 }, bSym: { line: 2, col: 16, length: 2 } } ],
  errors: [ { line: 3, col: 12, length: 5, message: 'Line 3: …' } ],   // empty when the text is fine
  notes:  [ 'Add `erDiagram` as the first line to use this in Mermaid.' ],
}
```

- Entities appear in the order they're first mentioned.
- `display` is the alias text, or the name.
- `col` is 1-based.
- `aEnd` is the end drawn next to entity `a`; `bEnd` is the one next to `b`.

---

### Task 1: Scaffold, build, and page shell

**Files:**
- Create: `tools/erd-playground/build.js`, `src/index.html`, `src/styles.css`, `test/index.js`, `test/helpers.js`, `test/build.test.js`

**Interfaces:**
- Produces:
  - `build(): string` (the output path), exporting `SCRIPT_ORDER`, `SHARED`, and `VENDOR_JS`;
  - `helpers.ROOT`, `helpers.REPO`.
  - Build order: vendor CM (`codemirror.js`, `matchbrackets.js`, `active-line.js`), then `SHARED` (`../sql-studio/src/dom.js`, `icons.js`, `erd-model.js`, `panels.js`, `canvas.js`), then `SCRIPT_ORDER` (`notation.js`, `readings.js`, `examples.js`, `prefs.js`, `editor.js`, `diagram-view.js`, `app.js`).
  - Like SQL Studio, the build skips files that don't exist yet, and each part gets its own `<script data-src="…">` tag.

- [ ] **Step 1: Write `test/build.test.js` (failing)**
  - `build()` writes `dist/erd-playground.html` beginning with `<!doctype html>`.
  - Every `src/*.js` is listed in `SCRIPT_ORDER`.
  - Every `SHARED` path appears as `<script data-src="../sql-studio/src/<file>">` once the file exists.
  - The only outside URL loaded is `fonts.googleapis.com`.
  - `styles.css` contains the Query Explorer token block verbatim (the same check as SQL Studio's `build.test.js`).
  - Test `'every file in the load order exists'`, skipped until `src/app.js` exists.

- [ ] **Step 2: Run `node --test tools/erd-playground/test/build.test.js`.** Expected: FAIL, "Cannot find module '../build.js'".

- [ ] **Step 3: Write the scaffold.**
  - Copy `build.js` from `tools/sql-studio/build.js` and adapt it: no wasm, no data sets, and the `SHARED` list.
  - `index.html` like SQL Studio's, titled "ERD Playground", with `<div id="live" class="sr-only" aria-live="polite">`.
  - `styles.css` starts with the Query Explorer token block (`awk '/^\*\{box-sizing/{exit} {print}' tools/query-explorer/src/styles.css`), followed by SQL Studio's base rules (buttons, panels, splitters, popovers, `[hidden]`, the reduced-motion block, CodeMirror theme rules), copied from `tools/sql-studio/src/styles.css`. Add the playground rules in Tasks 7–9.
  - `test/index.js` like SQL Studio's.

- [ ] **Step 4: Run `node tools/erd-playground/build.js && node --test tools/erd-playground/test/`.** Expected: PASS, 1 skipped.

- [ ] **Step 5: Commit** `ERD Playground: scaffold, build, and page shell` (include `dist/`).

---

### Task 2: Parser for Chapter 6's notation

**Files:** Create `src/notation.js`, `test/notation.test.js`

**Interfaces:**
- Produces: `parseErd(text: string): Model` (the shape above), plus `END_KINDS = { left: { '||': 'one', '|o': 'zero-one', '}|': 'one-many', '}o': 'zero-many' }, right: { '||': 'one', 'o|': 'zero-one', '|{': 'one-many', 'o{': 'zero-many' } }`.

Grammar for this task: the optional `erDiagram` header; `%%` comments; blank lines; a relationship line `A <L><line><R> B [: label]`, where the line is `--` or `..`; an entity alone on a line; and attribute blocks `NAME {` … `}`, whose lines are `type name [PK|FK|UK[, …]] ["comment"]`. Entity names match `[A-Za-z_][A-Za-z0-9_-]*`. A label is `"quoted"` or one word. Types may contain `()` and `[]`.

- [ ] **Step 1: Write the failing tests** (exact values):
  - `'ARTIST ||--o{ SONG : "records"'` gives one relationship `{ a:'ARTIST', b:'SONG', aEnd:'one', bEnd:'zero-many', dashed:false, label:'records', line:1 }`, `aSym {line:1,col:8,length:2}` and `bSym {line:1,col:12,length:2}`, entities `['ARTIST','SONG']`, no errors, and `hasHeader:false`.
  - All 16 end pairs, `||` `|o` `}|` `}o` on the left × `||` `o|` `|{` `o{` on the right, map through `END_KINDS`.
  - `A ||..o{ B : x` sets `dashed:true`; `A ||--o{ B : records` (unquoted) sets `label:'records'`.
  - Missing label (`ARTIST ||--o{ SONG`) gives `label:''`, no error, and a note equal to "A line without a label works here. To use it in Mermaid or an AI tool, add a label, like `: \"records\"`." (only once, even with several such lines).
  - A first line of `erDiagram` sets `hasHeader:true` with no header note. Without it, the note is "Add `erDiagram` as the first line to use this in Mermaid."
  - Chapter 8's Artist block with `int artist_id PK`, `string hometown`, and `int artist_id FK "points at Artist"` gives `keys ['PK']`, `[]`, `['FK']`, and comment `'points at Artist'`. `varchar(255) name` and `string[] tags` parse.
  - An entity declared alone (`GENRE`) appears in `entities` with no relationships.
  - Errors (exact messages, first error only per line):
    - `A ||--o B : x` gives `Line 1: \`||--o\` is missing its last symbol. Line ends are \`||\`, \`o|\`, \`|{\`, or \`o{\`.` with col 3 and length 5.
    - `A |--o{ B : x` gives `Line 1: \`|--o{\` is missing its first symbol. Line ends are \`||\`, \`o|\`, \`|{\`, or \`o{\`.`
    - `A ||->o{ B : x` gives `Line 1: \`||->o{\` isn't a relationship symbol. Line ends are \`||\`, \`o|\`, \`|{\`, or \`o{\`, with \`--\` in the middle.`
    - `A ||--o{ B records here` gives `Line 1: Put a \`:\` before the label.`
    - `A ||--o{ : x` gives `Line 1: This relationship needs an entity on each side.`
    - `ARTIST {` followed by `int id PK` and no `}` gives `Line 1: This attribute block is missing its closing \`}\`.`
    - `this is not right` gives `Line 1: This line isn't a relationship, an entity, or an attribute block.`
  - Review Focus 1: the same diagram with `\r\n`, tabs, trailing spaces, and U+00A0 spaces parses identically to the clean text (deep-equal model).
  - Review Focus 5: `Artist ||--o{ ARTIST : x` gives two entities, `Artist` and `ARTIST`.
  - Review Focus 4: 300 lines `E{i} ||--o{ E{i+1} : x` parse in under 50 ms (`performance.now()`), with 300 relationships.

- [ ] **Step 2: Run `node --test tools/erd-playground/test/notation.test.js`.** Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Implement `parseErd` in `src/notation.js`.** Use a line-by-line scanner. First normalize `\r\n`→`\n` and U+00A0→space, then check columns against the original line. For a relationship, split the symbol token as left (2 chars) + line (2) + right (2):
  - a 5-character token whose first 4 characters are a valid left + line gives the "missing its last symbol" error;
  - one whose last 4 characters are a valid line + right gives "missing its first symbol";
  - anything else gives "isn't a relationship symbol".

  While inside a `{ … }` block, every line is an attribute until `}`.

- [ ] **Step 4: Run the test.** Expected: PASS.

- [ ] **Step 5: Commit** `ERD Playground: parse Chapter 6's ERD notation`.

---

### Task 3: Mermaid extras, and the two-way readings

**Files:** Modify `src/notation.js`, `test/notation.test.js`. Create `src/readings.js`, `test/readings.test.js`, `test/book.test.js`

**Interfaces:**
- Produces:
  - `parseErd` additions:
    - word cardinalities, written as `A <card> to|optionally to <card> B : label`, where `optionally to` means dashed;
    - aliases `p["Person"]`, with `display` set to `Person`;
    - quoted names `"Big Box"`;
    - ignored lines starting `direction`, `style`, `classDef`, or `class`;
    - the mirrored-end error.
  - `MEANING = { one: 'one and only one', 'zero-one': 'zero or one', 'one-many': 'one or more', 'zero-many': 'zero or more' }`.
  - `readRelationship(rel, displayOf = n => n): [string, string]`, where `**…**` marks the bold cardinality words.

Word cardinalities map exactly as follows:
- `only one` and `1` → one
- `zero or one` and `one or zero` → zero-one
- `one or more`, `one or many`, `many(1)`, `1+` → one-many
- `zero or more`, `zero or many`, `many(0)`, `0+` → zero-many

- [ ] **Step 1: Write the failing tests.**
  - `CUSTOMER one or more to zero or many ORDER : places` gives `aEnd:'one-many', bEnd:'zero-many', dashed:false`. With `optionally to`, `dashed:true`.
  - `p["Person"] ||--o{ CAR : owns` gives entity `{ name:'p', display:'Person' }`. `"Big Box" ||--o{ ITEM : holds` gives entity name `Big Box`.
  - `direction LR`, `style A fill:#f00`, `classDef x fill:#fff`, and `class A x` lines produce no errors and no entities.
  - Mirrored left ends: `A o{--|| B : x` gives `Line 1: On the left side the symbols are mirrored: write \`}o\` instead of \`o{\`.`, and likewise `|{`→`}|` and `o|`→`|o`.
  - `readRelationship` with ARTIST/SONG (one / zero-many) gives `['An ARTIST is associated with **zero or more** SONGs.', 'A SONG is associated with **one and only one** ARTIST.']`.
  - All 16 end combinations: sentence 1 uses `bEnd`'s meaning and sentence 2 uses `aEnd`'s. The second entity is plural only for `one-many` and `zero-many`.
  - Plurals: `STATUS` becomes `STATUSes` (ending s/x/z/ch/sh adds "es"); everything else adds "s". Articles: "An" before A/E/I/O, otherwise "A" ("A USER").
  - The label never appears in either sentence.
  - `displayOf` is used for both names (an alias reads "A Person …").
  - Review Focus 5: `Artist`/`ARTIST` keep their own spelling in the sentences.
  - `test/book.test.js`: every ```` ```mermaid ```` block containing `erDiagram` in `chapter-06.md`, `chapter-08.md`, `chapter-09.md`, and `chapter-10.md` (read from the repo root) parses with `errors.length === 0`. Assert that at least 5 blocks were found.

- [ ] **Step 2: Run `node --test tools/erd-playground/test/`.** Expected: FAIL (new tests).

- [ ] **Step 3: Implement** the parser additions, and `readRelationship` in `src/readings.js`. Sentence form: `${Article(A)} ${A} is associated with **${MEANING[end]}** ${end is many ? plural(B) : B}.`

- [ ] **Step 4: Run the tests.** Expected: PASS. If a book block fails, fix the parser, not the book.

- [ ] **Step 5: Commit** `ERD Playground: Mermaid extras and two-way readings`.

---

### Task 4: The examples

**Files:** Create `src/examples.js`, `test/examples.test.js`

**Interfaces:**
- Produces: `EXAMPLES: Array<{ id, title, description, text }>`, in the spec's §7 order. `EXAMPLES[0].id === 'artist-song'` opens by default.

The ten examples (`text` always starts with `erDiagram`, and every relationship has a label, so each is valid Mermaid):
1. `artist-song`, "Artist records Song": 6.1's `ARTIST ||--o{ SONG : "records"`.
2. `five-patterns`, "The five patterns": 6.1's `A1`…`B5` block, verbatim.
3. `music-streaming`, "Music streaming (Chapters 8–9)": Chapter 8's diagram with attribute blocks, verbatim.
4. `campus-concert`, "Campus concert series (6.2)": 6.2's seven relationship lines, verbatim.
5. `many-to-many`, "Many-to-many, before and after": `STUDENT }o--o{ CLASS : "takes"`, then the junction version (`STUDENT ||--o{ ENROLLMENT : "has"`, `CLASS ||--o{ ENROLLMENT : "has"`), with a `%%` comment line saying which is which.
6. `basketball`, "Thundering Herd basketball": `PLAYER ||--o{ BOX_SCORE`, `GAME ||--|{ BOX_SCORE`.
7. `dining`, "Campus dining": `STUDENT ||--o{ MEAL_SWIPE`, `DINING_HALL ||--o{ MEAL_SWIPE`.
8. `netflix`, "Netflix binge": `SERIES ||--|{ EPISODE`, `EPISODE ||--o{ VIEWING_SESSION`, `VIEWER ||--o{ VIEWING_SESSION`.
9. `fantasy`, "Fantasy football league": `MANAGER ||--|| FANTASY_TEAM : "runs"`, `FANTASY_TEAM ||--o| TROPHY : "wins"`, `FANTASY_TEAM ||--o{ ROSTER_SPOT : "fills"`, `NFL_PLAYER ||--o{ ROSTER_SPOT : "takes"`.
10. `self`, "A relationship to itself": `EMPLOYEE ||--o{ EMPLOYEE : "manages"`.

Each `description` is one sentence at a 10th-grade level. Examples 6–9 get attribute blocks with 2–4 attributes each.

- [ ] **Step 1: Write the failing tests.**
  - There are 10 examples with unique ids, in the order above.
  - Every example parses with no errors and no notes.
  - The relationship counts are 1, 5, 3, 7, 3, 2, 2, 3, 4, 1.
  - `five-patterns` covers all four right-end kinds.
  - `self` has `a === b`.
  - The text of examples 1–4 appears verbatim in the chapter files (each relationship line does).

- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Write `examples.js`.** **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `ERD Playground: ten examples`.

---

### Task 5: Diagram geometry for all four ends (SQL Studio's erd-model.js)

**Files:** Modify `tools/sql-studio/src/erd-model.js`, `tools/sql-studio/test/erd-model.test.js`

**Interfaces:**
- Produces, keeping every existing export and behavior:
  - `crowFoot(p, side, kind)` accepts `'one' | 'zero-one' | 'one-many' | 'zero-many'`, with `'many'` kept as an alias of `'zero-many'` for SQL Studio;
  - `linkRoute(…, showFrom, showTo, lane = 0)` shifts both end points down by `lane * 14`;
  - `selfLoopRoute(box): { points, side: 'right' }`;
  - `labelPoint(points): { x, y }`.

- [ ] **Step 1: Write the failing tests.**
  - `crowFoot(p,'right','one')` gives 2 lines and no circle.
  - `'zero-one'` gives 1 bar line and a circle.
  - `'one-many'` gives 3 prong lines plus 1 bar and no circle.
  - `'zero-many'` gives 3 prong lines and a circle.
  - `'many'` deep-equals `'zero-many'`.
  - `linkRoute` with lane 1 has first and last points with `y` exactly 14 more than lane 0, and every segment is still horizontal or vertical.
  - `selfLoopRoute({x:0,y:0,w:100,h:60})` starts and ends at `x === 100`, at two different `y` values inside the box, and every middle point is at `x > 100`. Segments are orthogonal.
  - `labelPoint` of `[{0,0},{100,0},{100,20}]` gives `{x:50,y:0}`, the middle of the longest segment.

- [ ] **Step 2: Run `node --test tools/sql-studio/test/erd-model.test.js`.** Expected: FAIL.

- [ ] **Step 3: Implement.** The "one" bar sits 8 px from the box. A minimum mark (bar or circle) sits further out, at 14 px for a bar and 18 px for a circle, so `|{` reads bar-then-foot and `o|` reads circle-then-bar, matching how the book's diagrams look.

- [ ] **Step 4: Run `node --test tools/sql-studio/test/`.** Expected: all pass. (SQL Studio's calls with `'one'` and `'many'` are unchanged.)

- [ ] **Step 5: Commit** `ERD Playground: crow's foot geometry for all four line ends`.

---

### Task 6: Share the panels and the diagram canvas (SQL Studio refactor)

**Files:**
- Create `tools/sql-studio/src/panels.js` and `tools/sql-studio/src/canvas.js`.
- Modify `tools/sql-studio/src/layout.js` and `erd.js` (move code out, behavior unchanged), and `tools/sql-studio/build.js` (`panels.js` before `layout.js`, `canvas.js` before `erd.js`).

**Interfaces:**
- Produces:
  - `SS.makePanel` and `SS.splitter`, with the same signatures as today, moved verbatim from `layout.js`;
  - `SS.createCanvas(host, { getPreferredScale(): number, onScale(scale): void, minScale = 0.3, maxScale = 2.5 })`, which returns `{ svg, viewport, view, applyView(), zoomAt(scale, cx, cy), zoomBy(dir), fitTo(bounds), copyPng(filename, bounds): Promise<'copied'|'downloaded'|'failed'> }`. It also handles background pan, two-pointer pinch, and Ctrl/⌘+wheel exactly as `erd.js` does today.
  - `erd.js` keeps every behavior, and its PNG announcements stay worded as they are now.

- [ ] **Step 1: Add to `tools/sql-studio/test/build.test.js`:** `panels.js` and `canvas.js` are in `SCRIPT_ORDER`, before `layout.js` and `erd.js`. Run it; expected: FAIL.

- [ ] **Step 2: Move the code.** `fitTo` uses `SS.fitView`. `copyPng` is today's `copyPng` body, with the bounds and filename passed in, returning how it ended so `erd.js` can announce it.

- [ ] **Step 3: Run `node tools/sql-studio/build.js && node --test tools/sql-studio/test/`.** Expected: all pass.

- [ ] **Step 4: Browser regression for SQL Studio.** Run Task 10's check script with `--tool sql-studio`. Expected: the ERD drag, zoom buttons, pinch, PNG (clipboard and download), and Edit Links all pass, with no console errors.

- [ ] **Step 5: Commit** `SQL Studio: move panel and canvas helpers into shared files (no behavior change)`.

---

### Task 7: Preferences and the notation editor

**Files:** Create `src/prefs.js`, `test/prefs.test.js`, `src/editor.js`. Modify `src/styles.css`.

**Interfaces:**
- Produces:
  - `prefs.js`:
    - `STORAGE_KEY = 'erdPlayground.layout.v1'`;
    - `DEFAULT_PREFS = { notationWidth: 0.42, height: 560, collapsed: { notation:false, diagram:false }, zoom: { notation: 100 }, diagramZoom: 100, cheatSheetOpen: false }`;
    - `sanitizePrefs`, `loadPrefs(storage)`, `savePrefs(storage, prefs): boolean`;
    - `stepZoom(value, dir, range?)`, published as `SS.stepZoom` because the shared `panels.js` uses it.
  - `editor.js`: `SS.createNotationEditor(host, { onChange(text) })`, which returns `{ cm, getText(), setText(text), markError({line,col,length}|null), highlightLine(line|null), markSymbol({line,col,length}|null), onCursorLine(fn(line)), focus() }`.
  - An `erd` CodeMirror mode built with `CodeMirror.defineMode`. Its token classes are: `keyword` for `erDiagram`, `operator` for end symbols and `--`/`..`, `string` for quoted labels, `comment` for `%%`, `variable-2` for entity names, `atom` for `PK`/`FK`/`UK`, and `type` for attribute types.

- [ ] **Step 1: Write `test/prefs.test.js` (failing).** Cover:
  - the defaults;
  - a round trip through a memory storage;
  - out-of-range values: `notationWidth` is clamped to 0.2–0.8 and zoom to 70–200 in steps of 10;
  - bad JSON gives the defaults;
  - a storage that throws on both get and set still loads the defaults, and save returns false.

- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement** `prefs.js`, then `editor.js` (not tested in Node; Task 9's browser check covers it). The editor uses `lineNumbers`, `styleActiveLine`, `inputStyle: 'contenteditable'`, `screenReaderLabel: 'ERD notation editor'`, and `extraKeys: { Tab: false, 'Shift-Tab': false }`.

- [ ] **Step 4: Run `node --test tools/erd-playground/test/`.** Expected: PASS.

- [ ] **Step 5: Commit** `ERD Playground: layout preferences and notation editor`.

---

### Task 8: The diagram view

**Files:** Create `src/diagram-view.js`. Modify `src/styles.css`.

**Interfaces:**
- Consumes:
  - `SS.createCanvas` (Task 6);
  - `SS.boxSize`, `SS.tidyLayout`, `SS.linkRoute(…, lane)`, `SS.selfLoopRoute`, `SS.labelPoint`, `SS.crowFoot` (Task 5);
  - `parseErd`'s Model.
- Produces: `SS.createDiagram(panel, { prefs, save, onPickRelationship(index), onHoverEnd(index, 'a'|'b'|null) })`, which returns `{ render(model), setStale(bool), highlight(index|null, end?: 'a'|'b'), tidy(), copyPng() }`. `highlight(i, 'b')` also emphasizes that one end's marks.

Rules:
- **Turning the model into geometry:** each entity becomes a table `{ name, columns }`, where the columns come from its attributes as `{ name, type, pk: keys has 'PK', fk: keys has 'FK' ? {} : null }`. For layering only, each relationship becomes `{ from: <the entity at a many end, or b>, to: <the other> }`. Boxes show `display`.
- **Positions:** kept per entity name across renders. New names are placed by `tidyLayout`. Renamed or removed names are dropped.
- **Lines:** if *k* relationships join the same unordered pair, they get lanes `0…k-1` centered around 0 (for 2: lanes −0.5 and +0.5). Self-relationships use `selfLoopRoute`. Labels are drawn at `labelPoint` on a small background so the line doesn't cross the text. `dashed` lines get `stroke-dasharray`.
- **Interaction:** each relationship group is focusable (`role="button"`, `aria-label` = its two readings). Click or Enter calls `onPickRelationship`. Hovering or focusing each end's marks calls `onHoverEnd`. Entities drag as in SQL Studio (pointer and arrow keys).
- `setStale(true)` adds class `stale`, which shows the diagram at `opacity:.45`.

- [ ] **Step 1: Build and syntax-check:** `node --check tools/erd-playground/src/diagram-view.js && node tools/erd-playground/build.js`. Expected: no errors. (Behavior is checked in Task 9's browser run.)

- [ ] **Step 2: Commit** `ERD Playground: diagram view with all four line ends, labels, lanes, and self-loops`.

---

### Task 9: Wire it together, and check it in a browser

**Files:** Create `src/app.js`. Modify `src/styles.css`.

**Interfaces:**
- Consumes: everything above.
- Produces the page, as in spec §4 (layout A):
  - **Header:** title; live count "3 entities · 3 relationships"; **Example** `<select>` (title, with the description under it); **Reset example**.
  - **Notation panel:** editor, **Copy**, a folding **Symbol cheat sheet** (a `<details>` with the four ends, each with a small `SS.crowFoot` drawing and 6.1's words, plus the five patterns), and a status line (`role="status"`).
  - **Diagram panel:** zoom, **Tidy**, **PNG**, and the canvas.
  - **Reading box** under the canvas: "Hover or click a line to read it.", or the two sentences for the active relationship (`**…**` rendered bold).

Behavior:
- Parse 300 ms after the last keystroke. With no errors: `render`, `setStale(false)`, clear the error mark, and set the status to "✓ Diagram is up to date", followed by the notes, one per line. With errors: `setStale(true)`, keep the last good diagram, `markError(errors[0])`, and set the status to `errors[0].message`.
- Cursor on a relationship line: `highlight(i)` and show its readings. Cursor inside an end symbol (`aSym` or `bSym` span): `highlight(i, 'a'|'b')`. Clicking a relationship in the diagram puts the cursor on its line and shows its readings. Hovering over an end: `markSymbol(rel.aSym or rel.bSym)`.
- Picking an example when the text differs from the current example's text asks `confirm('Replace your changes with this example?')`. Reset example also asks first.
- The page opens on `EXAMPLES[0]`. The count and the live region update after each good parse ("3 entities, 3 relationships.").
- Panels use `SS.makePanel` and `SS.splitter` with `prefs.js`. Below 760 px wide, the panels stack (Notation above Diagram).

- [ ] **Step 1: Build and run all tests:** `node tools/erd-playground/build.js && node --test tools/erd-playground/test/`. Expected: PASS with nothing skipped.

- [ ] **Step 2: Browser check.** Install `playwright-core@1.51.1` in a scratch folder and run Task 10's script with `--tool erd-playground`. Expected: "All checks passed."

- [ ] **Step 3: Commit** `ERD Playground: wire up editor, diagram, readings, examples, and cheat sheet`.

---

### Task 10: Browser and Mermaid checks (a scratch script, not in the repo)

**Files:** none in the repo. Write `check.js` in a scratch folder next to `node_modules/playwright-core`, and run it with `--tool erd-playground|sql-studio <path to dist html>`. Use `executablePath` for the newest `~/Library/Caches/ms-playwright/chromium-*`.

`--tool erd-playground` checks, at 1366×800, 820×1180 (touch), and 390×844, each in light and dark mode:
- The page opens with `ARTIST ||--o{ SONG` in the editor, one relationship drawn, and the count "2 entities · 1 relationship".
- Changing `o{` to `|{` in the editor redraws within 1 s, and the hover reading says "**one or more**".
- Typing `A ||--o B` keeps the old diagram with class `stale`, shows the status message starting "Line 2:", and adds an error mark in the editor. Fixing it clears all three.
- Removing the closing `}` of an attribute block (Review Focus 2) works the same way.
- Putting the cursor on line 2 highlights the relationship in the diagram, and putting it inside `o{` emphasizes that end. Clicking a relationship moves the cursor to its line, and hovering over an end marks its symbol in the editor.
- Every example loads; the confirm dialog is accepted with `page.on('dialog', d => d.accept())`. The `self` example draws a loop, and the `fantasy` example has no overlapping lines (Review Focus 3: no two relationship paths have identical point lists).
- Dragging an entity moves it, and a later edit doesn't move it back.
- PNG copies with the clipboard permission granted, and downloads without it.
- Keyboard-only: Tab reaches the picker, the editor, the splitter, and every relationship, each with a visible focus ring; Tab leaves the editor.
- AA contrast passes (the same contrast function as SQL Studio's check), with no console errors and no sideways scroll.

**Mermaid check** (once): a page that loads `https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js` and calls `await mermaid.parse(text)` for every `EXAMPLES[i].text`. Expected: all resolve.

`--tool sql-studio` runs SQL Studio's ERD regression: drag, zoom buttons, Ctrl+wheel, PNG both ways, Edit Links add and remove, hide and show a table, and Tidy, with no console errors.

- [ ] **Step 1: Write `check.js`, then run both tools.** Expected: "All checks passed" for both, and the Mermaid check resolves for all 10.
- [ ] **Step 2: Send David screenshots** (laptop light/dark, tablet, phone, and one with the reading box showing) with `SendUserFile`.

---

### Task 11: Course integration (after David says yes)

**Files:** Modify `tools/index.html` and `chapter-06.md`. Publish to `gh-pages`.

- [ ] **Step 1: Add a "Chapter 6" section to `tools/index.html`**, after Chapter 5's and in the same card style:
  - heading `<span class="chapter">Chapter 6</span> Data Modeling in Practice`;
  - about line "Type crow's foot notation and watch the diagram draw itself. This is Activity 6.0 in the chapter.";
  - a card linking `erd-playground.html`, titled **ERD Playground**, with the badge "Use with Chapter 6" and the description "See how text like ARTIST ||--o{ SONG becomes an ER diagram. Edit it, try the examples, and read each line both ways."
- [ ] **Step 2: Add Activity 6.0 to `chapter-06.md`** before its first activity, in the same gray-box markup as Activity 8.0 (em dashes, as Chapter 6 uses them). Text: "Explore crow's foot notation — the symbols at the ends of relationship lines — by editing examples and watching the ER diagram redraw, using this interactive tool." Link `https://kalendar.github.io/relational-thinking/erd-playground.html`. Add the "Activity 6.0 is the one exception: it uses an interactive tool instead of a prompt." sentence to the activities intro.
- [ ] **Step 3: Commit on master**, then **ask David** before publishing. After he says yes:
  - copy `dist/erd-playground.html` and `tools/index.html` to `gh-pages` (a worktree, as for SQL Studio) and push;
  - load the live page;
  - publish `chapter-06.md` with `publish_to_pressbooks.py --only chapter-06.md`. Chapter 6 is currently BLOCKED by the 1-second drift issue, so stop and ask David before using `--accept-current`.
