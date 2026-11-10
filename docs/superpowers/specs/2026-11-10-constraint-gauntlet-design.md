# Constraint Gauntlet: Design Spec

**Date:** 2026-11-10
**Status:** Approved 2026-11-10 (decisions in §12)
**Textbook link:** Chapter 11, *Data Integrity and Constraints* (sections 11.1 and 11.2)
**Follows:** SQL Studio (`tools/sql-studio/`, spec `2026-10-19-sql-studio-design.md`)

## 1. Purpose

The Constraint Gauntlet is a browser tool where students try to put rows into a small campus ticketing database that has constraints on it. Sometimes the goal is to get good data in. Sometimes the goal is to sneak bad data past the rules. Then they fix the rules. Every rejected row is a real database error, so "the database is the last line of defense" (11.1) becomes something students run into, not just read.

SQL Studio is read-only on purpose. The Gauntlet is its write-side sibling: the first place in the course where students add, change, and delete rows.

**Success looks like:** a student can do these things on their own.
- Turn a plain-English business rule into NOT NULL, UNIQUE, composite UNIQUE, or CHECK (11.1).
- Decide when NULL is a legitimate value, and say whether it means "unknown" or "not applicable" (11.1).
- Explain why a constraint that is too loose lets bad data in, and why one that is too tight forces people to make data up (11.1).
- Read a constraint error and say which table, which rule, which value, and what to do next (11.2).
- Load rows across related tables in an order the database accepts (11.2).
- Predict what RESTRICT, CASCADE, and SET NULL will do to a delete, and pick soft deletion when a record has history (11.2).

**Audience:** undergraduate business students, ages 18–25. Most have written only SELECT queries (Chapter 8). All on-screen text is at a 10th-grade reading level: short, friendly, and any jargon is explained.

**Use:** in-class practice and homework, not grading. Levels 1–5 fit one class session for 11.1. Levels 6–8 fit one session for 11.2.

**Not covered here:** transactions, COMMIT/ROLLBACK, and ACID (11.3). The tool blocks `BEGIN`, `COMMIT`, and `ROLLBACK` so 11.3 can introduce them on its own terms.

## 2. Delivery

- One self-contained file, `tools/constraint-gauntlet/dist/constraint-gauntlet.html`. It works when opened from a local disk and when hosted at `https://kalendar.github.io/relational-thinking/constraint-gauntlet.html`.
- The only network request is Google Fonts (Montserrat, Nunito Sans), with system-font fallbacks.
- Primary target is a laptop-width browser (1024px and up). It also works on a tablet. On a phone it is usable, with the panels stacked.
- The look matches SQL Studio and `tools/index.html`: the same CSS color tokens, fonts, dark mode, icons, and button styles.

### Reused from SQL Studio

The Gauntlet is a separate tool, but it should not fork code it can share.

| What | How |
|---|---|
| sql.js 1.14.2, CodeMirror 5.65.21 | Same pinned files. `build.js` reads them from `../sql-studio/vendor/` and checks the same SHA-256 hashes in `VERSIONS.md`. No second copy. |
| `dom.js`, `icons.js`, `panels.js`, `editor.js` | Inlined from `../sql-studio/src/` at build time, unchanged. They attach to `window.SS`. The Gauntlet's own files use `window.CG` and read these helpers from `SS`. `panels.js` needs `SS.stepZoom`, which normally comes from SQL Studio's `prefs.js`. The Gauntlet supplies it in a one-line shim instead of importing `prefs.js`, which pulls in the random query generator. |
| `sql-text.js` (statement splitting) | Inlined. |
| `errors.js` | Inlined, used **only** for syntax errors in SQL mode (§5.2). Constraint errors get their own `constraint-errors.js` (§7). The error box looks the same. |
| `layout.js`, `prefs.js` | Not shared. They're built around SQL Studio's five panels. The Gauntlet has its own small `layout.js` and `prefs.js`, built on `panels.js`. |
| CSS tokens | Copied from SQL Studio's `styles.css`, as SQL Studio copied them from the Query Explorer. |

SheetJS is not needed and is not included.

### Source layout

The build plan (`docs/superpowers/plans/2026-11-10-constraint-gauntlet.md`) has the final file list. It adds `probe.js` and `session.js`, and folds `replay.js` into `rebuild.js`.

Logic lives in small pure files that load in Node for tests. DOM code is kept separate. Everything joins one namespace, `window.CG`.

```
tools/constraint-gauntlet/
  build.js                  # inlines vendor + shared + src into dist/
  src/
    index.html  styles.css
    levels/                 # one file per level (hand-editable), see §6
      01-required.js  02-blank-on-purpose.js  03-duplicates.js
      04-double-booked.js  05-price-rules.js  06-ghost-ticket.js
      07-load-day.js  08-delete-policies.js
    -- pure (Node-testable) --
    schema.js               # level schema -> DDL; rebuild a table with new constraints
    db.js                   # open a level db, PRAGMA foreign_keys, run one write statement
    statement.js            # allowlist: which statements may run in SQL mode
    rowform-sql.js          # row form values -> INSERT / UPDATE / DELETE text
    constraint-errors.js    # SQLite constraint errors -> plain words (+ FK diagnosis)
    rules.js                # hidden business rules; classify a row as legit or bad
    goals.js                # level goals as checks on database state + attempt log
    replay.js               # re-run every attempted row against new constraints
    blast.js                # row counts per table before/after a delete
    export.js               # "Copy for homework" text
    -- DOM --
    rowform-view.js  sql-view.js  tables-view.js  goals-view.js
    fix-view.js  blast-view.js  export-dialog.js  app.js
  test/
  dist/constraint-gauntlet.html
```

## 3. Screen layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [shield] Constraint Gauntlet        [Level: 3. Duplicate Accounts ▾] [Reset] │
│          Make each email belong to just one student.                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ [v] Goals  ✓ Register Jordan Lee  ✓ Get a UNIQUE error  ○ Sneak a duplicate… │
├───────────────────────────────────────┬┬─────────────────────────────────────┤
│ [Row form | SQL]          [Student ▾] ││ [v] Tables   [Student] [Ticket] …   │
│  student_id  [ 4        ]  auto       ││  student_id │ first_name │ email    │
│  first_name  [ Jordan   ]  required   ││  1          │ Maya       │ maya@…   │
│  email       [          ]  required,  ││  2          │ Jordan     │ jlee@…   │
│                            unique     ││  ┄ bounced: Taylor@… (UNIQUE) ┄     │
│  ─────────────────────────────────── ││                                      │
│  SQL this will run:                   ││                                      │
│  INSERT INTO Student (…) VALUES (…);  ││                                      │
│         [Add row]  [Edit a row] [Del] ││                                      │
├───────────────────────────────────────┴┴─────────────────────────────────────┤
│ [!] Result: error box / "Row added" / "Slipped through!"                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [v] Rules on this table (the CREATE TABLE)        [Fix the rule]  (locked)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Header
- A shield icon, the title **Constraint Gauntlet**, and the level's one-line mission.
- **Level picker** (filled teal): `1. Required Fields` … `8. Delete Policies`. A check mark shows next to completed levels. All levels are open. The order is a suggestion, not a lock.
- **Reset level** (outlined): rebuilds the level's database and clears its attempt log, after a confirm.
- The page footer: "All people and data are invented for practice."

### Goals strip
A full-width collapsible strip listing the level's goals with open circles that turn into check marks. When every goal is met, the strip turns green: **"Level complete."** Goals are explained in §6 and §8.

### Input panel (left): Row form or SQL
A two-tab switch at the top. **Row form is the default.** The choice is saved per browser.
- **Row form** (§5.1): one labeled field per column, a table picker, and the SQL it will run, shown live underneath.
- **SQL** (§5.2): a CodeMirror editor that runs INSERT, UPDATE, and DELETE on this level's tables.

### Tables panel (right)
Tabs for each table in the level. Accepted rows appear in the grid. The newest row flashes once. A rejected row shows as a dashed "bounced" line under the grid, with the rule that stopped it, until the next attempt. Foreign key columns get the same FK badge SQL Studio uses in its ERD.

### Result box
One of three states (§7):
- **Error** (red border, `role="alert"`): the database said no.
- **Row added / changed / deleted** (teal border): the database said yes.
- **Slipped through!** (amber border): the database said yes, but the row breaks a business rule.

### Rules panel (bottom)
Shows the CREATE TABLE for the selected table, formatted the way the book prints it, with each constraint highlighted. **Fix the rule** opens the editor in §8. It stays locked until the level's "sneak it past" goal is met, so students find the hole before they patch it.

## 4. Data and the database

### The level schema
Every level uses tables from one campus-ticketing world, named as in Chapter 11 so the code students see matches the book: `Student`, `Venue`, `Concert`, `Ticket`, plus `Scan` (gate scans of a ticket) for Level 8 and `Team`/`Player` for the Level 7 bonus. Each level declares only the tables and constraints it needs, in its own starting version. So Level 1's `Ticket` has NOT NULL rules but no CHECK yet, and Level 5's has both.

Columns are declared with the book's types (`INT`, `VARCHAR(255)`, `DECIMAL(8,2)`, `DATE`, `TIME`, `BOOLEAN`). SQLite accepts these names. Dates and times are stored as `YYYY-MM-DD` and `HH:MM` text, so comparisons like `end_time > start_time` work.

Foreign keys are always written with an explicit `ON DELETE RESTRICT` (or CASCADE / SET NULL where a level needs it). SQLite's default is `NO ACTION`, which acts the same way here. But the book calls the default RESTRICT, so the code shown should say RESTRICT.

### Seed data
Each level starts with a few rows (3–6 students, 2–4 venues, 3–5 concerts), so the database isn't empty and there's something to collide with. Names follow the book's style: real artists, made-up students. Seed data is checked by tests (§13).

### SQLite behaviors the tool must handle
Each of these was checked against SQLite directly while writing this spec. The tests repeat the checks against the vendored sql.js.

1. **Foreign keys are off by default.** `db.js` runs `PRAGMA foreign_keys = ON` right after opening the database, before any other statement. SQLite **ignores this pragma inside an open transaction**, so it must run first, and `db.js` checks it with `PRAGMA foreign_keys` (expects `1`) after setup. A test proves that a ticket for a missing student is rejected.
2. **The foreign key error says almost nothing.** For an insert, update, or delete, SQLite says only `FOREIGN KEY constraint failed`: no table, no column, no value. Chapter 11.2 tells students an FK error tells them which table, constraint, and value. So `constraint-errors.js` works it out (§7.2).
3. **SQLite stores text in number columns.** `DECIMAL(8,2)` accepts `'free'`. Because SQLite sorts all text above all numbers, `CHECK (price_paid >= 0)` lets `'free'` through. The book doesn't teach column-type affinity, so the tool blocks this in both modes:
   - The row form checks types before it builds the SQL ("price_paid needs a number").
   - Every numeric column in a level schema gets a hidden extra check, `CONSTRAINT cg_type_<col> CHECK (<col> IS NULL OR typeof(<col>) IN ('integer','real'))` (or `'integer'` for INT). The `IS NULL OR` part matters: `typeof(NULL)` is `'null'`, so without it the hidden check would block NULL where the visible rules allow it. Dates, times, and booleans get the same kind of hidden check (§ plan Task 2). This also catches text typed in SQL mode. The Rules panel hides these extra checks, so the CREATE TABLE students see matches the book. Their errors get their own plain message (§7).
4. **`changes()` does not count cascaded rows.** A delete that cascades to 10 rows still reports 1 change. `blast.js` counts rows in every table before and after a delete instead (§9).
5. **UNIQUE allows many NULLs.** Two students with no `secondary_email` are both accepted. This matches 11.1 ("multiple NULLs are allowed in a UNIQUE column") and is used as a predict question in Level 3.
6. **UNIQUE is case-sensitive.** `taylor@marshall.edu` and `Taylor@marshall.edu` are both accepted under plain `UNIQUE`. `UNIQUE COLLATE NOCASE` blocks the second one. Level 3 is built on this.
7. **`LIKE` is case-insensitive in SQLite, and `'%@%'` accepts `'@'` alone.** Level 5's sneak-past uses this.
8. **An `INT PRIMARY KEY` column accepts NULL** (an old SQLite bug kept for compatibility), and more than once. `schema.js` always writes `NOT NULL` on primary key columns. The DDL shown to students already includes it, as in the book's examples.
9. **Constraint names appear in errors.** A named check (`CONSTRAINT ends_after_start CHECK (…)`) fails with `CHECK constraint failed: ends_after_start`. An unnamed one shows its expression (`CHECK constraint failed: price_paid >= 0`). Both are mapped (§7).

### What may run
`statement.js` decides what runs in SQL mode. Allowed: `INSERT`, `UPDATE`, `DELETE`, and `SELECT` (so students can look things up). Everything else gets a friendly no:

| Typed | Message |
|---|---|
| `CREATE`, `ALTER`, `DROP` | "To change the rules, use **Fix the rule** below. That keeps your table's data safe." |
| `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` | "Transactions come in section 11.3. This tool runs each statement on its own." |
| `PRAGMA`, `ATTACH`, `VACUUM`, others | "The Gauntlet runs INSERT, UPDATE, DELETE, and SELECT." |

Only one statement runs at a time: the one the cursor is in, using SQL Studio's `sql-text.js`.

## 5. Input modes

### 5.1 Row form (default)
- **Table picker** chooses the target table. A level can limit it (Level 1 shows only `Ticket`).
- **Actions:** **Add row** (INSERT), **Edit a row** (pick a row in the grid → fields fill in → **Save changes** runs an UPDATE), and **Delete** (pick a row → DELETE).
- **One field per column**, labeled with the column name and a short hint drawn from the constraints: "required", "unique", "1–10", "must match a Student". The hints come from the schema, not from level text, so a fix in §8 updates them.
- **Blank means NULL.** A field left empty sends `NULL`, and the SQL preview says so. There is no "empty string" in the form. To send `''`, use SQL mode. This keeps 11.1's NULL lesson clean.
- **Primary key fields** suggest the next free ID ("auto"), and students can type over it. Level goals sometimes ask for a duplicate on purpose.
- **Foreign key fields** are plain number inputs, not dropdowns. A dropdown of existing students would make orphaned rows impossible to type, and Level 6 needs students to be able to try. A small "look up" link shows the parent table's IDs.
- **Type checks** happen before anything runs: numbers, `YYYY-MM-DD` dates, `HH:MM` times, true/false. A type problem shows under the field and does not count as an attempt.
- **Live SQL preview** underneath shows the exact statement, formatted the book's way, with a **Copy SQL** button. **Open in SQL tab** copies it into the editor so students can change it there. That's the bridge into SQL mode.

`rowform-sql.js` builds the SQL. Text values are quoted with `'` doubled inside. Numbers and booleans are written bare. NULL is written `NULL`. Column order follows the schema.

### 5.2 SQL mode
- CodeMirror 5 with SQL Studio's settings (line numbers, active line, Tab not captured, Ctrl/⌘+Enter runs, autocomplete from the level's tables).
- The editor starts with a commented example for the level, for example:
  ```sql
  -- Try adding a ticket. Press Run (or Ctrl+Enter).
  INSERT INTO Ticket (ticket_id, student_id, concert_id, price_paid, purchase_date)
  VALUES (6, 2, 1, 45.00, '2026-11-10');
  ```
- Syntax errors are rewritten by SQL Studio's `errors.js` table where it fits (`near "X": syntax error`, `no such column`, `no such table`). A syntax error does not count as an attempt. Only statements that reach the constraints count.
- Each level keeps its own editor text for the session.

## 6. Levels

### Format (`src/levels/NN-name.js`)
```js
CG.levels.push({
  id: 3,
  title: 'Duplicate Accounts',
  section: '11.1',
  mission: 'Make each email belong to just one student.',
  tables: { Student: { columns: [...], constraints: [...] } },
  seed: { Student: [ ... ] },
  goals: [ { id, text, kind, ...params } ],      // §8
  rules: [ { id, table, text, check(row, db) } ], // hidden business rules
  legitRows: [ ... ], badRows: [ ... ],          // fixed test set for Fix the rule
  fix: { table, options: [ ... ] } ,             // §8
  predict: [ { before, question, choices, answer, why } ]
});
```

**Goal kinds** (all checked in `goals.js` against the database and the attempt log, the same way every time, with no AI judging):
- `accepted`: a row matching a pattern is in the table.
- `rejected-by`: at least one attempt was rejected by a given constraint type (and column, if given).
- `slipped`: at least one accepted row breaks a given business rule.
- `fixed`: after Fix the rule, every `legitRows` row is accepted and every `badRows` row is rejected (§8).
- `predicted`: the student answered a predict question (right or wrong both count. The answer and why are shown afterward).
- `state`: a custom check on the database (row counts, a report value).

**Predict questions** appear as a small card before a key attempt: "Will the database accept this?" or "How many rows will disappear?" The student picks an answer, then the tool runs the statement. Answers are shown, never scored.

### Level 1 — Required Fields (11.1, NOT NULL)
- **Tables:** `Ticket` (all five columns NOT NULL, as in the book's first example). Seed: 4 tickets.
- **Goals:**
  1. Add a complete ticket.
  2. Get a NOT NULL error on three different columns.
  3. **The missing ticket.** Switch to "Loose version": the same table with `purchase_date` allowed to be NULL. Add a ticket with no date. A **"November revenue" report card** (a fixed SELECT with `WHERE purchase_date BETWEEN …`) next to a **"All tickets" total** shows the two numbers disagree. The goal is met when they disagree.
- **Takeaway shown at the end:** "The loose table didn't give you an error. It gave you a wrong report. That's worse."

### Level 2 — Blank on Purpose (11.1, NULL: unknown vs. not applicable)
This level is a decision level, not an insert level.
- **Tables:** `Student` (`student_id`, `first_name`, `middle_name`, `last_name`, `email`, `secondary_email`, `has_secondary_email`) and `Ticket` (adds `seat_number`, `refund_date`).
- **The decision:** for each column, a switch: **Required** or **Can be blank**. For each "can be blank" column, a second choice: **Blank means "unknown"** or **Blank means "not applicable."**
- **Run the batch:** the tool rebuilds the tables from the choices and loads a batch of 12 realistic rows: a student with no middle name, a lawn ticket with no seat number (general admission), a ticket that was never refunded, a ticket with a missing purchase date (bad), a student with no last name (bad), and so on. Each row is labeled legit or bad by the level's rules.
- **Feedback:** two lists. "Rejected but real" (too strict: "Ana has no middle name. Your rule would make her type 'N/A'.") and "Accepted but bad" (too loose).
- **Goals:** a batch run with no rows in either list, and the unknown/not-applicable tags matching the key: `gpa` is "unknown" (a first-semester student), and `refund_date` and `seat_number` are "not applicable". `middle_name` and `secondary_email` accept either tag, because the chapter allows both readings for them. `secondary_email`'s explanation introduces `has_secondary_email`, as in the chapter. (The plan adds `gpa` to this level's tables so there is a clear "unknown" case.)

### Level 3 — Duplicate Accounts (11.1, UNIQUE)
- **Tables:** `Student` with `mu_id VARCHAR(9) NOT NULL UNIQUE`, `email VARCHAR(255) NOT NULL UNIQUE`, `secondary_email VARCHAR(255) UNIQUE` (nullable).
- **Goals:**
  1. Register Jordan Lee.
  2. Get a UNIQUE error on `mu_id` and one on `email`.
  3. **Predict, then try:** "Two students with no secondary email. Will UNIQUE stop the second one?" (No. NULL isn't equal to NULL.)
  4. **Sneak it past:** get the same person in twice. Business rule: "an email address belongs to one person, whatever the capital letters." `Taylor@marshall.edu` slips through.
  5. **Fix the rule:** choose from
     - `UNIQUE (email, first_name)`: too loose. The fix test rejects it.
     - `email … UNIQUE COLLATE NOCASE`: correct.
     - remove UNIQUE and "check it in the app": the fix test rejects it, with a pointer to 11.4.

### Level 4 — Double-Booked Venue (11.1, composite UNIQUE)
- **Tables:** `Venue`, `Concert` (`venue_id` FK, `concert_date`). The **starting rule is too strict on purpose**: `UNIQUE (venue_id)`.
- **Goals:**
  1. Try to add a second show at the Mountain Health Arena on a different night. It's rejected, but it shouldn't be. The result box says: "The database said no. But is this row actually wrong?" (This is a "too strict" moment. The Fix button unlocks here, not after a slip-through.)
  2. **Fix the rule:** choose from `UNIQUE (concert_date)`, `UNIQUE (venue_id, concert_date)`, `UNIQUE (venue_id), UNIQUE (concert_date)`.
  3. After the fix, three predict-then-try rows: same venue on different dates (accepted), different venues on the same date (accepted), same venue on the same date (rejected).

### Level 5 — Price and Quantity Rules (11.1, CHECK)
- **Tables:** `Ticket` with `price_paid … CHECK (price_paid >= 0)`, `quantity … CHECK (quantity BETWEEN 1 AND 10)`, `seat_section … CHECK (seat_section IN ('Floor','Lower','Upper','Lawn'))`. `Concert` with `CONSTRAINT ends_after_start CHECK (end_time > start_time)`. `Student.email … CHECK (email LIKE '%@%')`.
- **Goals:**
  1. Trip each of the four CHECKs once.
  2. **Sneak it past** (two of three is enough):
     - a $0.00 ticket (business rule: "tickets sold here cost more than $0. Free comps are handled by the box office."),
     - an email of just `@`,
     - a section of `'floor'` in lower case. (`IN` is case-sensitive, so this one is actually **rejected**. It's a predict question, not a slip-through, and shows that rules can be stricter than people expect.)
  3. **Fix the rule:** in Row form mode, a small builder (column ▾, operator ▾, value). In SQL mode, type the CHECK expression. Reference fixes: `price_paid > 0`, and `email LIKE '_%@_%._%'`.
- **Note on the chapter:** 11.1 now says "a ticket price can't be negative" (changed 2026-11-10 to match the book's `CHECK (price_paid >= 0)`). The $0 slip-through stays, because this level's own business rule ("tickets sold here cost more than $0") is stricter than the book's example. The explanation says so: "The chapter's rule allows free tickets. This box office doesn't. Rules depend on the business."

### Level 6 — Ghost Ticket (11.2, foreign keys)
- **Tables:** `Student`, `Concert`, `Ticket`. Starts in a **"No FK" version**: `student_id` and `concert_id` have no `REFERENCES`.
- **Goals:**
  1. Buy a ticket for `student_id` 99999. It's accepted.
  2. A **"Tickets by student" report card** (a JOIN with a row count) shows one ticket fewer than the Ticket table. The orphan is highlighted: "This ticket doesn't belong to anyone, so the join can't find it."
  3. **Add the rule:** a one-click fix, "Add REFERENCES Student(student_id)". The rebuild reports that the existing orphan blocks it: "Your table already has a ticket for a student who doesn't exist. Fix or delete it first." (Real databases refuse to add an FK over bad data too.)
  4. With the FK on: get an FK error on INSERT, and one on UPDATE (change a ticket's `student_id` to 42).
  5. Read the error: a three-part question ("Which table? Which column? Which value?") filled in from the student's last FK error, with the answers revealed.

### Level 7 — Load Day (11.2, parent before child)
- **Tables:** `Venue`, `Concert`, `Student`, `Ticket`, all empty.
- **The stack:** 12 row cards, shuffled: 2 venues, 3 concerts, 3 students, 4 tickets. In Row form mode, students click a card to insert it. In SQL mode, the cards are a list of INSERT statements they can run in any order (one at a time, or all of them top to bottom).
- **Bounces:** a rejected card goes back to the stack with its error. A bounce counter is shown, not scored.
- **Goals:** all 12 cards loaded. Then a predict question: "Which order always works?" with the dependency order from 11.2 as the answer.
- **Bonus round: The Captain Problem.** `Team (captain_id → Player)` and `Player (team_id → Team)`, both NOT NULL to start. No order works. The hint ladder leads to: make `captain_id` allowed to be blank (Fix the rule), insert the team with no captain, insert the players, then UPDATE the team's captain. Goal: both tables loaded with a captain set.

### Level 8 — Delete Policies (11.2, RESTRICT / CASCADE / SET NULL / soft delete)
- **Tables:** `Student` (adds `is_active BOOLEAN NOT NULL DEFAULT true`), `Ticket` (FK to Student), `Scan` (FK to Ticket: each time a ticket is scanned at the gate). Seed: Jordan has 3 tickets with 2 scans each, plus other students.
- **Round 1: try each policy.** A policy switch on `Ticket.student_id` (RESTRICT / CASCADE / SET NULL) and on `Scan.ticket_id` (RESTRICT / CASCADE). Before each delete of Jordan, a predict card asks: "How many rows will disappear?" Then the **blast radius** panel (§9) shows what happened. With CASCADE on both: 1 + 3 + 6 = 10 rows. Reset restores the data between tries.
- **Round 2: soft delete.** **Mark inactive** runs `UPDATE Student SET is_active = false WHERE …`. The "Concert revenue" report card keeps its total. With CASCADE, it doesn't.
- **Round 3: choose the policy.** Four relationships, one choice each:
  - `Ticket → Student` (a student leaves school),
  - `Scan → Ticket` (a scan log for a ticket),
  - `Concert → Venue` (a venue closes),
  - `ConcertPerformer → Concert` (a concert created by mistake, no tickets sold).

  The tool runs a fixed set of test deletes under the student's choices and explains each outcome. The level's key accepts more than one answer where the book does (for example, `Scan → Ticket` can be CASCADE or RESTRICT). `Ticket → Student` must not be CASCADE. The explanation points to soft delete.
- **Goals:** each policy tried once, one prediction made, a soft delete done, and Round 3 passed.

## 7. Feedback

### 7.1 The result box
Same three-part layout as SQL Studio's error box:
1. A plain-words headline.
2. A **"Which table · which rule · which value"** line, as three small labeled chips. This is the 11.2 reading skill, shown the same way every time.
3. SQLite's original message in small text, labeled **"What SQLite said"**.

The column in the row form is outlined in red. In SQL mode, the value's token gets a wavy underline.

### 7.2 Constraint errors (`constraint-errors.js`)

| SQLite says | Students see |
|---|---|
| `NOT NULL constraint failed: Ticket.price_paid` | Every ticket needs a `price_paid`. You left it blank. |
| `UNIQUE constraint failed: Student.email` | Another student already has the email `taylor@marshall.edu`. Each email can belong to only one student. *(value read from the attempted row)* |
| `UNIQUE constraint failed: Concert.venue_id, Concert.concert_date` | Venue 3 (Mountain Health Arena) already has a concert on 2027-02-14. One show per venue per night. |
| `UNIQUE constraint failed: Ticket.ticket_id` (primary key) | There's already a ticket with `ticket_id` 6. Each ticket needs its own ID. Try 7. |
| `CHECK constraint failed: price_paid >= 0` | `price_paid` must be 0 or more. You entered `-5`. *(plain text per CHECK comes from the level file. Fallback below)* |
| `CHECK constraint failed: ends_after_start` | The concert has to end after it starts. You entered 19:00 to 18:00. |
| `CHECK constraint failed: typeof(…)` (hidden type check) | `price_paid` needs a number. `'free'` is text. |
| `CHECK constraint failed: <anything else>` | This row breaks the rule `<expression>` on the `<table>` table. |
| `FOREIGN KEY constraint failed` on INSERT/UPDATE | There's no Student with `student_id` 99999. Add the student first, or check the ID. *(diagnosed, see below)* |
| `FOREIGN KEY constraint failed` on DELETE | Student 1 (Jordan Lee) still has 3 tickets. The rule `ON DELETE RESTRICT` blocks the delete. Delete or move those tickets first, or mark Jordan inactive instead. *(diagnosed)* |
| anything else | Something went wrong. (the original message is shown below) |

**FK diagnosis.** Because SQLite's FK message names nothing (§4.2):
- **INSERT/UPDATE:** for each foreign key on the target table, the tool runs `SELECT 1 FROM Parent WHERE pk = ?` with the attempted value. The first one with no match is the one reported. If more than one fails, the message lists all of them.
- **DELETE:** for each child table that references the target with RESTRICT, it counts the matching child rows and reports the first table with any.
- The diagnosis runs only after SQLite has already rejected the statement, so SQLite stays in charge of the decision. The tool only explains it.

### 7.3 "Slipped through!"
After every accepted INSERT or UPDATE, `rules.js` checks the new row against the level's hidden business rules. If one fails, the result box turns amber: **"Slipped through! The database accepted this, but it breaks the rule: *an email needs real text on both sides of the @*."** The row is marked with an amber dot in the grid. Business rules are plain JS checks on the row (and, if needed, the database), written in the level file next to the rule's sentence.

### 7.4 "Is this row actually wrong?"
When a level's starting rule is too strict (Levels 2 and 4), a rejected row that the business rules call legit gets a second line under the error: **"The database said no. But this looks like a real concert. Is the rule too strict?"**

## 8. Fix the rule (`fix-view.js`, `schema.js`, `replay.js`)

SQLite can't change a constraint in place, so a fix rebuilds the table:
1. Build the new CREATE TABLE from the student's choice.
2. Create it under a temporary name, copy the rows across with `INSERT … SELECT`, drop the old table, and rename the new one. The order matters: turn foreign keys off **first** (SQLite ignores the pragma inside a transaction, §4.1), then run the rebuild inside the tool's own internal transaction, commit, turn foreign keys back on, and run `PRAGMA foreign_key_check`. (Students never see this.)
3. If existing rows break the new rule, the rebuild stops and lists them, and the table is left as it was (Level 6 uses this on purpose).

**The fix test.** After a successful rebuild, `replay.js` re-runs every row the student attempted in this level, plus the level's fixed `legitRows` and `badRows`, against a fresh copy with the new rule. The result is a small table:

| Row | Before | After | Verdict |
|---|---|---|---|
| Taylor@marshall.edu | accepted | rejected | ✓ bad row now blocked |
| Ana Ruiz, no middle name | accepted | accepted | ✓ real row still allowed |
| … | | | ✗ real row now blocked (too strict) |

The `fixed` goal is met when every bad row is rejected and every legit row is accepted. A choice that fails gets an explanation tied to the failing row, and the student can try again.

**Choices vs. typing.** In Row form mode, fixes are multiple choice (Levels 3, 4, 6, 8) or the small CHECK builder (Level 5). In SQL mode, Level 5 also accepts a typed CHECK expression. It is parsed only as an expression (no `;`, no subqueries) and then put into the rebuilt DDL.

## 9. Blast radius (`blast.js`, `blast-view.js`)

Before any DELETE, the tool counts the rows in every table in the level. After it runs, it counts them again and shows the difference as a small bar per table:

```
Delete Student 1 (Jordan Lee) — ON DELETE CASCADE
  Student   ▇            −1
  Ticket    ▇▇▇          −3
  Scan      ▇▇▇▇▇▇       −6
  ─────────────────────────
  10 rows gone from one DELETE
```

SET NULL shows "3 tickets now have no student" instead of a minus. RESTRICT shows "Blocked, 0 rows changed". This replaces `changes()`, which counts only the parent row (§4.4). With `prefers-reduced-motion`, the bars appear without animation.

## 10. Copy for homework (`export.js` + `export-dialog.js`)

Adapted from SQL Studio's dialog (same modal, focus trap, Escape, Copy with fallback, Download .txt). It exports one level's work as plain text the student can paste into an AI follow-up or hand in:

```
Constraint Gauntlet — Level 3: Duplicate Accounts (Chapter 11.1)
Goals: 5 of 5 complete

Attempts (8): 5 accepted, 2 rejected, 1 slipped through
  ✗ REJECTED  INSERT INTO Student … 'jlee@marshall.edu' …
              UNIQUE on Student.email
  ! SLIPPED   INSERT INTO Student … 'Taylor@marshall.edu' …
              breaks: an email belongs to one person, whatever the capitals
  …

My fix:
  email VARCHAR(255) NOT NULL UNIQUE COLLATE NOCASE
Fix test: 6 bad rows blocked, 9 real rows allowed

Predictions:
  "Two students with no secondary email — will UNIQUE stop the second?"
  I said: Yes. Answer: No.
```

The SQL is the statement that ran (from the form or the editor). The list is capped at 20 attempts, newest first.

## 11. Layout, persistence, and accessibility

- **Layout:** same splitters, collapse, per-panel zoom, and stacked phone layout as SQL Studio (`layout.js`), saved under `constraintGauntlet.layout.v1`.
- **Progress:** completed goals per level, and the Row form / SQL choice, are saved in `localStorage` under `constraintGauntlet.progress.v1`. The database and attempt log are not saved. Reloading restarts a level's data but keeps its check marks. Every read and write is wrapped in try/catch, and the tool works the same with storage blocked.
- **Keyboard:** everything works by keyboard. Tab order: header → Goals → input mode tabs → form fields (or editor) → actions → result → Tables → Rules → Fix. Grid rows are selectable with arrow keys and Enter for Edit and Delete.
- **Live regions:** one polite `aria-live` region announces "Row added", "Slipped through", goal check marks, and "Level complete". The error box uses `role="alert"`.
- **Color is never the only signal.** Error, added, and slipped-through each have an icon and a word as well as a border color. Bounced and slipped rows have a text label.
- **Contrast and reduced motion:** as in SQL Studio (WCAG AA in both themes; no transitions with `prefers-reduced-motion`).

## 12. Decisions (settled 2026-11-10)

1. **Level 5 and the chapter text:** the chapter was fixed. 11.1 now says "a ticket price can't be negative," matching its `>= 0` code. Level 5 keeps its $0 slip-through, with the explanation in §6.
2. **Saving progress:** completed goals are saved per level (§11). The data and attempt log are not.
3. **Level 7 in SQL mode:** both ways are allowed: one card at a time, or **Run all** from top to bottom. Run all keeps going after a bounce and reports every bounce at the end.
4. **Level 8 Round 3 key:** approved as written in §6.
5. **Publishing:** through a pull request. The CI deploys the tools site to GitHub Pages when the PR merges.

## 13. Testing

**Node tests** (`node --test tools/constraint-gauntlet/test/`, using only the vendored sql.js):
- **db:** `PRAGMA foreign_keys` reads `1` after open. An orphan INSERT, an orphan UPDATE, and a RESTRICT DELETE are all rejected. CASCADE and SET NULL behave as expected.
- **SQLite behaviors (§4):** each numbered behavior has a test against the vendored sql.js: text in DECIMAL with and without the hidden type check, many NULLs in UNIQUE, case and `COLLATE NOCASE`, `LIKE '%@%'` with `'@'`, named and unnamed CHECK messages, and `changes()` after a cascade. If an sql.js upgrade changes any of these, the tests fail before students notice.
- **constraint-errors:** every row of the §7.2 table, from a real sql.js error and attempted row to the expected message and the three chips, including FK diagnosis with one and with two missing parents.
- **rowform-sql:** quoting (`O'Brien`), NULL for blank fields, numbers and booleans bare, column order, and UPDATE/DELETE by primary key. Every generated statement runs in sql.js.
- **statement:** the allowlist, and the friendly message for each blocked kind, including statements after a comment.
- **levels:** for every level:
  - the schema builds, and the seed data loads with foreign keys on,
  - every goal can be met by a scripted solution (a test drives each level from start to "Level complete"),
  - the reference fix passes the fix test, and every wrong fix choice fails it on at least one named row,
  - every `legitRows` row passes the level's business rules, and every `badRows` row fails at least one,
  - the hidden type checks never show in the Rules panel's DDL.
- **replay / fix:** a rebuild keeps all rows, a rebuild over bad data stops and leaves the table unchanged, and `foreign_key_check` is clean afterward.
- **blast:** per-table counts for the Level 8 seed under each policy combination (RESTRICT, CASCADE→CASCADE = 10, CASCADE→RESTRICT blocked, SET NULL).
- **export:** layout, the 20-attempt cap, and line cleanup.
- **build:** the output exists, has no `</script` inside inlined code, contains the wasm, makes no `http` requests other than fonts, and vendor hashes match `../sql-studio/vendor/VERSIONS.md`.

**Browser check** (Playwright Chromium, script in the scratchpad, not a repo dependency): laptop, tablet, and phone, in light and dark mode. For each level: load, make one accepted, one rejected, and one slipped-through attempt in Row form, repeat one in SQL mode, open Fix the rule, and reach "Level complete" via the scripted solution. Also a keyboard-only pass. Screenshots go to you.

## 14. Course integration

- `tools/index.html` gets a "Chapter 11" card labeled "Use with Chapter 11", linking to `constraint-gauntlet.html`.
- `chapter-11.md` gets **Activity 11.0 — Constraint Gauntlet** in a gray box like Activity 8.0, linking to the hosted tool. It suggests Levels 1–5 after 11.1 and Levels 6–8 after 11.2. The activities intro gets the same "one exception" sentence Chapter 8 uses.
- Optional: Activity 11.2 (Design the Constraints) can mention that students can test their choices in the Gauntlet's Fix the rule step.
- The concept graph: check that Activity 11.0 introduces nothing (INSERT, UPDATE, DELETE syntax) that a later chapter treats as new. Chapter 12 uses one INSERT. That's fine, since it comes after Chapter 11.

## 15. Out of scope

- Transactions, COMMIT/ROLLBACK, and ACID (section 11.3; possibly a later "Transaction Tracer" tool).
- Triggers, and application-level validation (11.4 discusses these in text).
- Students writing whole CREATE TABLE statements from scratch.
- Data sets other than the campus ticketing world. Uploading their own data.
- Accounts, grading, or a teacher dashboard.
- An AI assistant inside the tool. Chapter 11's AI practice stays in the AI activities.
- Embedding in Pressbooks.
