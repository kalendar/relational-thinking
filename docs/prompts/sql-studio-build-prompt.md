# Build prompt: SQL Studio (Chapter 8 practice tool)

Copy everything below the line into a new Claude Code session opened on the `relational-thinking` repository.

The tool is modeled on James Gaskin's *SQL Studio* ([overview video](https://www.youtube.com/watch?v=GLOcHiM3xmw)). The main changes are that it ships with this book's ten practice data sets instead of one movies demo, and it has an exercise panel like the one in the Query Explorer.

---

I want you to build a new browser-based practice tool called **SQL Studio** for my course, *Relational Thinking: An Introduction to Databases*. Students will use it with **Chapter 8, "Introduction to SQL with AI Assistance."** It is the next step after the **Query Explorer** (`tools/query-explorer/`). In the Query Explorer, students build queries from four operations without seeing any SQL. In SQL Studio they write real SQL against the same ten data sets, so the tables, keys, and stories will already be familiar.

Before you write any code, read these files so the new tool matches what is already here:

- `tools/query-explorer/src/datasets/*.js`: the ten data sets. **SQL Studio must use these files directly, not copies.** They are the single source of truth.
- `tools/query-explorer/build.js`, `src/index.html`, `src/styles.css`, `src/app.js`, `src/export-dialog.js`: the build approach, look, and exercise panel I want you to mirror.
- `docs/superpowers/specs/2026-10-13-query-operations-explorer-design.md`: the audience, reading level, and delivery rules. They all apply here too.
- `tools/index.html`, plus the Activity 7.0 box in `chapter-07.md`: you'll add an entry and an activity for the new tool in the same style.
- The Chapter 8 outline in `table-of-contents.md` (sections 8.1–8.4).

Then write a short design spec in `docs/superpowers/specs/` and an implementation plan in `docs/superpowers/plans/`, the way the Query Explorer was done. Check with me before you build.

## Audience and tone

- Undergraduate business students, ages 18–25. Many are writing SQL for the first time.
- Write all on-screen text at a 10th-grade reading level. Keep it short and friendly, with no jargon that isn't explained.
- This is for practice, not grading.

## Delivery

- Deliver one self-contained file, `tools/sql-studio/dist/sql-studio.html`. It is built by a Node script (`tools/sql-studio/build.js`) from separate source files in `tools/sql-studio/src/`, just like the Query Explorer.
- `build.js` reads the data set files straight from `../query-explorer/src/datasets/`. If I edit a data set there, both tools pick up the change on the next build.
- It must work when opened from a local disk and when hosted at `https://kalendar.github.io/relational-thinking/sql-studio.html`.
- **SQL engine:** use **sql.js** (SQLite compiled to WebAssembly). Vendor a pinned version into `tools/sql-studio/vendor/` and have `build.js` inline both the JS and the `.wasm` file (as base64) into the single HTML file, so nothing is loaded from a CDN at run time.
- **Editor:** use **CodeMirror 5** (vendored and pinned the same way), with the SQL mode and the show-hint add-on for autocomplete. If you think CodeMirror 6 is worth the extra bundling step, explain why in the spec.
- Google Fonts (Montserrat, Nunito Sans) are the only network request allowed, and the page must fall back to system fonts.
- Use the same color palette, fonts, and dark mode as the Query Explorer and `tools/index.html`.
- Primary target is a laptop-width browser. It must also work on a tablet (touch, pinch-to-zoom on the diagram). On a phone it should be usable, with panels stacking.
- Tests go in `tools/sql-studio/test/` and use `node:test` with no extra packages beyond the vendored sql.js.

## Screen layout

Match the original SQL Studio layout below, using this book's colors and fonts. Changes from the original are marked **(new)** or **(changed)**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [db] SQL Studio                  [Data set: 1. Spotify Streams ▾] [Upload]   │
│      3 tables · 2 relationships  Artists · Songs · Streams                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [v] Exercises (6)   1.1  How many total streams did each artist have…  (new) │
├─────────────────────────────────────────┬┬───────────────────────────────────┤
│ [v] SQL   [-] 100% [+]  [Random Query]  ││ [v] Results          [-] 100% [+] │
│           [Complexity] [Copy] [wand]    ││ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│                                 [▶ Run] ││   Run a query to display results. │
│ 1 │                                     ││ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ 2 │                                     ││                                   │
├─────────────────────────────────────────┴┴───────────────────────────────────┤
│ [v] ERD  (i) Pick a data set to begin.  [-] 100% [+] [Edit Links] [PNG] ☑ Attributes │
│ ░ dotted-grid canvas with draggable table boxes ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├──────────────────────────────────────────────────────────────────────────────┤
│ [v] Data   [Artists] [Songs] [Streams]   first 10 rows of the selected table │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Header**
- Show a database icon, the title "SQL Studio," and a live subtitle with the table and relationship counts (the original shows "0 selected tables · 0 confirmed relationships").
- **(changed)** The original's filled **Demo** button becomes the **data set picker**, which is the main action in the header. The selected set's `description` line sits under it.
- The original's **XLSX** button and Google Sheets URL box with a ▶ button become one smaller **Upload** button (see "Use my own data" below). Leave the URL box out.

**Exercises strip (new)**
- A full-width collapsible strip between the header and the editor. Collapsed, it shows "Exercises (N)" and the current question on one line.
- Expanded, it shows the full list (see the Exercises panel section below).

**SQL panel (left) and Results panel (right)**
- They sit side by side, with a draggable vertical splitter between them.
- Each panel header has:
  - a collapse chevron (`v`), an icon, and a bold panel name
  - its own text zoom: `−`, a percentage, `+`
- The SQL toolbar has, in order: **Random Query**, **Complexity**, **Copy** (copies the SQL), and the **magic wand** (format).
  - Complexity opens a small popover of checkboxes, the include-toggles described under "Random query generator."
  - The teal **Run ▶** button sits right-aligned below the toolbar. It is disabled while the editor is empty.
- The editor has line numbers, and the current line is highlighted.
- The Results panel's empty state is a dashed-border box that says "Run a query to display results."

**ERD panel**
- Full width, below a draggable horizontal splitter.
- Its header has the collapse chevron, the "ERD" label, and a status hint. The original says "Import the demo workbook to begin."; ours says "Pick a data set to begin." and changes to tips once a diagram is shown.
- On the right are the zoom controls, **Edit Links** (turns on add/delete relationship mode), **PNG** (copies the image), and an **Attributes** checkbox that shows or hides columns.
- The canvas has a light dotted or grid background.

**Data panel**
- Full width, below the ERD, with its own splitter.
- It has tabs for each table and shows the first 10 rows of the selected table, plus that table's total row count.

**Look and feel**
- Use white cards with thin borders and rounded corners on a near-white page.
- Buttons are outlined. The only filled buttons are the main action (the data set picker) and Run, which use the book's teal (`--teal` in `tools/index.html`).
- Use simple line icons, drawn as inline SVG, not an icon font.
- In dark mode, use the dark palette from `tools/index.html`.
- On narrow screens, the panels stack in this order: Exercises, SQL, Results, ERD, Data.

## Data sets

Load all **ten** Query Explorer data sets: Spotify Streams, Concert Tour, Netflix Binge, Thundering Herd Basketball, Campus Dining, Fantasy Football League, Box Office Weekend, Esports Tournament, TikTok Creators & Memes, and Music Festival Lineup.

- Put a **data set picker** in the header (`1. Spotify Streams`, `2. Concert Tour`, …) with each set's `description` line beneath it (for example, "Artists · Songs · Streams"). This replaces the single "Demo" button in the original tool. Load data set 1 when the page opens, so students never see an empty tool.
- Switching data sets builds a fresh in-memory SQLite database from that set's `tables`:
  - `number` columns become `INTEGER` (or `REAL` if any value has decimals).
  - `text` columns become `TEXT`.
  - `date` columns become `TEXT` in `YYYY-MM-DD` form, so SQLite date functions and `BETWEEN '2026-03-01' AND '2026-03-31'` work.
  - `key: 'pk'` becomes `PRIMARY KEY`, and `key: 'fk', ref: 'X'` becomes `REFERENCES X(...)`.
- When students switch data sets, keep each set's editor text separately for the session, so switching back doesn't wipe their work.
- Ignore the Query Explorer-only fields (`start`, `questions`, `recipe`). SQL Studio has its own exercises (see below).
- **Optional:** "Use my own data" lets a student upload a CSV or Excel file, with one sheet per table. Parse CSV with your own code. For Excel, use a vendored SheetJS, but only if it doesn't make the file much bigger; otherwise leave Excel out and say so. Skip the Google Drive link feature from the original video, because browsers block those downloads (CORS) without a server.

## Exercises panel

This works like the "Try this" panel in the Query Explorer.

- Store exercises in `tools/sql-studio/src/exercises.js`, keyed by data set `id`, in a format I can edit by hand:

  ```js
  spotify: [
    {
      text: 'How many total streams did each artist have in March 2026?',
      note: 'Optional extra prompt shown under the question',
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

- **Seed the exercises:** for every data set, start with the three questions already in its Query Explorer file (same wording, same `note`s). Then add **2–3 SQL-specific questions** per set that use what Chapter 8 teaches and the Query Explorer couldn't show: `ORDER BY`, `LIMIT`, `AND`/`OR`/`NOT`, `LIKE`, `DISTINCT`, calculated columns with `AS`, and `HAVING`. Every set should end up with 5–6 questions, ordered from easiest to hardest. Write a reference `answer` query for each one.
- Show them in the Exercises strip under the header (see Screen layout), numbered the same way as the Query Explorer (`1.1`, `1.2`, … for data set 1).
- Each exercise has a **Check my answer** button. It runs the student's current query and the hidden `answer`, then compares the results: the same columns (by count and position, not by name) and the same rows. Row order is ignored unless `orderMatters` is true. Numbers are compared with a small tolerance. The feedback is plain and kind, for example: "Close! Your result has 8 rows; the expected result has 7. Check your WHERE clause." It **never shows the answer SQL**.
- **Data sets 1–6 are for practice.** Each exercise there also has a **Show hint** button that names the clauses or tables needed, without giving the query (for example, "You'll need Streams, Songs, and Artists, a WHERE on the date, and a GROUP BY.").
- **Data sets 7–10 are for assessment,** matching the Query Explorer. They have no hints and no Check button. Only the question is shown.
- **Copy for homework:** copies plain text that a student can paste into an LMS. It includes the data set name, the exercise number and question, the student's SQL, and the first 20 result rows as a simple text table. Reuse the Query Explorer's export dialog pattern and its newline and bracket cleanup.

## Features to recreate from the video

**SQL editor panel**
- Autocomplete for SQL keywords and for the current data set's table and column names. After typing `TableName.` or an alias followed by `.`, suggest that table's columns.
- Run the query with **Ctrl+Enter / Cmd+Enter** or a **Run** button.
- Errors appear in a clear box, with SQLite's message rewritten in plain words where possible (for example, "There's no column called `address` in the `Position` table"). The box shows the **line and column** where the problem starts, and that spot is highlighted in the editor.
- A **Format** (magic wand) button pretty-prints the SQL. Formatting also happens automatically on Run, and the student can turn that off.
- If the editor holds several statements, run the one the cursor is in.

**Random query generator**
- A **Random query** button writes a valid query against the current data set and puts it in the editor.
- It has toggles for what to include: **WHERE, AND/OR, JOIN, aggregate (COUNT/SUM/AVG/MIN/MAX), GROUP BY, HAVING, calculated field, ORDER BY, LIMIT, DISTINCT, LIKE**.
- Generated queries must always run without error and use only real keys for joins (from the `pk`/`fk` metadata). Prefer queries that return at least one row.
- Tests must generate several hundred random queries per data set and confirm every one runs.

**Results panel**
- Results show 100 rows per page, with paging when there are more.
- A row and column count appears above the table (for example, "7 rows × 2 columns"). This supports the "Does the row count make sense?" habit from section 8.2.
- Hovering over (or focusing) a numeric column header gives options to add **thousands separators** and set **decimal places**. These change only the display, never the data.
- **Copy** puts the results on the clipboard as tab-separated text that pastes cleanly into Excel or Sheets. **Export CSV** downloads the results. Show Copy for up to 50 rows and Export CSV when there are more, as in the video, or show both all the time if that's simpler.

**ERD (diagram) panel**
- The ERD is drawn automatically from each data set's `pk`/`fk` metadata, so the ten built-in sets never need guessing. Draw it with SVG. Mark primary keys and foreign keys, and use crow's-foot or clear one-to-many ends to match how the book draws relationships.
- Tables can be dragged to new positions. A **Tidy** button lays the diagram out automatically.
- For uploaded data, guess the keys (an `_id` column whose name matches another table) and let the student fix them. Students can delete a relationship and drag from a foreign key column to a primary key column to add one.
- Students can hide or show a table's columns and hide whole tables, with zoom in, zoom out, and pinch-to-zoom.
- **Copy as PNG** copies the diagram as an image. If clipboard images aren't allowed, it downloads the image instead.

**Data preview panel**
- Tabs for each table show the first 10 rows, or all rows if there are fewer, with the total row count.

**Layout**
- Four panels: Editor, Results, ERD, and Data preview, plus the Exercises section. Each panel can be collapsed, expanded, and resized in both directions, and has its own zoom (text size) controls. Layout choices are saved in `localStorage` inside try/catch, and the tool still works if that fails.

**Accessibility**
- Everything works by keyboard alone, with a visible focus ring and a logical tab order.
- Use proper labels, roles, and `aria-live` announcements for "Query ran: 7 rows" and for errors. The results table is a real `<table>`.
- Text and color contrast meet WCAG AA in both light and dark mode.
- Honor `prefers-reduced-motion`.

## Course integration (after the tool works)

- Add a **Chapter 8** section to `tools/index.html` in the same card style, labeled "Use with Chapter 8."
- Add **Activity 8.0 – SQL Studio** to `chapter-08.md` in a gray box like Activity 7.0, linking to `https://kalendar.github.io/relational-thinking/sql-studio.html`. Note in the activities intro that it uses a tool, not a prompt.
- Copy the built file to wherever `query-explorer.html` is published, in the same way.

## Definition of done

- `node tools/sql-studio/build.js` produces one HTML file that works offline.
- All ten data sets load. Their ERDs show every relationship, and every exercise `answer` runs and returns at least one row.
- `node --test tools/sql-studio/test/` passes. It covers schema building, answer checking (including order and tolerance cases), the random query generator, error-message rewriting, formatting, and CSV/TSV export.
- In a real browser (use the pre-installed Playwright Chromium), run a quick check at laptop, tablet, and phone widths in light and dark mode. Check the keyboard-only path too. Send me screenshots.
- Commit in small steps with clear messages, like the Query Explorer history.
