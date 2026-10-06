# Chapter 7: Query Thinking: What Do You Want to Know?

By the end of this chapter, you will be able to:

- **Restate** a plain-English business question as a precise one, catching ambiguities (such as counting streams versus counting distinct users) before any code is written.
- **Describe** the four core operations of relational querying - filtering, projecting, joining, and aggregating - and **identify** which operation answers each part of a business question.
- **Explain** how the output of one operation becomes the input to the next, and **plan** a query as a pipeline of set transformations.
- **Plan** a query without writing SQL by sketching the result you want, working backward to the tables that supply each column, and tracing the join path through foreign keys.

---

You've spent six chapters learning how to build a database. Now we shift to the other side of the table: how to *ask* one.

This is the chapter where the payoff begins. All of that work - identifying entities, modeling relationships, normalizing tables, enforcing integrity - exists so that you can answer questions. Real questions. Business questions. "Which artists have the most streams this month?" "Which students haven't bought a ticket yet?" "What's the total revenue from sponsored events?"

But here's the trap most beginners fall into: they jump straight to the syntax. They open a query editor and start typing before they've thought clearly about what they're asking. The result is queries that technically run but answer the wrong question, or that produce numbers that look right but aren't.

This chapter is about thinking before typing. It introduces the four fundamental operations of relational querying - not as SQL commands, but as ideas. SQL comes in the next chapter. Here, we build the mental model that makes SQL make sense.

---

## 7.1 Starting with the Business Question

### Why "what SQL do I write?" is the wrong first question

When someone needs data, the instinct is to immediately think about the query. "I need to write a SELECT statement. I need to join these tables. I need a WHERE clause." This impulse gets things backward.

The right first question is not "what SQL do I write?" It's "what do I actually want to know?"

These sound like the same question. They're not. "What SQL do I write?" is a technical question about a tool. "What do I actually want to know?" is a conceptual question about the real world. The second question has to come first, because the SQL is just a translation of the answer.

Think about it this way. If someone asks you for directions to a restaurant and you immediately start talking about whether to take the highway or the back roads, you've skipped the step of understanding where the restaurant actually is. You need the destination before you can plan the route. Querying is the same: you need a clear picture of the answer before you can design the path to it.

### Syntax is the last step, not the first

Here's the sequence that produces good queries:

1. **Understand the business question.** What decision is someone trying to make? What information do they need to make it?
2. **Identify the data you need.** Which entities are involved? Which attributes matter? Over what time period or scope?
3. **Plan the operations.** What do you need to filter, join, or aggregate to get from the raw data to the answer?
4. **Write the syntax.** Only now do you translate the plan into SQL (or ask an AI to do it).

Most errors in data work happen in steps 1 and 2, not step 4. The SQL runs fine - it just answers a slightly different question than the one being asked. And because the output looks plausible, nobody catches it.

### The cost of writing a query before understanding the question

Here's a real-world type of mistake. A marketing manager asks: "How many users listened to hip-hop last month?"

A developer jumps to the query. They join the Stream table to the Song table to the Artist table, filter for genre = "Hip-Hop," count the results, and report back: 847,000 streams.

The manager looks confused. "That can't be right - we only have 200,000 users."

The problem: the developer counted *streams*, not *users*. A user who listened to ten hip-hop songs contributed ten rows to the count. The question was about users (distinct people), not streams (individual plays). The query answered a different question than the one asked.

This kind of mistake is invisible in the SQL. The query is technically correct - it does exactly what it was written to do. The error happened before a single character was typed, in the failure to precisely understand what "how many users" means.

The fix is simple: slow down and state the question precisely before writing anything. "Count the number of *distinct users* who *streamed at least one* song with genre = Hip-Hop *in the month of March 2026*." Now the query is unambiguous - and a good AI tool can translate that precise statement into correct SQL on the first try.

### Translating business questions into data operations

Let's practice. Here's a business question in plain English:

*"Which artists had more than 1 million streams last month, and what was their total revenue?"*

Before thinking about SQL, break this down:

- **What entities are involved?** Artists, Songs, Streams, Revenue (probably a calculated field or a separate table).
- **What time period?** Last month - so we need to filter streams to a date range.
- **What threshold?** More than 1 million streams - so we need to count streams per artist and filter on that count.
- **What do we want back?** Artist name and total revenue - so we need to aggregate revenue, not just count streams.

Now we have a plan: filter streams to last month, join to songs to get artist, group by artist to get per-artist totals, filter to those with more than 1 million streams, then pull in revenue. Each of those steps corresponds to one of four fundamental operations - which we'll cover in the next section.

---

## 7.2 The Core Operations of Relational Thinking

Every question you can ask of a relational database can be decomposed into some combination of four operations: **filtering**, **projecting**, **joining**, and **aggregating**. These are the vocabulary of query thinking.

You don't need to memorize them as a list. You need to develop an instinct for which operation each part of a question calls for. By the end of this section, you'll be able to read any business question and immediately see the operations inside it.

### Filtering: keeping only the rows you care about

**Filtering** means narrowing a table down to only the rows that meet a certain condition. You start with all the rows, and you keep only the ones that match.

In the business question above, "last month" is a filter. "More than 1 million streams" is a filter. "Genre = Hip-Hop" is a filter.

Filters are defined by conditions on attributes:

- **Equality:** `genre = "Hip-Hop"` - keep only rows where genre is exactly this value.
- **Range:** `stream_date >= '2026-03-01' AND stream_date <= '2026-03-31'` - keep only rows where the date falls in March.
- **Membership:** `artist_id IN (101, 204, 388)` - keep only rows for specific artists.
- **Pattern:** `artist_name LIKE 'The %'` - keep only artists whose name starts with "The."
- **Negation:** `genre != "Country"` - keep only rows where genre is not Country.

The result of a filter is a smaller version of the same table - fewer rows, but the same columns.

One subtlety worth noting now: **when you filter matters.** Filtering before a join reduces the amount of data that needs to be joined, which is faster. Filtering after a join gives you more flexibility about what conditions you can apply. We'll come back to this when we discuss SQL in Chapter 8 - but developing the intuition now will help you write better queries later.

### Conditions on attributes: equality, ranges, membership

Here's a useful way to think about filtering: every filter is a question you ask about each row. "Is this row's date in March?" "Is this row's stream count above 1 million?" "Is this row's genre Hip-Hop?" For every row in the table, the answer is either yes or no. The filter keeps the yes rows and discards the no rows.

This means filters are very precise - and that precision matters. "Last month" and "the past 30 days" are similar but not the same. "Genre = Hip-Hop" and "genre contains 'Hop'" are different conditions that will return different rows. When you're planning a query, be exact about what your filter condition actually means.

### Projecting: keeping only the columns you care about

**Projecting** means narrowing a table down to only the columns you care about. You start with all the columns, and you keep only the ones that are relevant to your question.

If you're asking "what are the names and stream counts of top artists?", you don't need artist hometown, artist manager, artist genre, or record label. You only need artist name and stream count. Projecting removes the irrelevant columns so your result is clean and focused.

Projection isn't just about convenience. It's about correctness and responsibility. In a table with 30 columns, returning all 30 when you only need 3 makes results harder to read and wastes bandwidth. More importantly, many columns in a real database contain sensitive information - user email addresses, payment details, personal data. Only projecting the columns you need is good data hygiene: you don't expose data you're not using.

### Why returning fewer columns is almost always better

A query result should contain exactly what was asked for - no more, no less. This sounds obvious, but in practice, the temptation is to return everything and let the reader sort through it. Resist this.

A result with 40 columns is harder to understand than a result with 5 columns, even if both contain the correct answer. The extra columns create noise. They make it easier to misread the data and harder to spot errors.

Good query thinking includes thinking about the output: what does the answer actually look like? What columns does it have? How many rows? If you can picture the result table clearly before writing the query, you're on the right track.

### Projection as a form of privacy and clarity

In business settings, projecting carefully is a professional responsibility. A query that returns user passwords (even hashed ones), credit card numbers, or health information alongside the data you actually needed is sloppy at best and a compliance problem at worst.

When planning a query, ask: "Do I actually need this column to answer the question?" If not, leave it out. This habit becomes especially important when you're working with AI-generated queries - one thing to check in any AI-written SQL is whether it's returning columns you didn't ask for and don't need.

### Joining: combining information across tables

**Joining** means combining rows from two tables based on a shared key. This is how you bring together information that's stored separately in a normalized database.

Remember why we normalize: each table stores one entity's information, and relationships live between tables. Joining is how you follow those relationships to answer questions that span multiple entities.

For example: to find the name of the artist who recorded each song, you join the Song table to the Artist table on the `artist_id` key. The join matches each song row with the artist row that has the same `artist_id`, and the result combines information from both tables into a single output row.

Visualize it this way. The Song table has columns: song_id, title, artist_id, duration. The Artist table has columns: artist_id, artist_name, genre. After joining on `artist_id`, the result has columns from both: song_id, title, artist_id, duration, artist_name, genre. The join stitched the two tables together at the seam where they share a key.

### Matching rows from two tables on a shared key

The shared key is everything. The join works by looking at the value in one table's foreign key column and finding the matching value in the other table's primary key column. Only rows where the keys match get combined.

Here's the critical question for every join: **are these the right two tables, and is this the right key to join on?**

Wrong table: joining Song to Artist when you needed Song to Album misses the point entirely - you'll get genre information when you needed release year.

Wrong key: joining on `artist_name` instead of `artist_id` will produce wrong results whenever two artists have similar names, or when names are spelled inconsistently.

The join key should almost always be a primary key matched to a foreign key. That's the relationship the data model was designed to express.

### What happens when the join key is wrong or missing

Two specific problems arise from join errors:

**The Cartesian product:** If you join two tables without specifying a join condition - or with an incorrect one - you get every possible combination of rows from both tables. A table with 1,000 songs joined to a table with 500 artists with no condition gives you 500,000 result rows, most of which are meaningless. This is called a Cartesian product, and it's one of the most common query mistakes. The result looks like data but is mostly noise.

**Missing rows:** If a song's `artist_id` doesn't match any artist in the Artist table (an orphaned record, which referential integrity should prevent), that song simply won't appear in the join result. If you're counting songs and some are silently dropped, your count is wrong. Understanding this behavior - called an INNER JOIN - is important for knowing when you might lose rows you expected to keep. We'll explore this thoroughly in Chapter 9.

### Aggregating: summarizing many rows into fewer

**Aggregating** means collapsing many rows into fewer rows by computing a summary value. Instead of seeing every individual stream, you see total streams per artist. Instead of every individual ticket price, you see total revenue per event.

The common aggregation functions:
- **COUNT** - how many rows? (How many streams? How many tickets sold?)
- **SUM** - what's the total? (Total revenue? Total minutes streamed?)
- **AVG** - what's the average? (Average ticket price? Average stream duration?)
- **MIN / MAX** - what's the smallest or largest? (Cheapest ticket? Longest set?)

Aggregation always involves grouping. You're not just asking "what's the total revenue?" - you're asking "what's the total revenue *per event*?" or "per artist?" or "per month?" The grouping defines the level at which the summary is computed.

### Collapsing detail into summary: COUNT, SUM, AVG

Here's an important thing to internalize about aggregation: it **destroys detail.** When you aggregate streams per artist per month, you can no longer see which individual songs contributed to each total. The individual stream rows are gone from your result - replaced by a single summary row per artist per month.

This is fine when summary is what you need. But it means you have to think carefully about what level of detail your question requires.

"How many streams did Bad Bunny have in March?" - summary is fine.
"Which of Bad Bunny's songs drove the most streams in March?" - you need song-level detail, not just artist-level totals.

Both questions are about Bad Bunny's March streams, but they require different levels of aggregation. Planning the right level of aggregation is a key part of query thinking.

### What you lose when you aggregate - and when that's fine

The rule of thumb: aggregate as late as possible and only as much as necessary.

Start with the detail level, verify that the rows look right, then aggregate. Don't aggregate first and then wonder if the detail was correct. This sequence - inspect detail, then summarize - catches errors that would be invisible in the final aggregated output.

And remember: sometimes aggregation is exactly what you need and the detail is irrelevant. If someone asks "what was our total ticket revenue last semester?", they don't need to see 4,000 individual ticket rows - they need one number. Aggregation is the right answer. The discipline is knowing which situation you're in.

---

## 7.3 Relational Algebra as Intuition

### The select, project, and join operations in plain language

What makes relational algebra useful as intuition - rather than just formal notation - is the idea that these operations **compose**. In other words, the output of one operation is a valid input to the next.

Think of it as a pipeline:

```
Raw table
   → Filter (keep only the rows you want)
      → Project (keep only the columns you want)
         → Join (bring in columns from another table)
            → Aggregate (summarize the result)
               = Your answer
```

Every query, no matter how complex, is some combination of these operations applied in sequence. Understanding the pipeline is what lets you plan a query before you write it.

### Composing operations: the output of one is the input of the next

Here's a concrete example of the pipeline. The question: *"What are the names of students who bought tickets to the Spring Concert 2026?"*

Step 1 - **Filter** the Event table: keep only the row where `event_name = 'Spring Concert 2026'`. Result: one row representing that event, including its `event_id`.

Step 2 - **Filter** the Ticket table: keep only rows where `event_id` matches the event from step 1. Result: all ticket rows for the Spring Concert.

Step 3 - **Join** the filtered Ticket table to the Student table on `student_id`. Result: ticket rows with student information attached.

Step 4 - **Project** to keep only `student_name`. Result: a list of names.

Four operations, one after the other. The output of each step feeds the next. The final result is exactly what was asked for: a list of student names.

Notice we didn't write a single line of SQL. We planned the query entirely in plain English, as a sequence of operations. When we do write SQL in Chapter 8, it will be a translation of this plan - not a leap from question to code.

### Thinking in sets before thinking in syntax

The reason this pipeline approach works is set theory. Each operation takes a set of rows (a table or intermediate result) and produces another set of rows. Sets can be filtered, projected, joined, and aggregated. The mathematics guarantees that these operations compose correctly.

This is why it's worth thinking in sets even when you're not doing formal math. "I have a set of all streams. I want to narrow it to a subset of streams from last month. Then I want to join that subset to a set of songs to get genre information. Then I want to group the result into per-genre subsets and count each one." That's pure set thinking, stated in plain English, and it maps directly to a SQL query.

When you think in sets, the structure of the query becomes obvious before you know any syntax. This is the real purpose of relational algebra as intuition: not to do math, but to think clearly about what you want.

### A query as a pipeline of set transformations

Here's a slightly more complex example to make the pipeline concrete. The question: *"Which genres generated more than $50,000 in ticket revenue at campus events last semester?"*

Let's trace the pipeline:

**Start:** We have four tables - Event, Ticket, Song, Artist. (We'll assume Song has a genre attribute for simplicity, or that Artist has a primary genre.)

**Step 1 - Filter:** Keep only Events from last semester. (Filter on `event_date`.)

**Step 2 - Join:** Attach Ticket rows to their Events. (Join Event to Ticket on `event_id`.) Now we have ticket rows with event date information.

**Step 3 - Filter:** We already filtered Events, so this step is already handled - only tickets for last-semester events are in our set.

**Step 4 - Join:** Attach Artist information to each ticket. (This requires going through Song - or if artists perform at events, through the Artist_Event junction.) Now we have tickets with genre information.

**Step 5 - Aggregate:** Group by genre, sum `ticket_price` for each group. Now we have one row per genre with a total revenue figure.

**Step 6 - Filter:** Keep only genres where total revenue > $50,000.

**Step 7 - Project:** Keep only genre and total revenue.

Seven steps, no SQL. But if you handed this plan to someone who knows SQL - or to an AI tool - they could translate it immediately. The thinking is done; the syntax is just transcription.

### Visualizing the shape of data at each step

One of the most useful habits in query planning is to visualize the shape of your data at each step of the pipeline. "Shape" means three things: how many rows? How many columns? And what does one row represent - the **grain** of the result, the same idea you met in Section 2.4, now applied to what a query returns rather than what a table stores.

At the start, you might have a million stream rows with 8 columns. After filtering to last month, maybe 80,000 rows. After joining to Song, still 80,000 rows but now with 5 more columns. After aggregating by genre, maybe 12 rows (one per genre) with 2 columns (genre, stream_count).

Tracking this shape helps you catch errors. If you expect 12 genre rows but get 47, something went wrong in the grouping. If you expect 80,000 stream rows but get 800,000, you probably have a bad join that's producing a Cartesian product.

Visualizing the shape is also how you verify that your aggregation landed at the right grain. If the result has 80,000 rows, you haven't aggregated yet. If it has 1 row, you've aggregated too much. The shape tells you where you are in the pipeline.

---

## 7.4 Planning a Query Before Writing It

### Sketching the result before writing the code

The most reliable query planning technique is deceptively simple: **start with the result.**

Before thinking about tables or operations, draw the output table. What does the answer look like? What columns does it have? What does one row represent?

For the question "Which artists had more than 1 million streams last month?", the result might look like:

| artist_name | stream_count |
|-------------|--------------|
| Sabrina Carpenter | 4,200,000 |
| Drake | 3,800,000 |
| Morgan Wallen | 1,400,000 |

Two columns: artist name and stream count. One row per artist. Filtered to only those with more than 1 million.

Now work backward from that result. Where does `artist_name` come from? The Artist table. Where does `stream_count` come from? Counting rows in the Stream table, grouped by artist. What joins that to the Artist table? The `artist_id` foreign key on the Song table, plus the relationship between Stream and Song.

Starting from the result and working backward is often faster and more reliable than starting from the tables and working forward. It keeps you focused on the answer rather than getting lost in the data model.

### Draw the columns you want in the output

This technique scales to complex queries. For any question:

1. Write out the column headers of your desired result.
2. For each column, ask: which table does this come from?
3. Identify the path of joins needed to connect those tables.
4. Identify the filters needed to narrow the data to the right scope.
5. Identify whether aggregation is needed, and at what level.

Let's try it with: *"For each event at the campus venue, show the event name, date, total tickets sold, and total revenue."*

Desired output columns: `event_name`, `event_date`, `tickets_sold`, `total_revenue`

- `event_name` → Event table
- `event_date` → Event table
- `tickets_sold` → COUNT of Ticket rows, grouped by event
- `total_revenue` → SUM of `ticket_price` from Ticket rows, grouped by event

Path: Event table joined to Ticket table on `event_id`. Group by event. No filter needed (we want all events).

Plan in plain English: *Join Event to Ticket, group by event_id, count tickets and sum prices, project event name, date, count, and sum.*

Done. The query is planned. Now it's just a matter of translating that plan into SQL - which you can do yourself, or hand to an AI with the plan already specified.

### Work backward to find which tables supply them

The backward-from-result technique is especially useful when the answer requires data from many tables. Instead of trying to navigate the entire data model forward, you just ask: "where does each output column live?" - and then trace the join path from there.

For complex queries, it helps to draw a quick map. Write each table you need, draw arrows for the joins, and annotate each arrow with the key you're joining on. This is essentially a subset of the ER diagram, focused on just the tables relevant to your question.

This habit - drawing a quick join map before writing a query - is something experienced data analysts do automatically. It prevents the two most common join errors: joining on the wrong key and forgetting a table.

### Identifying which tables you need and how they connect

Not every query needs every table in the database. Part of query planning is identifying the minimum set of tables required to answer the question.

For "what's the average ticket price per event?", you only need the Ticket table - `event_id` and `ticket_price` are both in Ticket, so no join is needed. You group by `event_id` and average `ticket_price`.

For "what's the average ticket price per venue?", you need Ticket joined to Event - `venue_id` is in Event, not Ticket. One join, on `event_id`.

For "what's the average ticket price per venue city?", you need Ticket joined to Event joined to Venue - `venue_city` is in Venue. Two joins.

The more specific the question, the more tables you typically need. But the discipline is to use only the tables you actually need, not all of them. Unnecessary joins slow down queries and introduce opportunities for errors.

### The join path: tracing foreign keys from table to table

The join path is the sequence of joins required to connect the tables your question needs. You trace it by following foreign keys in the ER diagram.

For example, in the campus music system from Chapter 6:

To get from Stream to Artist, the path is: Stream → Song (via `song_id`) → Artist (via `artist_id`). Two joins.

To get from Ticket to Venue, the path is: Ticket → Event (via `event_id`) → Venue (via `venue_id`). Two joins.

To get from Ticket to Artist (e.g., "which tickets are for events featuring Artist X?"), the path is: Ticket → Event (via `event_id`) → Artist_Event (via `event_id`) → Artist (via `artist_id`). Three joins.

Long join paths aren't a problem - they're just a fact of working with a normalized database. What matters is that you trace the path correctly and don't skip any steps. Skipping a table in a join path is like skipping a link in a chain: everything downstream breaks.

### What to do when the path is long or ambiguous

Sometimes the join path isn't obvious. There might be multiple routes through the data model between two tables, and they don't all produce the same result. This is a sign that the question itself is ambiguous - and the right response is to go back and clarify the question before writing the query.

For example: "How many songs does each artist have?" seems simple. But what counts as "the artist's songs"? Primary artists only? Including featured appearances? What if the same song is attributed to multiple artists - does it count for all of them?

Each interpretation leads to a different join path and a different answer. Clarifying the question before writing the query is always the right move. An AI tool will pick an interpretation and produce SQL - but it might pick the wrong one. Your conceptual understanding is what lets you specify the question clearly enough that the AI gets it right.

---

## Chapter Summary

Good querying starts with a clear business question, not with SQL syntax. The most common errors in data work come from imprecision about what's being asked - counting streams instead of users, aggregating at the wrong level, including the wrong time range. Slowing down to state the question precisely prevents these errors.

Every question you can ask of a relational database decomposes into four fundamental operations: filtering (keeping only the rows you care about), projecting (keeping only the columns you care about), joining (combining information across tables on a shared key), and aggregating (collapsing many rows into summary values).

These operations compose into pipelines. The output of one operation feeds the next: filter, then join, then aggregate, then project. Planning a query as a pipeline of operations - before writing any syntax - produces clearer, more correct queries.

The most reliable planning technique is to start with the result: sketch the output table first, then work backward to identify which tables supply which columns, what joins connect them, and what filters and aggregations are needed.

SQL is a translation of this plan. If the plan is clear, the SQL - whether written by you or by an AI - follows naturally.

---

## Key Terms

**Filter** - A query operation that keeps only rows matching a specified condition, discarding all others. In relational algebra, called "select."

**Project** - A query operation that keeps only specified columns, discarding all others.

**Join** - A query operation that combines rows from two tables based on matching values in a shared key column.

**Aggregate** - A query operation that collapses many rows into fewer rows by computing summary values (COUNT, SUM, AVG, MIN, MAX).

**Cartesian product** - The result of joining two tables without a join condition: every possible combination of rows from both tables. Almost always a query error.

**Relational algebra** - The mathematical framework underlying relational databases, defining formal operations (select, project, join) that compose to answer any query.

**Query pipeline** - The sequence of operations (filter, join, aggregate, project) applied in order to transform raw table data into a query result.

**Join path** - The sequence of joins required to connect two tables that are not directly related, traced through foreign key relationships in the data model.

**Grain (of a query result)** - What one row of a query's output represents. The same idea as a table's grain (Section 2.4), applied to the rows a query returns rather than the rows a table stores. Worth defining before planning the aggregation step.

---

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

---

### Activity 7.1 - Concept Check: The Four Operations of Relational Thinking

*This activity checks your understanding of the key ideas from Chapter 7. The AI will quiz you one question at a time, give feedback, and help fill in any gaps.*

---

**Copy and paste this prompt into your AI tool:**

> I've just finished reading Chapter 7 of my Introduction to Databases textbook, which covered query thinking - specifically the four fundamental operations of relational querying (filtering, projecting, joining, and aggregating), how they compose into pipelines, and how to plan a query before writing SQL. I want to check my understanding. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and explain it more clearly if needed. Then ask if I'd like to go deeper before moving to the next question.
>
> Here are the questions:
>
> - Why does the chapter say "what SQL do I write?" is the wrong first question? What should you ask instead?
> - What is filtering? Give an example of a filter condition from everyday life - not from the textbook.
> - What is projecting? Why is returning fewer columns usually better than returning all of them?
> - What is joining? What is the role of the shared key, and what goes wrong when the join key is incorrect?
> - What is a Cartesian product, and how does it happen?
> - What is aggregating? What do you lose when you aggregate, and when is that loss acceptable?
> - What does it mean to think of a query as a "pipeline"? Walk me through the steps of the pipeline in order.
> - What is the technique of "starting with the result"? How does it help you plan a query?
> - What is a join path? Give an example of a two-step join path.

---

### Activity 7.2 - Apply It: Decompose a Business Question

*This activity asks you to take a real business question and break it down into the four relational operations before any SQL is written. The AI will guide you through the decomposition step by step.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying query thinking in my Introduction to Databases class. I just learned about the four fundamental operations - filtering, projecting, joining, and aggregating - and how to plan a query as a pipeline before writing SQL. I want to practice decomposing business questions.
>
> I'll give you a database schema, and then you'll present me with business questions one at a time. For each question, guide me through decomposing it into operations. Ask me one question at a time and wait for my answer before continuing. After each answer, tell me what I got right, fill in anything I missed, and push my thinking further.
>
> Here's the schema we're working with (a music streaming service):
>
> - ARTIST (artist_id, artist_name, genre, hometown)
> - ALBUM (album_id, album_title, artist_id, release_date)
> - SONG (song_id, song_title, album_id, artist_id, duration_seconds, explicit)
> - USER (user_id, username, email, subscription_tier, signup_date)
> - STREAM (stream_id, user_id, song_id, stream_date, seconds_listened)
> - PLAYLIST (playlist_id, playlist_name, user_id, created_date)
> - PLAYLIST_SONG (playlist_id, song_id, position)
>
> Present me with these business questions one at a time:
>
> 1. "How many songs does each artist have on the platform?"
> 2. "Which users have streamed more than 100 songs in the past 30 days?"
> 3. "What are the top 5 most-added songs to playlists?"
> 4. "Which albums have an average song duration of more than 4 minutes?"
> 5. "What is the total listening time (in hours) per subscription tier last month?"
>
> For each question, ask me:
> a) What is the grain of the result - what does one row in the answer represent?
> b) Which tables do you need?
> c) What joins connect them, and in what order?
> d) What filters do you need to apply?
> e) Is aggregation needed? If so, what are you grouping by and what are you computing?
> f) What columns does the final result have?
>
> After we've worked through all five questions, ask me to come up with my own business question for this schema and walk through the decomposition myself.

---

### Activity 7.3 - Practice: Name That Operation

*This activity gives you quick practice identifying which of the four operations each part of a question calls for - building the pattern recognition you need before writing SQL.*

---

**Copy and paste this prompt into your AI tool:**

> I'm learning about query operations in my Introduction to Databases class. I want to practice identifying which operation - filtering, projecting, joining, or aggregating - is needed for each part of a question. Sometimes more than one operation is needed for a single question.
>
> Please present the following questions and phrases to me one at a time. For each one, ask me: (a) Which operation(s) does this require? (b) How do you know? Wait for my answer, tell me if I'm right, and explain the reasoning. Ask if I want to discuss further before moving on.
>
> Here are the items:
>
> 1. "Show me only the title and duration of each song - I don't need anything else."
> 2. "Give me all streams from users who signed up in 2025."
> 3. "I want to see each song's title alongside the name of the artist who recorded it."
> 4. "How many streams did each song get last week?"
> 5. "List the usernames of users who have created more than 10 playlists."
> 6. "Show me every song that is over 5 minutes long and marked as explicit."
> 7. "What is the average number of songs per playlist?"
> 8. "Give me the artist name, song title, and album title for every song released in 2024."
> 9. "Which genres have more than 500 songs on the platform?"
> 10. "Show me all songs that have never been added to any playlist."
>
> After we've gone through all of them, give me two of your own examples - one that requires all four operations, and one that requires only one - and ask me to identify which operations each one needs.

---

### Activity 7.4 - Case Study: Plan a Query Without Writing SQL

*This activity puts you in a realistic scenario where you have to plan queries for a business stakeholder - entirely in plain English, with no SQL. The AI plays the role of the stakeholder asking the questions.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying query thinking in my Introduction to Databases class. I want to practice planning queries without writing SQL - using the pipeline approach my textbook teaches: start with the result, identify the tables, plan the joins and filters and aggregations, then describe the plan in plain English.
>
> Please play the role of a product manager at a campus event ticketing company. You have data questions you need answered, and I'm the data analyst who will plan the queries. You don't care about SQL - you just want me to explain what the query will do in plain English before I (or an AI) writes it.
>
> Ask me one question at a time and wait for my response. After each response, react as the product manager: confirm that my plan would answer your question, push back if something seems off, and ask follow-up questions if my plan is unclear or incomplete.
>
> Here is the schema:
>
> - VENUE (venue_id, venue_name, capacity, location)
> - ARTIST (artist_id, artist_name, genre)
> - EVENT (event_id, event_name, venue_id, event_date, ticket_price)
> - ARTIST_EVENT (artist_id, event_id, is_headliner, performance_order)
> - STUDENT (student_id, student_name, email, grad_year)
> - TICKET (ticket_id, event_id, student_id, seat_assignment, purchase_date)
> - SPONSOR (sponsor_id, sponsor_name)
> - SPONSOR_EVENT (sponsor_id, event_id, contribution_amount)
>
> Here are my questions for you:
>
> 1. "I want to know which of our events sold out - meaning they sold tickets equal to or greater than the venue's capacity. Which events are those?"
> 2. "I need to send a thank-you email to every student who attended at least one event this academic year (August 2025 through May 2026). Can you get me their names and emails?"
> 3. "We're trying to understand our sponsor ROI. For each sponsor, I want to see how much they contributed in total, how many events they sponsored, and the average ticket revenue across those events."
> 4. "Which genres of artists are most popular with our students - measured by total tickets sold to events featuring artists of that genre?"
>
> After I've planned all four queries, give me feedback: which plans were clear and complete, which had gaps or ambiguities, and what habit would most improve my query planning?
