# Query Operations Explorer: Design Spec

**Date:** 2026-10-13
**Status:** Draft for review
**Textbook link:** Chapter 7, *Query Thinking*, section 7.2 "The Core Operations of Relational Thinking"

## 1. Purpose

A standalone web tool where students in the Introduction to Databases course build a query out of the four core operations (**filter, project, join, aggregate**) and *see* what each operation does to a table. Students never see or write SQL.

**Success looks like:** after using the tool, a student can explain in their own words that filtering removes rows, projecting removes columns, joining combines tables on a shared key, and aggregating collapses many rows into fewer summary rows — and can plan a sequence of these operations to answer a business question.

**Audience:** undergraduate business students, 18–25. All on-screen text is written at a 10th-grade reading level. Examples come from music, sports, streaming, college life, and memes, matching the textbook.

**Use:** open exploration and practice. Not graded.

## 2. Delivery

- One standalone HTML file, opened from a link in the textbook. It is **not** embedded in Pressbooks (not enough horizontal room).
- The delivered file has no outside dependencies except the Google Fonts already used by the other course tools; it falls back to system fonts if they don't load. It works when opened from a local disk.
- The look matches the existing course tools in `Claude outputs/` (e.g., `table-splitter.html`): same fonts (Montserrat, Nunito Sans) and color palette, with a dark mode.
- Hosting is decided after the tool is built. Because it's a single file, any web host works.
- Primary target: a laptop-width browser (1024px and up). Phone widths must remain usable (stacked layout, tables scroll in their own box) but are secondary.

### Source layout

To keep the logic testable, the tool is developed as separate source files and combined into the single delivered file by a small Node script:

```
tools/query-explorer/
  src/engine.js      # the four operations; pure functions, no DOM
  src/datasets.js    # the 10 data sets and their "Try this" questions
  src/app.js         # screen layout, controls, animations
  src/styles.css
  src/index.html     # page shell
  build.js           # inlines the src files into dist/query-explorer.html
  test/              # Node tests (node:test), no extra packages
  dist/query-explorer.html   # the deliverable
```

## 3. Screen layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Query Explorer        Data set: [Spotify Streams ▾]                  │
│                       Artists · Songs · Streams                      │
│                       ▸ Try this (3 questions)   [Reduce motion ☐]   │
├───────────────────────┬──────────────────────────────────────────────┤
│ RECIPE                │  Tables in this data set: [Artists][Songs]…  │
│                       │                                              │
│ 0  Start with Streams │  25 rows × 4 columns  →  9 rows × 4 columns  │
│ 1  Keep only rows     │  ┌────────────────────────────────────────┐  │
│    where stream_date  │  │  result table                          │  │
│    is in March 2026   │  │                                        │  │
│ 2  Combine with Songs │  │                                        │  │
│    matching song_id   │  └────────────────────────────────────────┘  │
│                       │                                              │
│ [Filter] [Project]    │                                              │
│ [Join]   [Aggregate]  │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

### Header
- **Data set dropdown** listing the 10 data sets by name. Below it, one line naming the data set's tables. Changing the data set clears the recipe (after a confirmation if the recipe has steps beyond the start step).
- **"Try this" panel**, collapsed by default. Shows three business questions for the current data set. Each question has its own **Show hint** button. The hint is hidden until the student clicks it, and clicking again hides it. The hint is the plan written as step sentences (see §5), e.g., "Start with Streams → Keep only rows where stream_date is in March 2026 → Combine with Songs matching song_id → …". The tool never builds the hint's steps for the student.
- **Reduce motion** switch. Defaults to on when the browser reports `prefers-reduced-motion`.
- A small note: "Real names, made-up numbers. All data is invented for practice."

### Recipe panel (left)
- **Step 0, "Start with [table ▾]"**, is always present and can't be deleted. It defaults to the data set's designated starting table (§7).
- Four operation buttons: **Filter, Project, Join, Aggregate**. Clicking one adds a new step at the end and opens its editor.
- Each step card shows:
  - its number and operation name, with an icon (funnel, columns, link, stack)
  - a plain-English sentence describing it (§5)
  - controls: **Edit**, **Turn off / Turn on**, **Delete**
- Clicking a step card selects it. The result panel then shows the table *as of that step*. The newest step is selected by default.
- Step editor: opens inline in the card. Its **Apply** button stays disabled until every required control is filled in. **Cancel** discards changes (and removes the step if it was never applied).

### Result panel (right)
- **Tables strip:** tabs for viewing each of the data set's original tables, read-only, so students can look at the raw data while planning. Viewing a raw table doesn't change the recipe. A "Back to result" tab returns to the recipe result.
- **Size counter:** "*before* rows × columns → *after* rows × columns" for the selected step, comparing it with the step before it. For step 0 it shows only the table's size.
- **Result table:** column headers show the column name plus a key badge (🔑 primary key, 🔗 foreign key) where applicable. Numbers are right-aligned with thousands separators; dates are shown as "Mar 14, 2026". The table scrolls inside its own box when wide or long; the header row stays visible.
- **Replay** button: replays the selected step's animation.

## 4. Operations

All operations take the current table and return a new table. Steps run in order from step 0. Any operation can follow any other, and an operation may be used more than once (for example, filtering after aggregating).

### Column types
Every column has one of three types: **text**, **number**, or **date**. Yes/no values (like "headliner") are text columns with the values "Yes" and "No".

### Filter: "Keep only rows where…"
Controls: column → condition → value(s). The conditions offered depend on the column's type:

| Type | Conditions |
|---|---|
| text | is, is not, is one of, contains |
| number | is, is not, is more than, is less than, is at least, is at most, is between |
| date | is on, is before, is after, is between |

- The value control matches the column: for text, a dropdown of the values in the current table (multi-select checkboxes for "is one of"; free text box for "contains"); a number box for numbers; a date picker for dates. "Between" takes two values and includes both ends.
- Text comparisons ignore upper/lower case.
- One condition per filter step. Students combine conditions by adding more filter steps.

### Project: "Keep only these columns…"
Controls: a checkbox for every column in the current table, all checked to start. At least one column must stay checked (Apply is disabled otherwise). Column order in the result follows the current table's order.

### Join: "Combine with [table] matching…"
Controls:
1. **Table to combine with:** any table in the data set not already in the current result.
2. **Match on:** "[column in current table ▾] equals [column in other table ▾]", or a checkbox "**Don't match on anything**".
   - The tool pre-selects the correct key pair (the foreign key → primary key relationship between the two tables, in either direction) and marks it "suggested".
   - Students can change either side to any column of the same type, to see what a wrong key does.
   - If no key relationship exists between the current result and the chosen table, nothing is pre-selected and the editor says "These tables don't share a key."
- The join is an **inner join** only: rows with no match on the other side are dropped. (Outer joins are left for Chapter 9.)
- **Result columns:** all columns from the current table, then all columns from the other table. If the two match columns have the same name, the match column appears once. Any other name clash is shown as `Table.column`.
- **Don't match on anything** produces every combination of rows (a Cartesian product), and the size counter is followed by a warning: "Every row was paired with every other row. Most of these rows are meaningless."
- Row order: the current table's order, then the other table's order within each match.

### Aggregate: "Group by… and calculate…"
Controls:
- **Group by:** zero or more columns (checkboxes). Zero means the whole table becomes one row.
- **Calculate:** one to three summaries, each "[function ▾] of [column ▾]":

| Function | Allowed columns | Result column name |
|---|---|---|
| count of rows | (no column needed) | `number_of_rows` |
| total | number | `total_<column>` |
| average | number | `average_<column>` (rounded to 2 decimal places) |
| lowest | number or date | `lowest_<column>` |
| highest | number or date | `highest_<column>` |

- Result: one row per distinct combination of group-by values, showing the group-by columns followed by the summary columns. Groups appear in order of first appearance in the current table.
- If a summary name would duplicate an existing column name, a number is added (`total_streams_2`).
- Summary columns are ordinary number/date columns, so later steps can filter or project on them.

## 5. Step sentences

Every step card, and every hint, describes its step in a plain sentence built from its settings. Column names appear exactly as in the table (in a code-style font), matching the textbook's `artist_id` style.

| Operation | Sentence pattern | Example |
|---|---|---|
| Start | Start with **T** | Start with **Streams** |
| Filter | Keep only rows where `col` *condition* **value** | Keep only rows where `genre` is **Hip-Hop** |
| Project | Keep only the columns `a`, `b`, `c` | Keep only the columns `artist_name`, `total_streams` |
| Join | Combine with **T**, matching `x` to `y` (or "matching `x`" when names are the same) | Combine with **Songs**, matching `song_id` |
| Join (no condition) | Combine every row with every row of **T** | — |
| Aggregate | Group by `a` and calculate *summaries* (or "For the whole table, calculate…") | Group by `artist_name` and calculate the total of `stream_count` |

Turned-off steps appear faded with "(turned off)" and are skipped.

## 6. Visual feedback

When a step is applied (new or edited), or Replay is clicked, the change is animated over about one second, then the table settles into its new state. Selecting a step by clicking it shows its result immediately, without animation. With Reduce motion on, every change is instant, but the color highlights still appear for two seconds before fading.

| Operation | Animation |
|---|---|
| Filter | Rows that fail turn red, are struck through, then collapse out. Rows that pass flash green. |
| Project | Dropped columns turn gray, then slide away; the remaining columns close the gap. |
| Join | Both tables appear side by side. Rows whose key values match get the same color band. Matching rows slide together into one wider row. Rows with no match are outlined, labeled "no match — dropped," then fade out. |
| Aggregate | Rows are tinted by group and slide together so each group is adjacent, then each group folds into its single summary row. |

After an aggregate step, a **Show what was collapsed** toggle lets the student expand any summary row to see the rows that went into it (shown faded beneath it).

**Accessibility:** color is never the only signal. Dropped rows also get strikethrough and a ✕ icon; matched join rows also get a shared number tag; groups also get a group label. All controls work by keyboard and have visible focus outlines. Text meets WCAG AA contrast in light and dark mode.

## 7. Data sets

### Rules for every data set
- 2–3 tables, each with 8–25 rows, so every table fits on screen with little scrolling.
- Each table has a single-column primary key ending in `_id`. A foreign key has **the same name** as the primary key it points to, so the suggested join keeps the key column once.
- Every foreign key value matches an existing row (the data has referential integrity).
- At least one row in each data set has **no match** in a related table, for an ordinary reason (e.g., a newly signed artist with no songs yet). This makes the "no match — dropped" behavior visible.
- Apart from key columns, no column name appears in two tables of the same data set (e.g., `artist_name` and `song_title`, not two `name` columns).
- Each data set includes at least one text category column, one number column, and one date column, spread across its tables.
- Activity dates (streams, ticket sales, games, swipes, and so on) fall in 2026. Release dates for real songs, series, and movies use their real dates, and Box Office Weekend uses weekends from its movies' real 2025 release windows. All dates fall between 2015 and 2026.
- Names: real artists, series, movies, NFL players, NFL teams, and colleges where they fit. Invented names for private people (students, viewers, managers, gamers, small creators) and for anything where a real name would be odd. All numbers are invented.
- One table is designated the **starting table** (step 0's default), normally the table with the most rows.

### The 10 data sets

In the column lists, **PK** = primary key and **FK** = foreign key. Types: (t) text, (n) number, (d) date.

#### 1. Spotify Streams
- **Artists:** `artist_id` PK, `artist_name` (t), `genre` (t), `home_country` (t)
- **Songs:** `song_id` PK, `song_title` (t), `artist_id` FK, `release_date` (d), `duration_sec` (n)
- **Streams** *(start)*: `stream_id` PK, `song_id` FK, `stream_date` (d), `stream_count` (n)
- No match: a newly signed artist with no songs yet; one song with no streams yet.
- Try this:
  1. Which artist had the most total streams in March 2026? *Hint:* Start with Streams → keep rows where `stream_date` is between Mar 1 and Mar 31, 2026 → combine with Songs matching `song_id` → combine with Artists matching `artist_id` → group by `artist_name` and calculate the total of `stream_count`.
  2. What are the titles and release dates of all Latin songs? *Hint:* Start with Songs → combine with Artists matching `artist_id` → keep rows where `genre` is Latin → keep only the columns `song_title`, `release_date`.
  3. How many songs does each artist have? *Hint:* Start with Artists → combine with Songs matching `artist_id` → group by `artist_name` and calculate the count of rows. (Is anyone missing? Why?)

#### 2. Concert Tour
- **Venues:** `venue_id` PK, `venue_name` (t), `city` (t), `state` (t), `capacity` (n)
- **Shows:** `show_id` PK, `venue_id` FK, `artist_name` (t), `show_date` (d)
- **TicketSales** *(start)*: `sale_id` PK, `show_id` FK, `ticket_type` (t: GA, Floor, VIP), `quantity` (n), `price_each` (n)
- No match: a venue with no shows booked yet.
- Try this:
  1. How many tickets were sold in each city? *Hint:* Start with TicketSales → combine with Shows matching `show_id` → combine with Venues matching `venue_id` → group by `city` and calculate the total of `quantity`.
  2. Which shows sold VIP tickets priced above $300? *Hint:* Start with TicketSales → keep rows where `ticket_type` is VIP → keep rows where `price_each` is more than 300 → combine with Shows matching `show_id` → keep only the columns `artist_name`, `show_date`, `price_each`.
  3. What is the average ticket price for each ticket type? *Hint:* Start with TicketSales → group by `ticket_type` and calculate the average of `price_each`.

#### 3. Netflix Binge
- **Series:** `series_id` PK, `series_title` (t), `genre` (t), `release_year` (n)
- **Episodes:** `episode_id` PK, `series_id` FK, `season` (n), `episode_number` (n), `runtime_min` (n)
- **ViewingSessions** *(start)*: `session_id` PK, `episode_id` FK, `viewer_name` (t, invented), `watch_date` (d), `minutes_watched` (n)
- No match: an episode nobody has watched yet.
- Try this:
  1. How many total minutes were watched for each series? *Hint:* Start with ViewingSessions → combine with Episodes matching `episode_id` → combine with Series matching `series_id` → group by `series_title` and calculate the total of `minutes_watched`.
  2. What did Jordan watch in February 2026? *Hint:* Start with ViewingSessions → keep rows where `viewer_name` is Jordan → keep rows where `watch_date` is between Feb 1 and Feb 28, 2026 → combine with Episodes matching `episode_id` → combine with Series matching `series_id` → keep only the columns `series_title`, `season`, `episode_number`, `watch_date`.
  3. What is the average episode runtime for each genre? *Hint:* Start with Episodes → combine with Series matching `series_id` → group by `genre` and calculate the average of `runtime_min`.

#### 4. Thundering Herd Basketball
- **Players:** `player_id` PK, `player_name` (t, invented), `position` (t: Guard, Forward, Center), `class_year` (t), `jersey_number` (n)
- **Games:** `game_id` PK, `opponent` (t, real colleges), `game_date` (d), `home_away` (t: Home, Away), `result` (t: W, L)
- **BoxScores** *(start)*: `box_id` PK, `game_id` FK, `player_id` FK, `points` (n), `rebounds` (n), `assists` (n)
- No match: a redshirt freshman who hasn't played in a game yet.
- Try this:
  1. Who scored the most total points this season? *Hint:* Start with BoxScores → combine with Players matching `player_id` → group by `player_name` and calculate the total of `points`.
  2. What is the average number of points for each position in home games? *Hint:* Start with BoxScores → combine with Games matching `game_id` → keep rows where `home_away` is Home → combine with Players matching `player_id` → group by `position` and calculate the average of `points`.
  3. In the games the Herd won, which players scored 20 or more points? *Hint:* Start with BoxScores → keep rows where `points` is at least 20 → combine with Games matching `game_id` → keep rows where `result` is W → combine with Players matching `player_id` → keep only the columns `player_name`, `opponent`, `points`.

#### 5. Campus Dining
- **Students:** `student_id` PK, `first_name` (t, invented), `meal_plan` (t: Unlimited, 14 per week, Block 100), `residence_hall` (t)
- **DiningHalls:** `hall_id` PK, `hall_name` (t, invented), `campus_area` (t), `seats` (n)
- **MealSwipes** *(start)*: `swipe_id` PK, `student_id` FK, `hall_id` FK, `swipe_date` (d), `meal_period` (t: Breakfast, Lunch, Dinner, Late Night)
- No match: a commuter student with no swipes.
- Try this:
  1. Which dining hall gets the most swipes at dinner? *Hint:* Start with MealSwipes → keep rows where `meal_period` is Dinner → combine with DiningHalls matching `hall_id` → group by `hall_name` and calculate the count of rows.
  2. How many swipes came from each meal plan? *Hint:* Start with MealSwipes → combine with Students matching `student_id` → group by `meal_plan` and calculate the count of rows.
  3. Who ate late-night meals, and where? *Hint:* Start with MealSwipes → keep rows where `meal_period` is Late Night → combine with Students matching `student_id` → combine with DiningHalls matching `hall_id` → keep only the columns `first_name`, `hall_name`, `swipe_date`.

#### 6. Fantasy Football League
- **FantasyTeams:** `team_id` PK, `team_name` (t, invented, meme-style), `manager_name` (t, invented)
- **NFLPlayers:** `player_id` PK, `player_name` (t, real), `position` (t: QB, RB, WR, TE), `nfl_team` (t, real), `team_id` FK
- **WeeklyPoints** *(start)*: `points_id` PK, `player_id` FK, `week` (n, 1–4), `game_date` (d), `fantasy_points` (n)
- No match: an injured player with no points recorded.
- Try this:
  1. Which fantasy team scored the most total points? *Hint:* Start with WeeklyPoints → combine with NFLPlayers matching `player_id` → combine with FantasyTeams matching `team_id` → group by `team_name` and calculate the total of `fantasy_points`.
  2. Which players had a week with 25 or more points? *Hint:* Start with WeeklyPoints → keep rows where `fantasy_points` is at least 25 → combine with NFLPlayers matching `player_id` → keep only the columns `player_name`, `week`, `fantasy_points`.
  3. What is the average weekly score for each position? *Hint:* Start with WeeklyPoints → combine with NFLPlayers matching `player_id` → group by `position` and calculate the average of `fantasy_points`.

#### 7. Box Office Weekend
- **Studios:** `studio_id` PK, `studio_name` (t, real), `headquarters` (t)
- **Movies:** `movie_id` PK, `movie_title` (t, real), `studio_id` FK, `genre` (t), `rating` (t: PG, PG-13, R), `release_date` (d)
- **WeekendGrosses** *(start)*: `gross_id` PK, `movie_id` FK, `weekend_date` (d), `gross_millions` (n), `theaters` (n)
- No match: a studio with no movies in this table.
- Try this:
  1. How much did each studio earn in total? *Hint:* Start with WeekendGrosses → combine with Movies matching `movie_id` → combine with Studios matching `studio_id` → group by `studio_name` and calculate the total of `gross_millions`.
  2. Which PG-13 movies had a weekend over $50 million? *Hint:* Start with WeekendGrosses → keep rows where `gross_millions` is more than 50 → combine with Movies matching `movie_id` → keep rows where `rating` is PG-13 → keep only the columns `movie_title`, `weekend_date`, `gross_millions`.
  3. What was each movie's best weekend? *Hint:* Start with WeekendGrosses → combine with Movies matching `movie_id` → group by `movie_title` and calculate the highest of `gross_millions`.

#### 8. Esports Tournament
- **Teams:** `team_id` PK, `team_name` (t, invented), `region` (t)
- **Gamers:** `gamer_id` PK, `gamertag` (t, invented), `team_id` FK, `role` (t: Duelist, Controller, Sentinel, Initiator)
- **MatchStats** *(start)*: `stat_id` PK, `gamer_id` FK, `match_date` (d), `map_name` (t), `kills` (n), `deaths` (n), `assists` (n)
- No match: a substitute gamer with no match stats.
- Try this:
  1. Which team got the most total kills? *Hint:* Start with MatchStats → combine with Gamers matching `gamer_id` → combine with Teams matching `team_id` → group by `team_name` and calculate the total of `kills`.
  2. Which gamers had 20 or more kills in a match? *Hint:* Start with MatchStats → keep rows where `kills` is at least 20 → combine with Gamers matching `gamer_id` → keep only the columns `gamertag`, `map_name`, `kills`.
  3. What is the average number of assists for each role? *Hint:* Start with MatchStats → combine with Gamers matching `gamer_id` → group by `role` and calculate the average of `assists`.

#### 9. TikTok Creators & Memes
- **Creators:** `creator_id` PK, `handle` (t, invented), `niche` (t: Comedy, Dance, Food, Gaming), `follower_count` (n)
- **Videos:** `video_id` PK, `creator_id` FK, `caption` (t), `meme_format` (t), `post_date` (d)
- **DailyViews** *(start)*: `view_id` PK, `video_id` FK, `view_date` (d), `views` (n), `likes` (n)
- No match: a brand-new creator who hasn't posted yet.
- Try this:
  1. Which meme format gets the most views? *Hint:* Start with DailyViews → combine with Videos matching `video_id` → group by `meme_format` and calculate the total of `views`.
  2. How many total likes did each creator get? *Hint:* Start with DailyViews → combine with Videos matching `video_id` → combine with Creators matching `creator_id` → group by `handle` and calculate the total of `likes`.
  3. What did comedy creators post in the first half of April 2026? *Hint:* Start with Videos → keep rows where `post_date` is between Apr 1 and Apr 15, 2026 → combine with Creators matching `creator_id` → keep rows where `niche` is Comedy → keep only the columns `handle`, `caption`, `post_date`.

#### 10. Music Festival Lineup
- **Stages:** `stage_id` PK, `stage_name` (t), `stage_capacity` (n)
- **Acts:** `act_id` PK, `act_name` (t, real), `genre` (t), `headliner` (t: Yes, No)
- **SetTimes** *(start)*: `set_id` PK, `act_id` FK, `stage_id` FK, `festival_date` (d: Fri Apr 10 – Sun Apr 12, 2026), `set_length_min` (n)
- No match: an act that's been announced but not yet scheduled.
- Try this:
  1. How many minutes of music does each stage host? *Hint:* Start with SetTimes → combine with Stages matching `stage_id` → group by `stage_name` and calculate the total of `set_length_min`.
  2. Which acts play the Main Stage on Saturday? *Hint:* Start with SetTimes → keep rows where `festival_date` is on Apr 11, 2026 → combine with Stages matching `stage_id` → keep rows where `stage_name` is Main Stage → combine with Acts matching `act_id` → keep only the columns `act_name`, `set_length_min`.
  3. How many headliners play each day? *Hint:* Start with SetTimes → combine with Acts matching `act_id` → keep rows where `headliner` is Yes → group by `festival_date` and calculate the count of rows.

### Data format
Each data set is one entry in `datasets.js` with: an id, display name, one-line description, starting table, the tables (name, columns with name/type/key info, rows), and its three questions. Each question's hint is stored as **structured steps** (the same format the recipe uses), and the hint sentence is generated from them. This guarantees the hint matches what the tool actually does, and lets the tests run every hint. Adding an 11th data set means adding one entry; no other code changes.

## 8. Handling problems

- **Editing an earlier step breaks a later one** (e.g., a project step drops a column a later filter uses): the later step gets a warning badge, "This step uses `genre`, which isn't in the table anymore," and is skipped. Following steps still run if they can. The student fixes it by editing or deleting the step.
- **A step's result has zero rows:** the table area shows "No rows left. Step N removed them all. Try changing it." Later steps still run on the empty table.
- **Incomplete step settings:** Apply stays disabled, with a short note saying what's missing ("Pick a value").
- **Cartesian product:** allowed, with the warning described in §4. With the data set size limits it tops out around 625 rows, which the table can show with scrolling.
- **Changing the start table:** re-runs the whole recipe, and any steps that no longer make sense get warning badges as above.
- **Nothing is saved.** Reloading the page starts fresh.

## 9. Testing

- **Engine tests** (Node's built-in `node:test`): for each operation, small hand-built tables with expected results checked by hand. These cover every filter condition per type, case-insensitive text matching, project order, inner-join dropping, same-name key columns appearing once, name clash prefixes, the Cartesian product, aggregate with zero/one/two group-by columns, each summary function, average rounding, summary name collisions, and the zero-row result.
- **Data set checks:** an automated test confirms every data set follows the rules in §7 (row counts, unique primary keys, all foreign keys valid, at least one no-match row, unique non-key column names, required column types present), and that **every hint's steps run without errors and give a non-empty result**.
- **Browser check:** a manual walkthrough in the browser at laptop and phone widths, in light and dark mode, with Reduce motion on and off. It confirms each animation plays correctly and that everything works by keyboard alone.

## 10. Out of scope

Saving or sharing recipes, grading or answer checking, outer joins, sorting, filters with AND/OR in one step, student-uploaded data, showing SQL, and embedding in Pressbooks.
