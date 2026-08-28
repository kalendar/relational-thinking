# Chapter 5: Normalization as a Design Philosophy

---

Here's a scenario you've probably encountered. Someone builds a spreadsheet to track something — concert bookings, class schedules, employee information — and it works fine at first. Then the data grows. People start noticing problems. Changing one thing requires changing it in five places. A typo in one row makes a report come out wrong. Deleting one record accidentally wipes out information you needed.

The spreadsheet wasn't wrong. It was just designed without thinking carefully about redundancy. And redundancy, it turns out, is the root of most data quality problems.

**Normalization** is the process of designing a database to eliminate redundancy. It's not a set of arbitrary rules to memorize — it's a way of thinking about data that, once internalized, becomes almost instinctive. This chapter teaches you how to think about normalization, not just how to apply it.

---

## 5.1 The Problem: Redundancy and Its Costs

### What redundant data looks like in practice

Redundancy means storing the same fact in more than one place. It seems harmless — maybe even helpful, like having a backup. But in a database, redundancy is almost always a problem.

Let's look at a concrete example. Imagine a small music venue is tracking their bookings in a single table called `Booking`:

| booking_id | artist_name    | artist_manager      | manager_email           | venue_name      | venue_city  | show_date  | ticket_price |
|------------|----------------|---------------------|-------------------------|-----------------|-------------|------------|--------------|
| 1          | Gracie Abrams  | Jordan Lee          | jordan@wmeagency.com    | The Fillmore    | San Francisco | 2026-03-12 | $35 |
| 2          | Gracie Abrams  | Jordan Lee          | jordan@wmeagency.com    | The Ryman       | Nashville   | 2026-03-15 | $40 |
| 3          | Gracie Abrams  | Jordan Lee          | jordan@wmeagency.com    | 9:30 Club       | Washington DC | 2026-03-18 | $38 |
| 4          | Noah Kahan     | Sarah Bloom         | sbloom@paradigm.com     | The Fillmore    | San Francisco | 2026-04-01 | $45 |
| 5          | Noah Kahan     | Sarah Bloom         | sbloom@paradigm.com     | Red Rocks       | Morrison, CO | 2026-04-05 | $55 |

At first glance, this looks fine. All the information is there. But look at what's happening: Gracie Abrams's manager information appears on every single booking row for Gracie Abrams. The Fillmore's city appears on every booking at The Fillmore. These are the same facts, repeated.

This is redundancy. And it causes three specific categories of problems.

### The "everything in one spreadsheet" anti-pattern

The Booking table above is the classic "everything in one spreadsheet" design. It's intuitive — you want to see all the information about a booking in one place, so you put all the information about a booking in one place. The problem is that the "information about a booking" includes facts about *other things* — facts about the artist, the manager, the venue — that don't change from booking to booking.

When you repeat those facts on every row, you create a database that looks complete but is fragile. A small change in the real world requires multiple updates in the database, and if any of those updates are missed, the data becomes inconsistent.

The fix — which normalization provides — is to give each fact one home and reference it from other tables when needed.

### Update anomaly: changing one fact requires changing many rows

Suppose Gracie Abrams gets a new manager. Her old manager, Jordan Lee, has left and been replaced by someone named Priya Patel at a new email address.

In the Booking table above, you'd need to update rows 1, 2, and 3. What if there are 30 bookings? You update 30 rows. What if you miss one? Now your database contains two different managers for Gracie Abrams — one in most rows, one in the row you forgot to update. Which one is correct? You don't know.

This is the **update anomaly**: when the same fact is stored in multiple rows, updating it requires changing every row — and any missed update creates inconsistency.

In a properly normalized database, Gracie Abrams's manager information would be stored exactly once, in the Artist table. Updating the manager means changing one row, and the change is immediately consistent everywhere.

### Insert anomaly: you can't record something without recording something else

Now imagine you want to add a new venue — The Troubadour in Los Angeles — to your database. In the Booking table, there's nowhere to put venue information unless it's attached to a booking. You can't add The Troubadour until you have a booking there.

This is the **insert anomaly**: the structure of the table forces you to record one type of information only in the presence of another type, even when the two things are independent.

The venue exists before any bookings happen there. It should be possible to record the venue independently. In a normalized design, venues have their own table, and you can add The Troubadour the moment you know about it, regardless of whether any shows are booked.

### Delete anomaly: deleting one fact destroys another

Now suppose Noah Kahan's two bookings (rows 4 and 5) are both cancelled. You delete those rows from the Booking table. What else have you just deleted?

Everything you knew about Noah Kahan. His manager's name and email are gone. If you didn't have that information anywhere else, you've lost it.

This is the **delete anomaly**: when facts about different things are stored in the same row, deleting a row for one reason accidentally destroys information about something else entirely.

In a normalized design, Noah Kahan's artist information lives in the Artist table. Deleting his bookings doesn't touch the Artist table. The information is safe.

These three anomalies — update, insert, and delete — are the practical costs of redundancy. Normalization is the systematic approach to eliminating them.

---

## 5.2 Functional Dependencies

### What it means for one attribute to determine another

Before we can normalize a table, we need a way to reason about which attributes belong together and which don't. That's what **functional dependencies** give us.

A functional dependency is a relationship between two attributes where the value of one attribute determines the value of the other. We write it as A → B, which means: "knowing A tells you B."

Some examples:

- `artist_id → artist_name`: Knowing the artist's ID tells you their name. Each artist has one name.
- `artist_id → manager_email`: Knowing the artist tells you their manager's email.
- `venue_id → venue_city`: Knowing the venue tells you what city it's in.
- `booking_id → show_date`: Knowing the booking tells you the show date.

Functional dependencies are about facts: is this a fact about the artist, or a fact about the booking, or a fact about the venue? A fact about an artist depends on the artist. A fact about a booking depends on the booking.

### A → B: knowing A tells you B

It's important to understand what a functional dependency doesn't mean. It doesn't mean that B always has the same value — it means that for any given value of A, there's exactly one value of B.

For example: `venue_city → venue_name` is *not* a valid functional dependency. Knowing that a city is San Francisco doesn't tell you the venue name, because there are multiple venues in San Francisco. But `venue_name → venue_city` might be valid — if we assume venue names are unique, then knowing the venue name tells you the city.

The direction matters. A → B means "knowing A tells you B," not "knowing B tells you A."

### Examples from business data: ZIP code → city, employee ID → department

Here are some functional dependencies you'll encounter frequently in business databases:

- `employee_id → department`: An employee belongs to one department. Knowing the employee ID tells you the department.
- `product_sku → product_name`: A SKU (stock-keeping unit) uniquely identifies a product.
- `zip_code → city`: In the US, a ZIP code maps to one city. (This is why databases often store ZIP code and city separately rather than having users type the city — you can look it up from the ZIP.)
- `order_id, product_id → quantity`: In an order line item, knowing both the order and the product tells you the quantity ordered of that product.

Notice that last one: it takes *two* attributes together to determine the quantity. This is called a **composite dependency** — the quantity depends on the combination of order and product, not on either alone.

### Spotting functional dependencies in a table

The practical skill is learning to look at a table and ask: what is each column a fact *about*?

Go back to the Booking table:

- `artist_name`, `artist_manager`, `manager_email` are all facts about the **artist**. They depend on `artist_id` (or artist identity), not on `booking_id`.
- `venue_name`, `venue_city` are facts about the **venue**. They depend on venue identity, not on `booking_id`.
- `show_date`, `ticket_price` are facts about the **booking**. They depend on `booking_id`.

When a table contains columns that are facts about different things, that's a sign the table needs to be split. Each table should contain facts about exactly one thing — one entity. That's what normalization enforces.

### The smell test: "does this column really belong here?"

A quick diagnostic: for each column in a table, ask "is this a fact about the thing this table is supposed to represent?"

In a Booking table, `show_date` passes the test — it's a fact about the booking. But `artist_manager` fails — it's a fact about the artist, not the booking. It doesn't change based on which booking you're looking at; it changes based on which artist you're looking at.

When a column doesn't pass the smell test, it's in the wrong table. Normalization is the process of moving it to the right one.

---

## 5.3 The Normal Forms

Normalization is typically described through a series of **normal forms** — levels of design quality, each eliminating a specific type of redundancy. Think of them as a checklist you work through when designing a table.

We'll cover the three most important ones: First Normal Form (1NF), Second Normal Form (2NF), and Third Normal Form (3NF). Each builds on the previous one.

### First Normal Form: atomicity and repeating groups

A table is in **First Normal Form (1NF)** when:
1. Every cell contains a single, atomic value (no lists or nested values).
2. There are no repeating groups (no multiple columns representing the same type of thing).

We covered atomicity thoroughly in Chapter 2, so the first requirement should feel familiar. The second is new.

**Repeating groups** happen when you represent a one-to-many relationship inside a single table by adding numbered columns. For example, imagine tracking an artist's setlist for a show:

| booking_id | artist_name | song_1        | song_2       | song_3      | song_4      |
|------------|-------------|---------------|--------------|-------------|-------------|
| 1          | Gracie Abrams | Difficult   | 21          | I Love You, I'm Sorry | Risk |

This design has repeating groups: `song_1`, `song_2`, `song_3`, `song_4` are all the same type of thing (a song in the setlist), just numbered. Problems: what if a show has 20 songs? Do you add 20 columns? What if you want to find all shows where a specific song was played? You'd have to search across four (or twenty) columns.

The 1NF fix is to give each song its own row in a separate table:

| setlist_id | booking_id | song_title              | set_position |
|------------|------------|-------------------------|--------------|
| 1          | 1          | Difficult               | 1            |
| 2          | 1          | 21                      | 2            |
| 3          | 1          | I Love You, I'm Sorry   | 3            |
| 4          | 1          | Risk                    | 4            |

Now each row is one fact (one song in one setlist), and the table is in 1NF.

### Every attribute must contain a single, indivisible value

The atomicity requirement of 1NF is violated by:
- Comma-separated lists in a single cell ("Pop, R&B, Soul")
- Concatenated values ("Houston, TX" when city and state should be separate)
- JSON or structured objects embedded in a column
- Formatted values like "3:47" for a duration that should be stored as seconds

Each of these makes the data harder to query. The fix is always to either split the value into separate columns or move it to a separate table.

### Second Normal Form: eliminating partial dependencies

A table is in **Second Normal Form (2NF)** when:
1. It's already in 1NF.
2. Every non-key attribute depends on the *whole* primary key, not just part of it.

2NF is only relevant when a table has a **composite primary key** — a primary key made of two or more columns. If the primary key is a single column, a table in 1NF is automatically in 2NF.

Consider an `OrderItem` table with a composite primary key of `(order_id, product_id)`:

| order_id | product_id | product_name | product_price | quantity |
|----------|------------|--------------|---------------|----------|
| 1001     | 501        | Band Tee     | $35           | 2        |
| 1001     | 502        | Poster       | $20           | 1        |
| 1002     | 501        | Band Tee     | $35           | 1        |

The primary key is the combination of `order_id` and `product_id`. But look at `product_name` and `product_price` — do they depend on the combination of order and product, or just on the product?

Just the product. `product_name = "Band Tee"` is true regardless of which order it appears in. This is a **partial dependency** — `product_name` depends on only part of the composite key (`product_id`), not the whole key.

The fix is to move `product_name` and `product_price` to their own `Product` table, where `product_id` is the primary key:

**Product table:**
| product_id | product_name | product_price |
|------------|--------------|---------------|
| 501        | Band Tee     | $35           |
| 502        | Poster       | $20           |

**OrderItem table (now in 2NF):**
| order_id | product_id | quantity |
|----------|------------|----------|
| 1001     | 501        | 2        |
| 1001     | 502        | 1        |
| 1002     | 501        | 1        |

Now `quantity` is the only non-key attribute in the OrderItem table, and it correctly depends on the full composite key — how many of a specific product were in a specific order. The product's name and price live in the Product table, stored once, referenced by foreign key.

### Every non-key attribute must depend on the whole key

The 2NF test: for each non-key column, ask "does this depend on the entire primary key, or could it be determined by just part of it?"

If a column depends on just part of a composite key, it's a partial dependency and belongs in its own table. This is the same intuition as the "smell test" from section 5.2 — the column is a fact about something other than what this table represents.

### Third Normal Form: eliminating transitive dependencies

A table is in **Third Normal Form (3NF)** when:
1. It's already in 2NF.
2. Every non-key attribute depends *directly* on the primary key — not on another non-key attribute.

A **transitive dependency** happens when a non-key attribute determines another non-key attribute. The second attribute depends on the primary key *through* the first attribute, not directly.

Here's the classic example. Imagine an Artist table:

| artist_id | artist_name    | manager_name | manager_email           |
|-----------|----------------|--------------|-------------------------|
| 1         | Gracie Abrams  | Jordan Lee   | jordan@wmeagency.com    |
| 2         | Noah Kahan     | Sarah Bloom  | sbloom@paradigm.com     |
| 3         | Sabrina Carpenter | Jordan Lee | jordan@wmeagency.com    |

The primary key is `artist_id`. Both `manager_name` and `manager_email` depend on `artist_id` — but they also have a dependency between them: `manager_name → manager_email`. Knowing the manager's name tells you their email address (assuming manager names are unique).

This is a transitive dependency: `artist_id → manager_name → manager_email`. The email doesn't depend *directly* on the artist — it depends on the manager, who depends on the artist.

The problem: if Jordan Lee changes their email address, you have to update rows 1 and 3. The same update anomaly we saw in section 5.1. Manager information belongs in its own table.

**Manager table:**
| manager_id | manager_name | manager_email           |
|------------|--------------|-------------------------|
| 1          | Jordan Lee   | jordan@wmeagency.com    |
| 2          | Sarah Bloom  | sbloom@paradigm.com     |

**Artist table (now in 3NF):**
| artist_id | artist_name       | manager_id |
|-----------|-------------------|------------|
| 1         | Gracie Abrams     | 1          |
| 2         | Noah Kahan        | 2          |
| 3         | Sabrina Carpenter | 1          |

Now Jordan Lee's email is stored once. Updating it takes one change. And if Jordan Lee takes on a new artist, you just add a row to the Artist table with `manager_id = 1` — no need to re-enter contact information.

### Non-key attributes must depend on the key, not on each other

The 3NF test: for each non-key column, ask "does any other non-key column determine this one?"

If `column B` is determined by `column A`, and `column A` is not the primary key, you have a transitive dependency. The fix is to move `column A` and `column B` into their own table, with `column A` as the primary key.

The ZIP code example from section 5.2 is a classic case: `zip_code → city`. If both `zip_code` and `city` are non-key columns in a Customer table, city transitively depends on the primary key through ZIP code. The right design either stores only the ZIP code (and looks up the city when needed) or creates a separate ZIP code reference table.

---

## 5.4 Normalization as Judgment, Not Formula

### When to normalize and when to stop

You might be wondering: are there normal forms beyond 3NF? Yes — there's BCNF (Boyce-Codd Normal Form), 4NF, 5NF, and beyond. Each eliminates more subtle types of dependency.

For most business databases, **3NF is the target**. It eliminates the update, insert, and delete anomalies that cause real problems, without over-engineering the design. Going further is rarely necessary and sometimes counterproductive.

The signs that you've reached a good stopping point:
- Each table represents exactly one entity or relationship.
- Every non-key column is a fact about the primary key, the whole primary key, and nothing but the primary key. (This is a useful mnemonic — we'll return to it.)
- Changing any real-world fact requires changing exactly one row in exactly one table.

When all three of these are true, you're in good shape. Normalizing further is diminishing returns.

### 3NF is usually enough for transactional systems

Transactional systems — systems that record business events as they happen (orders, bookings, enrollments, payments) — benefit enormously from normalization. The data is written frequently, by many users, in many small operations. Consistency is critical. 3NF is the standard target.

The one area where you'll sometimes see intentional denormalization in transactional systems is for performance. Joins cost time. If a query that needs to run in milliseconds requires joining eight tables, you might denormalize — deliberately store a fact in two places — to speed it up. But this should be a conscious, documented trade-off, not a default design choice.

### Signs that you've over-normalized

Yes, it's possible to normalize too much. Signs of over-normalization:

- Simple queries require joining five or more tables to get basic information.
- Tables have only two or three columns.
- The database is hard to understand because it's been split into so many small pieces.
- Performance is unacceptably slow because of join overhead.

Over-normalization is less common than under-normalization, but it happens — especially when designers apply the rules mechanically without asking whether the design serves the system's actual needs.

The goal is not the most normalized design. The goal is the most appropriate design for the system's purpose.

### Denormalization and the performance trade-off

**Denormalization** is the deliberate decision to introduce redundancy — to store a fact in more than one place — in exchange for performance.

The most common scenario: analytical systems (dashboards, reports, data warehouses) that run complex queries across millions of rows. These systems are read-heavy — they don't update data frequently, but they read it constantly. For these systems, the cost of redundancy (update anomalies) is low (updates are rare), and the benefit of eliminating joins (faster reads) is high.

This is why data warehouses use a design style called the **star schema** or **snowflake schema** — deliberately denormalized structures that make common analytical queries fast. We'll revisit this in Chapter 13.

The key discipline: when you denormalize, do it explicitly and document why. Don't denormalize by accident (that's just bad design). Denormalize by choice, with a clear reason, and with a plan for managing the redundancy you've introduced.

### How to document intentional denormalization decisions

When you make a deliberate decision to denormalize, write it down. A comment in the schema, a note in the data dictionary, a line in the design document:

*"The `artist_name` column is stored redundantly in the Stream table (in addition to the Artist table) to avoid a join on high-frequency stream queries. Update the Artist table first; a nightly job synchronizes the Stream table."*

This kind of documentation turns a potentially confusing design decision into a clear, intentional engineering choice. Future maintainers — including future you — will thank you.

---

## Chapter Summary

Redundancy is the root of most data quality problems. When the same fact is stored in more than one place, it becomes vulnerable to inconsistency through three types of anomalies: update anomalies (changing one fact requires changing many rows), insert anomalies (you can't record one thing without recording another), and delete anomalies (deleting one thing accidentally destroys information about something else).

Functional dependencies are the tool for reasoning about what belongs together. A → B means "knowing A tells you B." When non-key columns are facts about something other than the table's primary key, they're functionally dependent on the wrong thing — and belong in a different table.

The three normal forms provide a systematic path to a well-designed database. First Normal Form requires atomic values and no repeating groups. Second Normal Form requires that every non-key column depend on the whole primary key (relevant only for composite keys). Third Normal Form requires that every non-key column depend directly on the primary key — not on another non-key column.

Normalization is judgment, not formula. For most transactional databases, 3NF is the right target. Going further is rarely necessary; going less far leaves you with anomalies. Denormalization is sometimes appropriate for performance, but only when done deliberately, with documentation.

The goal is not the most normalized design — it's the most appropriate one.

---

## Key Terms

**Normalization** — The process of designing a database to eliminate redundancy and the anomalies it causes.

**Redundancy** — Storing the same fact in more than one place in a database.

**Update anomaly** — A problem caused by redundancy: changing one real-world fact requires updating multiple rows, and inconsistency results if any are missed.

**Insert anomaly** — A problem caused by redundancy: you can't record information about one thing without also recording information about another.

**Delete anomaly** — A problem caused by redundancy: deleting a row to remove one piece of information accidentally destroys other information stored in the same row.

**Functional dependency** — A relationship between two attributes where knowing the value of one tells you the value of the other. Written A → B.

**Partial dependency** — A dependency where a non-key attribute depends on only part of a composite primary key. Eliminated in 2NF.

**Transitive dependency** — A dependency where a non-key attribute depends on another non-key attribute rather than directly on the primary key. Eliminated in 3NF.

**First Normal Form (1NF)** — Every cell contains an atomic value; no repeating groups.

**Second Normal Form (2NF)** — In 1NF, plus every non-key attribute depends on the full primary key (not just part of it).

**Third Normal Form (3NF)** — In 2NF, plus every non-key attribute depends directly on the primary key, not on another non-key attribute.

**Denormalization** — The deliberate introduction of redundancy to improve performance, typically in analytical systems. Should be documented and intentional.

---

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

---

### Activity 5.1 — Concept Check: Normalization and the Normal Forms

*This activity checks your understanding of the key ideas from Chapter 5. The AI will quiz you one question at a time, give feedback, and help fill in any gaps.*

---

**Copy and paste this prompt into your AI tool:**

> I've just finished reading Chapter 5 of my Introduction to Databases textbook, which covered normalization — including redundancy, anomalies, functional dependencies, and the first three normal forms. I want to check my understanding. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and explain it more clearly if needed. Then ask if I'd like to go deeper before moving to the next question.
>
> Here are the questions:
>
> - What is redundancy in a database, and why is it a problem?
> - What is an update anomaly? Give an example.
> - What is an insert anomaly? Give an example.
> - What is a delete anomaly? Give an example.
> - What is a functional dependency? What does A → B mean in plain English?
> - What is the difference between a partial dependency and a transitive dependency?
> - What does First Normal Form require, and what problem does it solve?
> - What does Second Normal Form require, and when is it relevant?
> - What does Third Normal Form require, and what problem does it solve?
> - The chapter says normalization is "judgment, not formula." What does that mean? When might you deliberately choose not to fully normalize a table?

---

### Activity 5.2 — Apply It: Diagnose a Messy Table

*This activity asks you to look at a poorly designed table, identify what's wrong with it, and work through how to fix it. The AI will guide you step by step.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying normalization in my Introduction to Databases class. I want to practice diagnosing and fixing a poorly designed database table. I'll describe a table and you'll guide me through analyzing it.
>
> Ask me one question at a time and wait for my answer before continuing. After each answer, tell me what I got right, what I'm missing, and help me think more carefully.
>
> Here's the table I'm analyzing. It's called `StudentCourse` and it's used by a university to track which students are enrolled in which courses:
>
> Columns: student_id, student_name, student_email, student_major, course_id, course_name, course_credits, professor_id, professor_name, professor_email, professor_department, enrollment_date, grade
>
> Example rows:
> - 1001, Maya Torres, mtorres@mu.edu, MIS, MIS310, Intro to Databases, 3, P042, Dr. Wiley, dwiley@mu.edu, MIS, 2026-01-15, A
> - 1001, Maya Torres, mtorres@mu.edu, MIS, MKTG201, Marketing Principles, 3, P018, Dr. Rhodes, jrhodes@mu.edu, Marketing, 2026-01-15, B+
> - 1002, James Park, jpark@mu.edu, Finance, MIS310, Intro to Databases, 3, P042, Dr. Wiley, dwiley@mu.edu, MIS, 2026-01-16, NULL
>
> Here are the questions:
>
> 1. What redundancy do you see in this table? Which facts are being repeated across multiple rows?
> 2. Describe a specific update anomaly this design would cause.
> 3. Describe a specific insert anomaly this design would cause.
> 4. Describe a specific delete anomaly this design would cause.
> 5. List the functional dependencies you can identify. For each one, write it in A → B form.
> 6. Is this table in First Normal Form? Second Normal Form? Third Normal Form? Explain your reasoning for each.
> 7. How would you redesign this as a normalized set of tables? Name the tables, their primary keys, and their columns.
>
> After my final answer, give me a summary of the redesigned schema and explain which anomalies each change eliminates.

---

### Activity 5.3 — Practice: Spot the Dependency

*This activity gives you practice identifying functional dependencies — the foundational skill for normalization.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying normalization in my Introduction to Databases class and I want to practice identifying functional dependencies. A functional dependency A → B means "knowing A tells you B" — that for any given value of A, there's exactly one value of B.
>
> Please present the following attribute pairs to me one at a time. For each one, ask me: (a) Is there a functional dependency here? If so, which direction — A → B, B → A, both, or neither? (b) Is this dependency likely to hold in the real world, or are there exceptions? (c) Would this dependency cause a normalization problem if both attributes were non-key columns in the same table?
>
> Wait for my answer each time. Tell me if I'm right, correct me if I'm wrong, and explain the reasoning. Ask if I want to discuss further before moving on.
>
> Here are the pairs:
>
> 1. ZIP code and city (in the US)
> 2. Student ID and student GPA
> 3. Song title and artist name
> 4. ISBN and book title
> 5. Employee ID and employee's department
> 6. Order ID and order date
> 7. Customer's last name and customer's email address
> 8. Product SKU and product price
> 9. Flight number and departure city
> 10. Course ID and professor name (for a given semester)
>
> After we've gone through all of them, give me two new pairs and ask me to classify them myself.

---

### Activity 5.4 — Case Study: Normalize a Real-World Table

*This activity walks you through a full normalization exercise on a realistic table, from identifying problems all the way to a finished normalized design. The AI plays the role of a database design mentor.*

---

**Copy and paste this prompt into your AI tool:**

> I'm learning database normalization in my Introduction to Databases class. I want to work through a full normalization exercise from start to finish.
>
> Please play the role of a database design mentor. You'll present me with a messy, denormalized table and guide me through normalizing it step by step — first to 1NF, then 2NF, then 3NF. Ask me one question at a time and wait for my answer before continuing. After each answer, respond as my mentor — tell me what I got right, correct any mistakes, and explain the reasoning.
>
> Here's the table we're working with. It's called `MusicFestivalBooking` and is used by a festival promoter:
>
> Columns and sample data:
> - booking_id: 5001
> - festival_name: Bonnaroo
> - festival_location: Manchester, TN
> - festival_dates: June 12-15, 2026
> - artist_id: 201
> - artist_name: Hozier
> - artist_genre: Folk Rock
> - artist_hometown: Bray, Ireland
> - manager_name: Claire Hennesy
> - manager_email: claire@paradigm.com
> - stage_id: 3
> - stage_name: Which Stage
> - stage_capacity: 30000
> - performance_date: June 13, 2026
> - performance_time: 9:00 PM
> - set_length_minutes: 75
> - headliner_flag: Yes
> - booking_fee: $850,000
>
> Guide me through these steps:
>
> 1. First, identify every piece of redundancy you see — what facts would be repeated if there were multiple rows in this table?
> 2. Is this table in First Normal Form? The `festival_dates` column contains a range — is that atomic? How would you fix it?
> 3. What is a good primary key for this table? Is it a single column or composite?
> 4. Check for Second Normal Form: are there any partial dependencies — non-key columns that depend on only part of the primary key?
> 5. Check for Third Normal Form: are there any transitive dependencies — non-key columns that depend on other non-key columns?
> 6. Draw out the normalized schema: what tables would you end up with, what are their primary keys, and what columns does each one have?
>
> After my final answer, give me the complete normalized schema and explain how it eliminates each of the anomalies we identified.
