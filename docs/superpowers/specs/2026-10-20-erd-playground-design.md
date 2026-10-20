# ERD Playground: Design

**Date:** 2026-10-20
**Status:** Draft for review
**Textbook link:** Chapter 6, *Data Modeling in Practice*, section 6.1 "Reading and drawing ER diagrams"
**Siblings:** Query Explorer (Chapter 7), SQL Studio (Chapter 8). This tool follows their conventions and reuses SQL Studio's code where it fits.

## 1. Intent

Chapter 6 teaches crow's foot notation as text: `ARTIST ||--o{ SONG : "records"`. To a student meeting it for the first time, the notation is simply unfamiliar. Nothing in it is conceptually hard, but they haven't seen enough of it yet. They get comfortable by seeing **lots of examples** and by **playing**: changing a symbol and watching the diagram change. (David)

The ERD Playground is that place. Students type the chapter's notation on one side and see the diagram it draws on the other.

**Success looks like:** after a few minutes in the tool, a student can look at `||`, `o|`, `|{`, and `o{` and say what each end means, read a relationship line in both directions the way 6.1 teaches, and write the notation for a small diagram themselves.

**Audience:** undergraduate business students, ages 18–25. All on-screen text is at a 10th-grade reading level. Examples use music, sports, streaming, and campus life, like the rest of the book.

## 2. Goals, non-goals, anti-goals

**Goals**
- The tool opens with an example already loaded and drawn. Students never see an empty tool. (David)
- The notation is editable, and the diagram redraws as you type. (David)
- Many examples are one click away. (David)
- The connection between a piece of text and a piece of the picture is easy to see.

**Non-goals (for now)**
- Exercises, answer checking, and "Copy for homework." It's a playground only. (David: "Let's leave it as playground for now.")
- Turning an ERD into tables (6.3), design warnings (6.4), and turning narratives into ERDs (6.2). These could come later.
- Uploading files, saving to an account, or sharing links.

**Anti-goals: it fails if…**
- the notation it accepts differs from what Chapter 6 prints, or from Mermaid's syntax, so that something learned here breaks in the book's diagrams or in an AI tool;
- a typo blanks the diagram or shows a raw parser error;
- the first screen feels like a blank editor a student has to figure out.

## 3. Constraints (same as the sibling tools)

- **Delivery:** one self-contained file, `tools/erd-playground/dist/erd-playground.html`, built by `tools/erd-playground/build.js` from `src/`. It works from a local disk and at `https://kalendar.github.io/relational-thinking/erd-playground.html`. The only network request is Google Fonts, with system-font fallbacks.
- **Look:** the Query Explorer's color tokens (copied exactly, checked by a test), the same fonts, and the same dark mode. White cards on a near-white page. Outlined buttons. Inline SVG line icons.
- **Tests:** in `tools/erd-playground/test/`, using `node:test` with no packages beyond what's vendored. Include `test/index.js` so `node --test tools/erd-playground/test/` works on Node 22, as SQL Studio does.
- **Screens:** laptop width is the main target. Tablet must work (touch, pinch-to-zoom on the diagram). Phone must be usable, with the panels stacked.
- **Accessibility:** keyboard-only use with visible focus, proper labels, a polite live region, WCAG AA contrast in both themes, and `prefers-reduced-motion` honored.
- **Course integration:** a "Chapter 6" card in `tools/index.html`, an Activity 6.0 gray box in `chapter-06.md` (written like Activity 7.0 and 8.0), and publishing to `gh-pages`, each done only after David says yes.

## 4. What students see (David chose layout A)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [icon] ERD Playground                      Example: [Artist records Song ▾]│
│        3 entities · 3 relationships        Reset example                   │
├──────────────────────────────────┬┬───────────────────────────────────────┤
│ [v] Notation   [-] 100% [+] [Copy]││ [v] Diagram  [-] 100% [+] [Tidy] [PNG] │
│ 1 │ erDiagram                    ││                                        │
│ 2 │   ARTIST ||--o{ SONG : "rec… ││    ┌──────┐ records ┌──────┐           │
│ 3 │   SONG ||--o{ STREAM : "gen… ││    │ARTIST├┼┼──────○<┤ SONG │ ...       │
│ 4 │   USER ||--o{ STREAM : "cre… ││    └──────┘         └──────┘           │
│   │                              ││                                        │
│ ▸ Symbol cheat sheet             ││  Hover or click a line to read it.     │
│ ✓ Diagram is up to date          ││                                        │
└──────────────────────────────────┴┴───────────────────────────────────────┘
```

- **Header:** the title, a live count ("3 entities · 3 relationships"), an **Example** picker, and **Reset example** (restores the picked example's original text).
- **Notation panel (left):**
  - a CodeMirror editor with line numbers, highlighting for the notation, and the current line highlighted;
  - **Copy**;
  - a folding **Symbol cheat sheet** that shows the four line ends and the five common patterns from 6.1, each with a tiny drawing of the end;
  - a status line: "Diagram is up to date", or the error (§6).
- **Diagram panel (right):** the drawn diagram, with zoom controls, **Tidy**, and **PNG**. Entities can be dragged. Pinch zooms on touch.
- A draggable splitter sits between the panels, and each panel can be collapsed. Layout choices are saved in `localStorage` (try/catch) as in SQL Studio. On narrow screens, Notation stacks above Diagram.

## 5. The notation it accepts

Chapter 6's notation, which is a subset of Mermaid's `erDiagram` syntax. Anything accepted here should also render in Mermaid.

- An optional first line, `erDiagram`. (Chapter 6 shows the notation both with and without it.)
- A relationship line: `ENTITY1 <left end><line><right end> ENTITY2 [: label]`.
  - Left ends: `||` `|o` `}|` `}o`. Right ends: `||` `o|` `|{` `o{`. These are the four meanings, mirrored on the left side, as in Mermaid.
  - The line is `--` (solid). `..` (dashed, which Mermaid uses for non-identifying relationships) is also accepted and drawn dashed, so Mermaid text that uses it still works. *(My call. Chapter 6 doesn't use `..`.)*
  - The label is optional here, because 6.1 prints `ARTIST ||--o{ SONG` without one. Mermaid itself requires a label, though. So a line with no label is drawn normally, and the status line adds a gentle note: "This works here. To use it in Mermaid or an AI tool, add a label, like `: \"records\"`." A label may be quoted (`"records"`) or a single word (`records`). *(My call: it matches both the book and Mermaid without treating 6.1's example as an error.)*
- An entity with no relationship can be declared on its own line (`ARTIST`), or by an attribute block.
- **Attribute blocks** (Chapters 8 and 9 use these):
  ```
  ARTIST {
      int artist_id PK
      string artist_name
  }
  ```
  Each line is `type name` with optional `PK`, `FK`, `UK` (comma-separated, as Mermaid allows) and an optional quoted comment. When a block is present, the entity box lists its attributes, marked with key badges as in SQL Studio's ERD.
- Entity names: letters, digits, `_`, `-`. Names are case-sensitive, as in Mermaid.
- `%%` starts a comment line, as in Mermaid.
- **Mermaid that goes beyond Chapter 6** (students will paste AI-written Mermaid) *(my call)*:
  - **Accepted and drawn:**
    - Mermaid's word cardinalities: `one or zero`, `zero or one`, `one or more`, `one or many`, `many(1)`, `1+`, `zero or more`, `zero or many`, `many(0)`, `0+`, `only one`, `1`;
    - entity aliases (`p["Person"]`, drawn with the alias text);
    - quoted entity names with spaces;
    - attribute types with brackets or parentheses (`varchar(255)`, `string[]`).
  - **Accepted and ignored**, since they don't change the picture: `direction`, `style`, `classDef`, and `class` lines.
  - **A friendly error for a left-side end written the right-side way** (`o{` on the left): "On the left side the symbols are mirrored: write `}o` instead of `o{`." Mermaid rejects this too, so the error teaches the mirroring.
- **Copy** copies exactly what's in the editor. It doesn't add `erDiagram`. When that first line is missing, the status line says: "Add `erDiagram` as the first line to use this in Mermaid." *(My call.)*

## 6. Behavior

- **Live redraw:** the diagram redraws about 300 ms after typing stops. Entities keep their positions across redraws, and new entities are placed by the tidy layout.
- **Errors never blank the diagram.** When a line can't be read:
  - the last good diagram stays on screen, slightly faded;
  - the status line names the line, in plain words, with a suggestion when one is likely. For example: "Line 3: `||--o` is missing its last symbol. Line ends are `||`, `o|`, `|{`, or `o{`." or "Line 4: Put a `:` before the label." or "Line 6: This attribute block is missing its closing `}`.";
  - the spot is underlined in the editor, as in SQL Studio.
- **Text and picture stay connected** (the main teaching aid):
  - Putting the cursor on a relationship line highlights that line in the diagram. Clicking a diagram line moves the cursor to its line in the notation.
  - Hovering over or focusing a diagram line, or putting the cursor on a notation line, shows **both readings** in a small box, using 6.1's rule ("say the first entity, then the cardinality closest to the second entity, then the second entity"):
    "An ARTIST is associated with **zero or more** SONGs." / "A SONG is associated with **one and only one** ARTIST."
    The cardinality words come straight from 6.1's table: one and only one, zero or one, one or more, zero or more. The label is shown alongside ("records") but not built into the sentence, since 6.1 points out that labels only read well in one direction. *(My call. It's the most direct answer to "how does this notation become that picture?")*
  - Hovering over one line end highlights the matching symbol in the notation (for example the `o{` characters), and the reverse. *(My call.)*
- **Drawing:**
  - crow's foot ends exactly as in Chapter 6 and SQL Studio: a bar for "one", a circle for "zero", and the three-pronged foot for "many", with each end showing its minimum and maximum;
  - labels sit at the middle of the line;
  - an entity with a relationship to itself (`EMPLOYEE ||--o{ EMPLOYEE : "manages"`) is drawn as a loop;
  - two relationships between the same pair of entities are drawn as separate lines.
- **Tidy** lays the diagram out automatically (reusing SQL Studio's layered layout). **PNG** copies the picture, or downloads it when the clipboard doesn't allow images, as in SQL Studio.

## 7. Examples

All are editable. Picking another example while you have unsaved edits asks first ("Replace your changes with this example?"). Each example has a one-line description shown under the picker. *(The exact list is my call; David asked for "lots of examples".)*

1. **Artist records Song**: the first example in 6.1 (opens by default).
2. **The five patterns**: 6.1's one-to-one, optional one-to-one, one-to-many (zero or more), one-to-many (one or more), and many-to-many block.
3. **Music streaming**: Artist, Song, User, Stream with attributes (the Chapters 8–9 database, matching SQL Studio's data set 0).
4. **Campus concert series**: the 6.2 worked example (Venue, Event, Artist, Ticket, Student, Sponsor, with junction tables).
5. **Many-to-many, before and after**: `STUDENT }o--o{ CLASS` next to the junction-table version (`ENROLLMENT`).
6. **Thundering Herd basketball**: Players, Games, BoxScores.
7. **Campus dining**: Students, Dining halls, Meal swipes.
8. **Netflix binge**: Series, Episodes, Viewing sessions.
9. **Fantasy football league**: one-to-one and optional ends. The Query Explorer data set has no one-to-one relationship, so this example adds plausible ones (for example, each fantasy team has zero or one trophy).
10. **A relationship to itself**: a student mentors other students (`STUDENT |o--o{ STUDENT`). Each student has zero or one mentor, so the "one" side is optional. *(Changed from Employee manages Employee after review: `||` claimed that every employee, including the top boss, has exactly one manager.)*

Examples 6–9 echo the Query Explorer data sets students already know.

## 8. How it gets built (decided by the sibling tools)

- Structure like SQL Studio: pure logic files tested in Node, DOM files, `build.js` inlining everything into one HTML file, and a vendored, pinned CodeMirror 5 (copied from SQL Studio's `vendor/`, so the same versions and hashes).
- **Reuse SQL Studio's diagram code.** It's the bulk of the drawing work (crow's foot ends, routes, drag, tidy, zoom/pinch, PNG). It needs to learn the four end types (SQL Studio only draws "exactly one" and "zero or more"), labels, dashed lines, and self-loops. The builder decides whether to share the file between the tools or copy it. Either way, SQL Studio must keep passing its tests and browser checks.
- New logic: the notation parser (with line/column errors and suggestions), the two-direction readings, and the example list.

## 9. Testing

- **Parser:**
  - every example parses;
  - every Chapter 6, 8, 9, and 10 `erDiagram` block in the book parses (the test reads them from the chapter files);
  - each end symbol is understood on both sides;
  - labels are optional, quoted or single-word;
  - attribute blocks and key markers parse;
  - comments are skipped;
  - errors give the right line, column, and message.
- **Readings:** the exact two sentences for each of the 16 end combinations, and the case where the label is ignored.
- **Drawing model:** each end type produces the right marks; self-loops and repeated pairs are handled; tidy layout gives no overlaps.
- **Mermaid check** *(my call)*: a one-time check, in the same scratch Playwright run and not a repo dependency. It renders every example (with labels and the `erDiagram` line) in a pinned current Mermaid release, confirming they're valid Mermaid. The playground itself never loads Mermaid.
- **Browser check** (Playwright Chromium, like SQL Studio's):
  - laptop, tablet, and phone widths, in light and dark mode;
  - typing changes the diagram;
  - a typo keeps the last diagram and shows the message;
  - cursor-to-line highlighting works in both directions;
  - examples load;
  - PNG copies or downloads;
  - a keyboard-only pass, plus contrast and console-error checks.

## 10. Left to the builder

- Highlighting colors for the notation, and the exact styling of the reading box (within the shared tokens and AA contrast).
- How positions are remembered while editing (for example, by entity name).
- Whether the cheat sheet's tiny drawings reuse the diagram code or are static SVG.
- The wording of individual error messages, within the 10th-grade, plain-words rule.
