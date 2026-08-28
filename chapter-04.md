# Chapter 4: The Relational Model

---

In the first three chapters, we've been building intuition: data is a model of the world, entities become tables, relationships live between tables. You've been thinking relationally without quite having the full theoretical picture behind it.

This chapter fills that in. We're going to look at the formal ideas underneath everything we've been doing — not to make things abstract and academic, but because understanding *why* the relational model works the way it does will make you a much better designer and a much sharper analyst. When you understand the foundations, the rules stop feeling arbitrary and start feeling inevitable.

The good news: the math is elegant, and you don't need much of it. What you need is the intuition behind it.

---

## 4.1 Codd's Insight: Data as Sets

### Why treating data as sets (not sequences) was revolutionary

When Edgar Codd proposed the relational model in 1970, the dominant way of thinking about stored data was as a sequence — a list of records, one after another, in a specific order. To find a record, you'd navigate through the list. To answer a question, you'd write a program that walked through the data step by step.

Codd's insight was to throw out the sequence entirely.

He proposed that data should be thought of as **sets** — unordered collections of items where membership matters, but position doesn't. In a set, it doesn't matter whether Beyoncé's record comes before or after Bad Bunny's record. What matters is that both of them are members of the Artist set.

This sounds like a subtle distinction, but it turned out to be revolutionary for a simple reason: if data is a set, you can describe *what you want* without specifying *how to find it*. Instead of writing a program that navigates through records one by one, you write a query that describes the set of results you want — and the database figures out how to retrieve it.

This is the difference between **declarative** and **procedural** thinking. Procedural: "Go to the first record. Check if it matches. If yes, add it to the results. Go to the next record. Repeat." Declarative: "Give me all artists whose genre is Hip-Hop." The declarative approach is more powerful because it separates *what* from *how* — and it turns out the database is much better at figuring out the "how" than you are.

### Position doesn't matter; membership does

To really feel this, consider what it means for a table.

In a spreadsheet, row order matters — or at least feels like it does. You sort your data, you maintain a specific arrangement, and if someone shuffles the rows, it feels wrong. The spreadsheet is a list, and lists have order.

In a relational table, there is no inherent row order. The 47 songs in an album aren't stored in track order — track order is just another attribute (`track_number`) that you use to *sort* the results when you display them. The underlying data has no sequence.

This can feel uncomfortable at first, but it's actually liberating. Because there's no order to maintain, the database is free to store and retrieve data in whatever way is most efficient. It can use indexes, parallel processing, caching — all the tricks that make databases fast — without worrying about preserving a sequence that nobody asked for.

The practical implication: if order matters to you, ask for it explicitly. Write your queries to sort results the way you want them. Don't assume the database will return things in any particular order unless you specify.

### Operations on sets: union, intersection, difference

Set theory gives us three fundamental operations that turn out to be extremely useful for data:

**Union** combines two sets into one, including everything that appears in either set (without duplicates). In database terms: give me all the artists who played at Lollapalooza, plus all the artists who played at Coachella — with no artist listed twice.

**Intersection** gives you only the items that appear in *both* sets. In database terms: give me all the artists who played at *both* Lollapalooza *and* Coachella.

**Difference** gives you the items that appear in one set but not the other. In database terms: give me all artists who played at Lollapalooza but *not* Coachella.

You don't need to memorize these as formal operations — SQL has built-in ways to express them — but recognizing them helps you understand what queries are doing. When you see a query that says "find me customers who bought product A and also product B," you're looking at an intersection. When a query says "find me all users who haven't logged in since January," you're looking at a difference.

### The mathematical foundations without the math

Codd's relational model was grounded in a branch of mathematics called **relational algebra** and **set theory**. These are rigorous, provable systems — which is one of the reasons the relational model has lasted 50 years while other approaches have come and gone.

You don't need to understand the mathematics to use a relational database. But it's worth knowing that the foundation is there, because it means the model isn't just a convention — it's *correct* in a mathematical sense. When you design a database according to relational principles, you're not just following best practices. You're applying a provably sound framework for organizing and querying data.

The practical benefit of this: when something in your database design feels wrong — when the data is inconsistent, when queries produce unexpected results, when changes to one thing break something else — there's almost always a relational principle being violated. Understanding the model helps you diagnose problems, not just work around them.

### Why this foundation makes the model provably correct

Here's the key implication for your work: because the relational model is based on mathematics, its rules aren't arbitrary. When the model says "every row needs a unique identifier," that's not just a convention — it follows from the definition of a set (sets don't have duplicates). When the model says "foreign keys must reference existing rows," that's not just good practice — it's what it means for a relationship to be valid.

This is why we spend time on the theory before the practice. The theory explains *why* the rules exist, which makes the rules much easier to apply correctly — and much easier to remember.

---

## 4.2 Relations, Tuples, and Attributes

### Precise vocabulary for imprecise ideas

In everyday speech, we say "table," "row," and "column." Those words are fine and we'll keep using them throughout this book. But it's worth knowing the formal terms, because you'll encounter them in the wild — in technical documentation, job interviews, conversations with database professionals — and because the formal terms are more precise.

In relational theory:
- A **relation** is what we've been calling a table.
- A **tuple** is what we've been calling a row.
- An **attribute** is what we've been calling a column.

So the formal description of our Artist table would be: "The Artist relation has four attributes — artist_id, artist_name, genre, and hometown — and currently contains four tuples."

Why bother with the formal terms if we're just going to use "table," "row," and "column" anyway? Two reasons.

First, precision. "Table" in everyday language can mean a lot of things — a dining table, a table in a Word document, a pivot table in Excel. "Relation" means exactly one thing in database theory. When you're in a technical conversation and precision matters, the formal terms eliminate ambiguity.

Second, the formal terms carry theoretical weight. A "relation" isn't just a table — it's a set of tuples, with all the mathematical properties that implies. When you call it a "relation," you're invoking the whole theoretical framework that makes the model work.

### Relation = table, tuple = row, attribute = column

Let's make the mapping concrete:

| Formal Term | Everyday Term | What It Means |
|-------------|---------------|---------------|
| Relation    | Table         | The whole grid: a named set of tuples sharing the same attributes |
| Tuple       | Row           | One instance of the entity: one specific artist, song, or ticket |
| Attribute   | Column        | One property tracked for every tuple: name, genre, duration |
| Domain      | Data type     | The set of valid values an attribute can hold |

One more term from the formal model worth knowing: **degree** is the number of attributes (columns) in a relation, and **cardinality** is the number of tuples (rows). A relation with 5 attributes and 1,000 rows has a degree of 5 and a cardinality of 1,000.

### Why precision in language prevents confusion in design

Here's a real scenario where precise language matters. Imagine two developers are arguing about a database design:

Developer A: "We need a new table for this."
Developer B: "No, we just need a new column in the existing table."

Without shared, precise vocabulary, this debate goes in circles. With it, the argument becomes more tractable: "The Artist-Genre relationship is many-to-many, so it needs its own relation — we can't represent it with just an attribute in the Artist relation." Now both people are working from the same framework.

Shared vocabulary is infrastructure for collaboration. When everyone on a team uses the same terms in the same way, design conversations move faster, misunderstandings happen less often, and documentation is clearer.

### Why terminology matters when communicating across teams

In a business context, database professionals often work with people who have different technical backgrounds. A database administrator talks to application developers, business analysts, data scientists, and managers — all of whom may have different vocabularies for the same concepts.

Being fluent in the formal vocabulary — even if you use the casual terms in conversation — signals that you understand the underlying model, not just the surface mechanics. When you tell a senior developer that "the enrollment entity resolves the many-to-many relationship between students and courses," you sound like someone who understands what they're doing. When you say "I made a table in the middle," you sound like you're guessing.

That kind of fluency opens doors. It's the difference between being someone who uses a database and someone who designs one.

---

## 4.3 Keys and Uniqueness

### The role of uniqueness in guaranteeing data integrity

Here is one of the fundamental rules of the relational model: **no two tuples in a relation can be identical in every attribute.**

Think about why this has to be true. A relation is a set, and sets don't have duplicates. If two rows were identical in every way, they'd be the same row — the same member of the set — and having them both would be a contradiction.

More practically: if two rows are identical, which one do you update when something changes? Which one do you delete? How do you reference one without referencing both? You can't. Duplicate rows make the data meaningless.

The solution is to ensure that every row has at least one attribute — or combination of attributes — that is unique across the entire table. This is the concept of a **key**.

### Candidate keys, primary keys, and surrogate keys

A **candidate key** is any attribute or combination of attributes that could uniquely identify a row. A relation can have multiple candidate keys.

For example, in a User table for a music app, both `user_id` (a system-generated number) and `email_address` could uniquely identify a user. Either one is a candidate key.

The **primary key** is the candidate key you choose to use as the official identifier for a row. It's the key that other tables will reference with foreign keys, and it's the key the database optimizes for lookups. In practice, you choose the primary key that is most stable and most practical.

From the candidate keys above, you'd probably choose `user_id` as the primary key, because email addresses can change (people switch email providers), while a system-generated ID never changes.

**Surrogate keys** vs. **natural keys** is one of the most common design decisions you'll make.

A **natural key** is an identifier that has real-world meaning. An ISBN uniquely identifies a book. A Social Security Number uniquely identifies a US citizen. An email address uniquely identifies a user account. Natural keys are appealing because they carry meaning — you don't need to look anything up to understand what they refer to.

A **surrogate key** is a system-generated identifier with no real-world meaning — just a unique number assigned by the database. `artist_id = 1`, `artist_id = 2`, `artist_id = 3`. The number means nothing outside the database; it just ensures uniqueness.

### Natural keys: meaningful but fragile

Natural keys seem like a good idea until real life intervenes.

What if a book goes out of print and its ISBN gets reused? (It happens.) What if a person changes their Social Security Number? (Rare, but it happens — for witness protection, among other reasons.) What if a user changes their email address? (This happens all the time.) What if a song title isn't unique — two songs are both called "Sorry"?

When any of these things happen, a natural key stops being a reliable identifier. And because foreign keys in other tables reference this key, a change cascades — every table that referenced the old value has to be updated.

Natural keys are also often long and awkward to work with as foreign keys. An ISBN is 13 digits. A Social Security Number is 9 digits with dashes. Using them as foreign keys in other tables means every related row has to store that entire string. A surrogate key like an integer is much more compact.

### Surrogate keys: stable but opaque

Surrogate keys have the opposite profile: extremely stable (they never change, because they have no real-world meaning that could change), compact (typically small integers), and completely opaque (the number 4,712 tells you nothing about what it represents).

The opacity is the trade-off. When you see `artist_id = 4712` in a Song row, you have no idea who that artist is without looking it up. With a natural key like `artist_name = "Kendrick Lamar"`, it's obvious.

In practice, most database designers use surrogate keys as primary keys and store natural identifiers as additional attributes. The `User` table gets a surrogate `user_id` as its primary key, but also stores `email_address` (with a UNIQUE constraint) as the natural identifier that users and the application use.

This gives you the best of both worlds: internal stability from the surrogate key, and human-readable identity from the natural key.

### No two rows can be identical in a true relation

Let's be clear about what the primary key requirement actually enforces. It's not just that the primary key column must be unique — it's that **no two rows can be identical in every attribute.** The primary key is the mechanism that enforces this.

If you try to insert a second row with the same primary key value as an existing row, the database rejects it. This rejection isn't the database being difficult — it's the database enforcing the mathematical definition of a relation as a set.

As a designer, your job is to choose primary keys wisely: values that are truly unique, stable over time, and as compact as practical.

### How the primary key enforces this guarantee

When you declare a primary key on a table, the database does several things automatically:

1. It creates an **index** on the primary key column, making lookups by that column extremely fast.
2. It enforces **uniqueness** — no two rows can have the same primary key value.
3. It enforces **non-nullability** — the primary key can never be empty (more on this in section 4.4).

These three guarantees together mean that every row in the table has a reliable, unique, never-empty identifier. That identifier is what makes it possible for other tables to reference rows via foreign keys. Without it, the whole structure of the relational model would fall apart.

---

## 4.4 Integrity Rules

The relational model comes with three integrity rules — constraints that must hold for a database to be considered well-formed. Understanding these rules is what separates someone who can put data into a database from someone who can design a database that can be trusted.

### Entity integrity: no null primary keys

The first rule is **entity integrity**: the primary key of any row can never be null.

A null value in a database means "unknown" or "not applicable." It's the database's way of representing the absence of a value. Nulls are sometimes necessary — you might not know a customer's phone number, or an event's end time might not be set yet. But a null primary key is never acceptable.

Here's why. The primary key is a row's identity. If a row's identity is unknown, the row itself is meaningless. You can't reference it with a foreign key. You can't uniquely identify it. You can't tell it apart from other rows. A row without an identity isn't a record of a real thing — it's a phantom.

Think about it in real-world terms. Imagine a ticket sold to a customer whose identity is completely unknown — not just their name, but every identifier that could distinguish them. That ticket can't be validated, refunded, or transferred. It's a record of nothing.

Entity integrity ensures that every row in every table represents something real and identifiable. It's the baseline of trustworthy data.

### Why a row without an identity is meaningless

There's a deeper point here about what a database is for. A database is supposed to be a model of the real world. Every row represents a real thing — a real customer, a real song, a real ticket. A row with a null primary key doesn't represent anything real. It's noise.

Allowing null primary keys is like allowing a row to say "I exist, but I don't know what I am." That's not a record — it's a mistake waiting to cause problems. Entity integrity prevents it from ever entering the database.

### Practical implications for data entry and import

In practice, entity integrity affects how data gets into the database in two common ways.

First, **auto-increment primary keys**: most databases can automatically generate a unique primary key value for each new row. When you insert a new artist, you don't provide an `artist_id` — the database creates one for you, guaranteeing it's unique and never null. This is the most common approach and eliminates an entire class of errors.

Second, **data imports**: when you're loading data from an external source — a spreadsheet, a legacy system, a partner's data file — entity integrity requires that every row have a valid identifier before it can enter the database. If the source data has rows without identifiers, you have to resolve that before import. This often reveals data quality problems that were invisible in the original system.

### Referential integrity: foreign keys must point somewhere real

The second rule is **referential integrity**, which we introduced in Chapter 3. Foreign keys must reference rows that actually exist in the referenced table.

This rule is what makes the web of relationships in a database trustworthy. If the Song table says a song was recorded by `artist_id = 42`, referential integrity guarantees that artist 42 actually exists in the Artist table. Without this guarantee, foreign keys are just numbers — they might point to something real, or they might point to nothing. You'd have no way of knowing without checking every time.

### Orphaned records and the problems they cause

When referential integrity is violated, you get **orphaned records** — rows whose foreign keys point to rows that no longer exist.

Imagine you delete an artist from the Artist table without first handling their songs. Now the Song table has rows with `artist_id = 42`, but artist 42 no longer exists. Those songs are orphaned. They're in the database, but they can't be fully displayed (you'd have no artist name to show), can't be filtered by artist, and can't be reasoned about correctly.

Orphaned records corrupt analysis. If you're calculating the most popular artists by stream count, orphaned songs contribute streams to a ghost — inflating some totals and depressing others. The database looks fine on the surface but produces wrong answers.

### How the database enforces this automatically

A properly configured database enforces referential integrity without you having to check manually. If you try to insert a song that references `artist_id = 999` and no such artist exists, the database raises an error and refuses the insert. If you try to delete an artist who still has songs, the database raises an error and refuses the delete.

This is the database acting as a guardian. No matter how buggy the application code is, no matter how confused the data entry person is, the database will not allow referential integrity to be violated. The rules are enforced at the lowest level.

There are options for what happens when a referenced row is deleted — the database can cascade the deletion (also delete the songs), set the foreign key to null, or simply refuse. Choosing the right behavior is a design decision, but the key point is that the behavior is always defined and enforced. Nothing happens silently.

### Domain integrity: values must be valid

The third rule is **domain integrity**: the value in any cell must be a valid member of that attribute's domain.

Every attribute has a **domain** — the set of values it's allowed to contain. The domain of a `duration_seconds` column might be "positive integers." The domain of a `release_date` column might be "valid calendar dates from 1900 to the present." The domain of an `explicit_flag` column might be just two values: true or false.

Domain integrity means the database enforces these restrictions. You can't store "two minutes and thirty seconds" in a duration column that expects an integer. You can't store "February 31" in a date column. You can't store "maybe" in a boolean column.

### Data types, constraints, and allowed ranges

Domain integrity is implemented through several mechanisms.

**Data types** are the most basic: every column has a type — integer, text, date, decimal, boolean — and the database won't accept values that don't match. Try storing a word in an integer column and the database will reject it.

**NOT NULL constraints** prevent a column from being empty when a value is required. If the `artist_name` column has a NOT NULL constraint, you can't insert an artist without a name.

**CHECK constraints** let you specify custom rules. You can require that `ticket_price` is greater than zero, that `rating` is between 1 and 5, or that `event_date` is in the future at the time of insertion.

**UNIQUE constraints** ensure that a column's values are distinct across all rows. The `email_address` column might have a UNIQUE constraint to ensure no two users share an email.

### The database as the last line of defense against bad data

Here's the key philosophy behind domain integrity: **don't trust the application to keep the data clean.** Applications have bugs. Users make mistakes. Systems get integrated in unexpected ways. Data gets imported from external sources with different standards. A validation rule that lives only in the application layer can be bypassed — through a different application, through a direct database import, through a bug that gets introduced two years from now.

A constraint in the database, by contrast, cannot be bypassed. It applies to every row, from every source, forever.

This doesn't mean you shouldn't validate data in your application. You should — for user experience if nothing else. But application-level validation and database-level constraints serve different purposes. Application validation gives users helpful feedback. Database constraints guarantee that invalid data never enters the system, no matter what.

The database is the last line of defense. Design it accordingly.

---

## Chapter Summary

The relational model, introduced by Edgar Codd in 1970, is grounded in set theory. Tables are sets of rows; sets are unordered and have no duplicates. This set-based foundation is what makes SQL declarative — you describe the data you want, and the database figures out how to retrieve it.

The formal vocabulary maps directly to the casual terms: relation = table, tuple = row, attribute = column. Knowing both vocabularies — and when to use each — is part of being fluent in database design.

Keys enforce uniqueness. Every row needs a primary key: a unique, non-null identifier. Natural keys carry meaning but can change; surrogate keys are stable but opaque. Most designs use surrogate keys internally and store natural identifiers as constrained attributes.

The relational model has three integrity rules. Entity integrity: no primary key can be null, because a row without an identity is meaningless. Referential integrity: every foreign key must reference a row that actually exists, preventing orphaned records. Domain integrity: every value must be valid for its attribute's domain, enforced through data types, constraints, and rules.

These rules aren't arbitrary. They follow from the mathematics of the model, and they're what makes a relational database trustworthy. A database that violates them isn't just poorly designed — it's not truly relational.

---

## Key Terms

**Set** — An unordered collection of distinct items. The mathematical foundation of the relational model.

**Declarative query** — A query that describes *what* data you want without specifying *how* to retrieve it. SQL is a declarative language.

**Relation** — The formal term for a table in the relational model. A set of tuples sharing the same attributes.

**Tuple** — The formal term for a row. One instance of an entity in a relation.

**Degree** — The number of attributes (columns) in a relation.

**Cardinality** — The number of tuples (rows) in a relation.

**Candidate key** — Any attribute or combination of attributes that could uniquely identify a tuple in a relation.

**Primary key** — The candidate key chosen as the official identifier for rows in a table. Must be unique and never null.

**Natural key** — A primary key made from a real-world identifier (e.g., ISBN, email address). Meaningful but potentially unstable.

**Surrogate key** — A system-generated primary key with no real-world meaning. Stable and compact.

**Domain** — The set of valid values an attribute can hold. Enforced through data types and constraints.

**Entity integrity** — The rule that no primary key value can be null.

**Referential integrity** — The rule that every foreign key value must correspond to an existing primary key in the referenced table.

**Domain integrity** — The rule that every value in a table must be a valid member of its attribute's domain.

**Null** — A special marker meaning "unknown" or "not applicable." Not the same as zero or an empty string.

---

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

---

### Activity 4.1 — Concept Check: The Relational Model

*This activity checks your understanding of the key ideas from Chapter 4 — set theory, formal vocabulary, keys, and integrity rules. The AI will quiz you one question at a time, give feedback, and help fill in any gaps.*

---

**Copy and paste this prompt into your AI tool:**

> I've just finished reading Chapter 4 of my Introduction to Databases textbook, which covered the relational model — including set theory, the formal vocabulary of relations and tuples, types of keys, and the three integrity rules. I want to check my understanding. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and explain it more clearly if needed. Then ask if I'd like to go deeper before moving to the next question.
>
> Here are the questions:
>
> - What does it mean to say a relational table is a "set" of rows, and why does that matter?
> - What is the difference between a declarative query and a procedural one? Why is declarative better for working with data?
> - What are the formal terms for a table, a row, and a column in relational theory? What is "degree" and what is "cardinality"?
> - What is a candidate key? What makes it different from a primary key?
> - What is the difference between a natural key and a surrogate key? When would you prefer each one?
> - What is entity integrity, and why does it matter?
> - What is referential integrity? What is an orphaned record, and how does referential integrity prevent it?
> - What is domain integrity? Give two examples of how a database can enforce it.
> - The chapter says the database should be "the last line of defense against bad data." What does that mean, and why isn't application-level validation enough on its own?

---

### Activity 4.2 — Apply It: Designing Keys and Constraints for a Real System

*This activity asks you to apply key selection and integrity rules to a realistic database design problem. The AI will guide you through the decisions step by step.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying the relational model in my Introduction to Databases class. I just learned about primary keys, natural vs. surrogate keys, and the three integrity rules — entity integrity, referential integrity, and domain integrity. I want to practice applying these ideas to a real system.
>
> I'm going to name a type of system or app, and you'll guide me through designing its keys and constraints. Ask me one question at a time and wait for my answer before continuing. After each answer, give me feedback — tell me what's correct, what I might be missing, and help me think more carefully.
>
> 1. What system do you want to design for? (Examples: a university course registration system, a music streaming service, a concert ticketing platform, a food delivery app, a gym membership tracker.)
> 2. What are the three or four main tables this system would need?
> 3. For each table, what would be a candidate natural key? Is it truly unique and stable, or could it change or repeat?
> 4. For each table, would you use the natural key or a surrogate key as the primary key? Explain your reasoning.
> 5. Which tables have foreign keys? For each foreign key, describe what it references and what referential integrity rule would apply.
> 6. For one of your tables, describe at least three domain integrity constraints you'd want to enforce — what rules should the data follow, and how would you enforce them?
>
> After I've answered all the questions, summarize the key decisions I made and flag any trade-offs or risks in my design.

---

### Activity 4.3 — Practice: Natural Key or Surrogate Key?

*This activity gives you practice making the natural vs. surrogate key decision — one of the most common judgment calls in database design.*

---

**Copy and paste this prompt into your AI tool:**

> I'm learning about database keys in my Introduction to Databases class. I want to practice deciding whether to use a natural key or a surrogate key as the primary key for different tables.
>
> My textbook says natural keys carry real-world meaning but can be unstable or non-unique over time, while surrogate keys are stable and compact but opaque. The usual approach is to use a surrogate key as the primary key and store the natural identifier as a separate column with a UNIQUE constraint.
>
> Please present the following scenarios to me one at a time. For each one, ask me: (a) What would the natural key be? (b) Is it truly unique and stable, or could it change or cause problems? (c) Would you use it as the primary key, or would you use a surrogate key instead — and why?
>
> Wait for my answer each time. Tell me if I'm right, correct me if I'm off, and explain the reasoning. Ask if I want to discuss further before moving on.
>
> Here are the scenarios:
>
> 1. A table of US students, where you're considering using their Social Security Number as the primary key
> 2. A table of songs, where you're considering using the song title as the primary key
> 3. A table of countries, where you're considering using the two-letter country code (US, FR, JP) as the primary key
> 4. A table of employees, where you're considering using their work email address as the primary key
> 5. A table of concerts, where you're considering using a combination of artist name + venue name + date as the primary key
> 6. A table of airline flights, where you're considering using the flight number (e.g., UA 2847) as the primary key
> 7. A table of books, where you're considering using the ISBN as the primary key
>
> After we've gone through all of them, ask me to come up with one more scenario myself — a table where the natural key choice is genuinely tricky — and walk me through it.

---

### Activity 4.4 — Case Study: Finding Integrity Violations

*This activity puts you in the role of a database auditor who has discovered a poorly maintained database. The AI plays the role of your supervisor, guiding you through identifying and fixing integrity violations.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying database integrity rules in my Introduction to Databases class. I want to work through a realistic scenario about entity integrity, referential integrity, and domain integrity.
>
> Please play the role of my supervisor at a music streaming company. I'm a junior database analyst and I've been asked to audit our database because we've been getting strange errors in our app. You're going to describe what I find in the database, and I need to identify what integrity rule is being violated and how to fix it. Ask me one scenario at a time and wait for my answer. Respond as my supervisor — tell me if I diagnosed it correctly, explain anything I missed, and share how serious each problem is.
>
> Here are the problems I've discovered in the database:
>
> 1. The Songs table has 14 rows where the `artist_id` column is NULL. These songs are showing up in searches but have no artist listed.
> 2. The Playlists table has rows where `created_by_user_id` = 8842, but when we look at the Users table, user ID 8842 doesn't exist — it was deleted months ago.
> 3. The Songs table has a `duration_seconds` column that contains several values like "3:47" and "four minutes" instead of a number.
> 4. The Users table has two rows with the same `user_id` value (ID 10031). Both rows have different email addresses and different names.
> 5. The Streams table records each time a user plays a song. Several rows have `play_timestamp` values of "yesterday" or "last week" instead of a proper date and time.
> 6. The Artists table has an `artist_id` column that is supposed to be the primary key, but three rows have NULL in that column.
>
> For each problem: (a) Which integrity rule is being violated — entity integrity, referential integrity, or domain integrity? (b) How did this probably happen? (c) What's the risk if we leave it unfixed? (d) How would you fix it?
>
> After we've gone through all six problems, give me a summary of the overall health of this database and your top recommendation for preventing these issues in the future.
