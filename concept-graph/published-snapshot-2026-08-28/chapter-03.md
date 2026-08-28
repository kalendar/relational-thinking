[Skip to content](https://pressbooks.marshall.edu/mis340/chapter/relationships-how-things-connect/#content)

- **Explain** why relationships belong between tables rather than embedded within one, and **identify** the redundancy, nulls, and structural distortion that result when they aren’t.
- **Classify** a relationship between two entities as one-to-many, many-to-many, or one-to-one, and **justify** the classification by testing both directions (“can one A have many Bs, and can one B have many As?”).
- **Model** a many-to-many relationship using a junction table, and **explain** what such a table represents and what additional data it can carry.
- **Apply** the concept of a foreign key as a pointer (not a copy) to explain referential integrity, and **locate** relationships in a plain-language business description by identifying its verbs.

* * *

Think about what happens when you buy a ticket to a concert on Ticketmaster. You have an account on Ticketmaster. The concert has a venue. The venue is in a city. The ticket has a price. The price depends on the section. The section is in the venue.

Every one of those connections is a relationship. And the most important thing to understand about relationships in a database is this: **they don’t live inside a table. They live between tables.**

In Chapter 2, we learned how to identify entities and give them tables. In this chapter, we learn how to connect those tables to each other – which is where the real power of relational databases comes from.

* * *

## 3.1 Why Relationships Belong Between Tables

### The danger of embedding relationships inside a single table

Let’s start with the temptation that trips up almost every beginner: trying to put everything in one table.

Imagine you’re building a database to track which artists are performing at your festival. You have artists and you have stages. The easy thing is to just add a `stage` column to your `Artist` table:

| artist\_id | artist\_name | genre | stage |
| --- | --- | --- | --- |
| 1 | Kendrick Lamar | Hip-Hop | Main Stage |
| 2 | Billie Eilish | Alt-Pop | Sunset Stage |
| 3 | Bad Bunny | Reggaeton | Main Stage |

This looks fine. But now you need to track information about the stages themselves — their capacity, their sound system specs, their location on the festival grounds. Where do you put that?

You could add more columns: `stage_capacity`, `stage_location`, `stage_sound_system`. Now your `Artist` table looks like this:

| artist\_id | artist\_name | genre | stage | stage\_capacity | stage\_location | stage\_sound\_system |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Kendrick Lamar | Hip-Hop | Main Stage | 50,000 | North Field | Tier 1 |
| 2 | Billie Eilish | Alt-Pop | Sunset Stage | 20,000 | West Field | Tier 2 |
| 3 | Bad Bunny | Reggaeton | Main Stage | 50,000 | North Field | Tier 1 |

See the problem? The stage capacity, location, and sound system information for the Main Stage is repeated in rows 1 and 3. If the Main Stage capacity changes, you have to update multiple rows — and if you miss one, your data is inconsistent. This is exactly the kind of dangerous redundancy that Chapter 5 will cover in depth under normalization.

The fix is obvious once you see it: stages should have their own table. The relationship between artists and stages belongs _between_ the tables, not inside one of them.

### Repeating groups, nulls, and structural distortion

Embedding relationships inside a single table tends to produce three specific symptoms.

**Repeating data** is what we just saw – the same stage information appearing on every artist row that plays that stage. Every repeated fact is a maintenance risk and a potential source of inconsistency.

**Nulls** appear when you try to cram in information that doesn’t apply to every row. Imagine adding a `headliner_bonus` column to the Artist table – a special payment only headliners receive. For non-headliners, that column would be empty (null). A table full of nulls is a sign that you’re trying to make one table do the work of several.

**Structural distortion** is subtler. When you force a relationship into a single table, the table stops accurately representing what it’s supposed to be about. An `Artist` table that contains stage information isn’t really about artists anymore — it’s a confused mashup. The structure of the table should match the entity it represents.

### Each table models one thing well

The discipline of relational design is about **keeping things separate and clean**. Each table has one job: model one entity, and model it well. The connections between entities are handled by relationships – not by cramming one entity’s data into another entity’s table.

This separation creates a system that’s easier to maintain, easier to query, and easier to extend. When stage information is in its own table, you can update a stage’s capacity in one place and it’s immediately correct everywhere. When stage information is scattered across the artist table, you’re one missed update away from incorrect data.

### Relationships are first-class citizens, not afterthoughts

Here’s a mindset shift that takes some getting used to: in a relational database, the _relationship between things_ is just as important as the things themselves. Relationships aren’t just connective tissue — they’re often where the most interesting data lives.

When a customer places an order, the relationship between the customer and the products they ordered carries data: how many of each item, at what price, on what date, with what shipping method. That relationship isn’t an afterthought — it’s the core of what an e-commerce system needs to track.

We’ll see this concretely when we get to many-to-many relationships. For now, the key idea is: relationships deserve deliberate design, just like entities do.

* * *

## 3.2 Types of Relationships

There are three fundamental types of relationships in a relational database. Learning to identify them is one of the most important skills in database design.

### One-to-many: the most common relationship in business data

A **one-to-many** relationship means that one instance of entity A can be associated with many instances of entity B, but each instance of entity B is associated with only one instance of entity A.

Examples:

– One **artist** can record many **songs**, but (ignoring collabs for the moment **) each** song belongs to one artist.

– One **customer** can place many **orders**, but each order belongs to one customer.

– One **venue** can host many **events**, but each event happens at one venue.

– One **stage** can contain many **speakers**, but each speaker is on only one stage.

The one-to-many relationship is the most common relationship in business databases. Most of the time, when you think “this entity is connected to that entity,” it’s a one-to-many.

Let’s look at the Artist/Song relationship. An artist can have many songs. Each song belongs to one artist. So the `Song` table gets a column – `artist_id` – that points back to the `Artist` table.

**Artist table:**

| artist\_id | artist\_name | genre |
| --- | --- | --- |
| 1 | Olivia Rodrigo | Pop |
| 2 | SZA | R&B |

**Song table:**

| song\_id | song\_title | artist\_id | duration\_sec |
| --- | --- | --- | --- |
| 101 | vampire | 1 | 219 |
| 102 | good 4 u | 1 | 178 |
| 103 | Kill Bill | 2 | 154 |
| 104 | Snooze | 2 | 201 |

The `artist_id` column in the `Song` table is a **foreign key** — it references the `artist_id` in the `Artist` table. It’s how the database knows that “vampire” and “good 4 u” both belong to Olivia Rodrigo. We’ll say more about foreign keys below, but for now remember: a foreign key lives on the “many” side of the relationship.

Notice what this design achieves: Olivia Rodrigo’s name appears once, in the Artist table. If her name is spelled incorrectly, you fix it in one place. Her songs can number in the hundreds and the Artist table doesn’t grow at all — only the Song table grows.

### Examples: customers to orders, departments to employees

The one-to-many pattern shows up constantly across business domains:

- A **department** has many **employees**, but each employee belongs to one department.
- A **professor** teaches many **courses**, but each course (in a simple model) has one professor.
- An **album** contains many **songs**, but each song belongs to one album.
- A **streaming platform** has many **users**, but each user account belongs to one person.

Whenever you’re unsure whether a relationship is one-to-many, ask: “Can one \[A\] have multiple \[B\]s? And can one \[B\] belong to multiple \[A\]s?” If the first answer is yes and the second is no, it’s one-to-many.

### Many-to-many: why a third table is usually the answer

A **many-to-many** relationship means that one instance of entity A can be associated with many instances of entity B, _and_ one instance of entity B can be associated with many instances of entity A.

Examples:

– A **student** can enroll in many **courses**, and each course can have many students.

– A **song** can appear on many **playlists**, and each playlist can contain many songs.

– An **actor** can appear in many **movies**, and each movie can have many actors.

– A **product** can be part of many **orders**, and each order can contain many products.

Many-to-many relationships cannot be represented directly with a foreign key on one of the two tables. Think about it: if a song can be on many playlists, where do you put the foreign key? You can’t put a `playlist_id` on the Song table because one song belongs to many playlists — one column can only hold one value.

The solution is a **junction table** (also called a bridge table or associative table). The junction table sits between the two entities and has a row for each pairing.

For the Song/Playlist relationship:

**Song table:**

| song\_id | song\_title | artist\_id |
| --- | --- | --- |
| 101 | Espresso | 5 |
| 102 | Cruel Summer | 6 |
| 103 | Flowers | 7 |

**Playlist table:**

| playlist\_id | playlist\_name | owner\_user\_id |
| --- | --- | --- |
| 201 | Morning Commute | 1001 |
| 202 | Study Session | 1001 |
| 203 | Gym Hits | 1002 |

**PlaylistSong table (junction):**

| playlist\_id | song\_id |
| --- | --- |
| 201 | 101 |
| 201 | 102 |
| 202 | 102 |
| 202 | 103 |
| 203 | 101 |
| 203 | 103 |

Now the “Morning Commute” playlist contains “Espresso” and “Cruel Summer.” The “Study Session” playlist contains “Cruel Summer” and “Flowers.” “Espresso” appears on both “Morning Commute” and “Gym Hits.” Every combination is represented cleanly, without any repeating or cramming.

The junction table has one row per relationship — one row for each song-on-a-playlist pairing. That’s its grain. And it works because each row only has to capture one pairing, not multiple.

### The junction table: what it is and what it can carry

The junction table isn’t just a connector — it can hold data about the relationship itself.

Think about the relationship between a Student and a Course. The enrollment isn’t just “this student is in this course” — it also has a semester, a grade, and an enrollment status (active, dropped, waitlisted). That data belongs on the enrollment — not on the student, not on the course, but on the relationship between them.

**Enrollment table (junction with data):**

| student\_id | course\_id | semester | grade | status |
| --- | --- | --- | --- | --- |
| 5001 | MKTG101 | Spring 2026 | A | Active |
| 5001 | MIS310 | Spring 2026 | B+ | Active |
| 5002 | MKTG101 | Spring 2026 | NULL | Active |
| 5003 | MIS310 | Fall 2025 | C | Active |

When a junction table carries meaningful data like this, it often starts to look like an entity in its own right. An “Enrollment” is a thing — it has its own attributes, its own life cycle. This is a common pattern: what starts as a simple junction table evolves into a full entity as the system’s needs grow.

### One-to-one: rare, but worth knowing

A **one-to-one** relationship means that one instance of entity A is associated with exactly one instance of entity B, and vice versa.

This is uncommon. If a one-to-one relationship exists, you might wonder: why are these two separate tables at all? Why not just combine them?

Usually the answer is one of two things.

**Security partitioning:** You want to keep sensitive data separate from general data. A `User` table might have username and email. A separate `UserCredentials` table has the password hash and two-factor authentication details. By separating them, you can give some parts of your system access to general user data without giving them access to authentication data.

**Optional extension:** One entity sometimes has additional data, and sometimes doesn’t. A `User` table might have a corresponding `UserProfile` row — but only for users who’ve completed their profile. Rather than adding a dozen nullable columns to the User table for profile information, you create a separate table that only has a row when the profile exists.

One-to-one is worth knowing, but if you find yourself reaching for it, ask first: should these really be one table? Often the answer is yes.

### When one-to-one appears and why it’s often a design smell

If you see a one-to-one relationship in a database design, it’s worth questioning. Here are the common cases:

- It’s really a one-to-many in disguise (maybe the relationship can have multiple instances over time)
- The two entities should be merged into one table (over-normalization)
- There’s a legitimate security or extension reason to keep them separate

The rule of thumb: don’t create a one-to-one relationship unless you have a clear reason. Merging the tables is usually simpler and easier to work with.

* * *

## 3.3 The Foreign Key as a Concept

### How one table references another

We’ve used the term “foreign key” a few times now. Let’s be precise about what it is.

A **foreign key** is a column in one table that contains values matching the primary key of another table. It’s how one row “points to” a row in a different table.

In the Song/Artist example:

– The `Artist` table has a primary key: `artist_id`

– The `Song` table has a foreign key: `artist_id` (same column name, but it lives in the Song table)

– The `artist_id` value in any Song row must match an `artist_id` value that actually exists in the Artist table

The foreign key is a pointer. It doesn’t copy the artist’s information into the Song table — it just records which artist that song belongs to. When you want the artist’s name, you follow the pointer from Song to Artist and look it up there.

This is the mechanism that makes the relational model work. Instead of duplicating data across tables, you store each piece of data once and connect tables through keys.

### The foreign key as a pointer, not a copy

This distinction — pointer vs. copy — is fundamental to understanding why relational databases are designed the way they are.

In a spreadsheet, if you want to show the artist name next to each song, you’d copy the artist name into the song row. This is what “Artist Name” columns in flat files do. The problem is that now the artist’s name exists in two places. If the artist changes their name (it happens — see: “The Artist Formerly Known as Prince”), you have to update every song row. Miss one, and your data is wrong.

In a relational database, the artist’s name lives in exactly one place: the Artist table. Every song that references that artist uses the same `artist_id`. When the artist’s name changes, you update one row, and the change is immediately reflected everywhere. That’s the power of the pointer.

### What “referencing” means at the data level

When we say the Song table “references” the Artist table, we mean something very specific: the value in `Song.artist_id` must correspond to a value in `Artist.artist_id`.

This isn’t just a design convention — a properly configured database _enforces_ it. If you try to insert a song with `artist_id = 999` and there is no artist with ID 999, the database refuses. The song cannot exist in the system without a valid artist.

This enforcement is called **referential integrity**, and it’s one of the most valuable features of a relational database. It means you can trust that every foreign key actually points to something real.

### What referential integrity means in plain English

Referential integrity is a simple idea: you can’t reference something that doesn’t exist.

Think about what would happen without it. You delete an artist from the Artist table. But there are 47 songs in the Song table that still have that artist’s `artist_id`. Those songs now point to an artist that doesn’t exist. They’re **orphaned records** — data that references nothing, data you can’t trust.

Referential integrity prevents this. The database won’t let you delete an artist who still has songs. You have to deal with those songs first — either delete them, reassign them to another artist, or handle them in some other way. The database forces you to maintain consistency.

In a well-designed database, every foreign key is guaranteed to point to a real row. That’s a guarantee you can build on.

### The database as enforcer of real-world constraints

This is worth pausing on, because it’s one of the most powerful ideas in this course.

The real world has rules. An order can’t exist without a customer. A ticket can’t exist without an event. A song can’t be on a playlist if the song doesn’t exist. A student can’t be enrolled in a course if the course isn’t offered.

A database can enforce these rules automatically. You don’t have to write application code that checks “does this customer exist before I create the order?” — the database checks it for you, every time, without fail.

This is why database design is about more than just organizing data. It’s about encoding the rules of a business into a structure that enforces them. When a constraint lives in the database, no application — no matter how buggy, no matter who wrote it — can violate it.

* * *

## 3.4 Recognizing Relationships in the Wild

### Reading a business process and spotting its relationships

Real-world relationships don’t come labeled. You have to find them by reading carefully and asking the right questions.

The most reliable technique is to look for **verbs**. In any description of a business process, the nouns are your entities and the verbs are your relationships.

“A **customer** _places_ an **order** that _contains_ one or more **products**. Each order is _assigned_ to a **shipping address**. When the order is ready, it is _packed_ by a **warehouse employee** and _shipped_ via a **carrier**.”

Entities: Customer, Order, Product, Shipping Address, Warehouse Employee, Carrier.

Relationships: places (Customer → Order), contains (Order → Product), assigned to (Order → Shipping Address), packed by (Order → Warehouse Employee), shipped via (Order → Carrier).

Each verb becomes a relationship to model. Some of them will be one-to-many, some will be many-to-many, and the design work is figuring out which is which.

### Verbs as relationships: “creates,” “contains,” “assigned to”

Let’s practice this. Here’s a description of how a music streaming service works:

“A **user** _creates_ **playlists**. A **playlist** _contains_ **songs**. **Songs** are _recorded by_ **artists**. **Artists** _belong to_ **record labels**. **Users** _follow_ other **users** and also _follow_ **artists**.”

Let’s map the relationships:

– User _creates_ Playlist → one-to-many (one user, many playlists)

– Playlist _contains_ Song → many-to-many (one playlist has many songs; one song is on many playlists) → needs junction table

– Song _recorded by_ Artist → many-to-many (a song can have multiple artists; an artist records many songs) → needs junction table

– Artist _belongs to_ Record Label → many-to-many (an artist can have deals with multiple labels; a label signs many artists) → needs junction table

– User _follows_ User → this is a self-referencing many-to-many (one user follows many users; one user is followed by many users) → needs a junction table that references the User table twice

– User _follows_ Artist → many-to-many → needs junction table

From one paragraph of plain English, we’ve identified six relationships and figured out what type each one is. That’s the skill this chapter is building.

### Distinguishing relationships from attributes

One question that comes up constantly in data modeling: is this thing a relationship or an attribute?

For example: should `genre` be an attribute of the `Artist` entity (a column in the Artist table), or should it be a separate `Genre` entity with its own table?

The answer depends on how the system uses genre. If genre is just a label — you display it, but you don’t need to track anything about it beyond the name — it can be an attribute (a column). But if the system needs to manage genres separately — if genres have descriptions, parent categories, or if you want to ensure consistency across all artists — then genre should be its own entity with a relationship to Artist.

A useful rule of thumb: **if you’d ever want to store additional information about it, or if you need to ensure consistency across many rows, make it an entity.** If it’s just a label that describes something and doesn’t need to be managed separately, it can stay as an attribute.

### Practice: mapping relationships in familiar domains

Let’s try three quick domain sketches to build the muscle.

**Domain 1: Netflix**

Entities: User, Profile (Netflix accounts can have multiple profiles), Show, Episode, Genre, Actor.

Key relationships:

– User has many Profiles (one-to-many)

– Show has many Episodes (one-to-many)

– Show belongs to many Genres; Genre applies to many Shows (many-to-many)

– Actor appears in many Shows; Show has many Actors (many-to-many)

– Profile watches many Episodes; Episode is watched by many Profiles (many-to-many — with a junction that carries watch progress and timestamp)

**Domain 2: College course registration**

Entities: Student, Course, Professor, Department, Room.

Key relationships:

– Department offers many Courses (one-to-many)

– Professor teaches many Courses; Course can be taught by one Professor in a given semester (many-to-many across semesters, one-to-many within a semester)

– Student enrolls in many Courses; Course has many Students (many-to-many — the Enrollment junction table)

– Course is scheduled in a Room (one-to-many if a course meets in the same room all semester)

**Domain 3: Concert ticketing**

Entities: Customer, Ticket, Event, Artist, Venue, Section.

Key relationships:

– Venue has many Sections (one-to-many)

– Event happens at one Venue (many-to-one from Event to Venue)

– Event features many Artists; Artist performs at many Events (many-to-many)

– Ticket is for one Event, in one Section (many-to-one from Ticket to Event, many-to-one from Ticket to Section)

– Customer purchases many Tickets (one-to-many)

Notice how each domain has the same structural patterns — one-to-many and many-to-many — showing up in different forms. Once you can recognize these patterns, you can model almost any business domain.

### What changes across domains — and what stays the same

The entities change. The specific verbs change. The content of the data changes. But the patterns don’t.

One-to-many and many-to-many show up everywhere. The use of foreign keys to connect tables shows up everywhere. The junction table for many-to-many relationships shows up everywhere. The idea that relationships can carry data of their own — just like entities — shows up everywhere.

This is one of the most encouraging things about learning relational thinking: you’re not learning a different system for every domain. You’re learning a small set of universal patterns that apply across all of them. Once you have those patterns, you have the tools to model almost anything.

* * *

## Chapter Summary

Relationships in a relational database live _between_ tables, not inside them. Embedding relationship data inside a single table leads to redundancy, nulls, and structural distortion that makes data hard to maintain and query.

There are three types of relationships. One-to-many is the most common: one instance of A connects to many instances of B, but each B connects to only one A. The foreign key lives on the “many” side. Many-to-many relationships require a junction table that sits between the two entities and has one row per pairing. One-to-one is rare and should be used only when there’s a clear reason.

A foreign key is a column that references the primary key of another table. It’s a pointer, not a copy. Referential integrity — the database’s guarantee that every foreign key points to something real — prevents orphaned records and enforces real-world business rules automatically.

To find relationships in any domain, look for verbs. Nouns are entities; verbs are relationships. Determine the type of each relationship by asking: “Can one A have many Bs? And can one B have many As?” The answers tell you whether you have a one-to-many or a many-to-many.

* * *

## Key Terms

**Relationship**

— A connection between two entity types in a database. Relationships are represented by foreign keys (for one-to-many) or junction tables (for many-to-many).

**One-to-many relationship** — A relationship where one instance of entity A can connect to many instances of entity B, but each B connects to only one A. The most common relationship type.

**Many-to-many relationship** — A relationship where one instance of entity A can connect to many instances of entity B, and one instance of entity B can also connect to many instances of entity A. Requires a junction table.

**One-to-one relationship** — A relationship where one instance of entity A connects to exactly one instance of entity B, and vice versa. Rare in practice.

**Foreign key** — A column in one table that contains values matching the primary key of another table. It represents a relationship by pointing from one row to another.

**Referential integrity** — The guarantee that every foreign key value corresponds to an existing row in the referenced table. Prevents orphaned records.

**Junction table** — A table that implements a many-to-many relationship by storing one row for each pairing of two entities. Also called a bridge table or associative table.

**Orphaned record** — A row whose foreign key points to a row that no longer exists in the referenced table. A sign of broken referential integrity.

* * *

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

* * *

### Activity 3.1 — Concept Check: Relationships, Foreign Keys, and Integrity

_This activity checks your understanding of the core vocabulary and ideas from Chapter 3. The AI will quiz you one question at a time, give you feedback, and help fill in any gaps._

* * *

**Copy and paste this prompt into your AI tool:**

> I’ve just finished reading Chapter 3 of my Introduction to Databases textbook, which covered types of relationships between tables, foreign keys, and referential integrity. I want to check my understanding. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and explain it more clearly if needed. Then ask if I’d like to go deeper before moving to the next question.
>
> Here are the questions:
>
> - Why is it a problem to embed relationship data inside a single table instead of separating it into two tables connected by a foreign key?
> - What is a one-to-many relationship? Give an example from everyday life that isn’t in the textbook.
> - What is a many-to-many relationship, and why can’t it be represented with just a foreign key on one of the two tables?
> - What is a junction table, and what is its grain (what does one row represent)?
> - What is a foreign key? How is it different from a primary key?
> - What does referential integrity mean, and what problem does it prevent?
> - What is an orphaned record, and how does referential integrity prevent it?
> - What is a one-to-one relationship, and when would you actually use one?

* * *

### Activity 3.2 — Apply It: Map the Relationships in an App You Use

_This activity asks you to identify and classify relationships in a real app or service you already use. The AI will guide you through the analysis step by step._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m studying database relationships in my Introduction to Databases class. I just learned about one-to-many, many-to-many, and one-to-one relationships, foreign keys, and junction tables. I want to practice by mapping the relationships in an app I actually use.
>
> I’ll name an app or service, and you’ll guide me through identifying its key relationships. Ask me one question at a time and wait for my answer before continuing. After each answer, give me feedback — tell me what’s correct, point out anything I missed or misclassified, and help me think more carefully.
>
> 1. What app or service do you want to analyze? (Name one — for example: Instagram, Spotify, DoorDash, Canvas, your university’s course registration system, etc.)
> 2. What are the main entities in this app? List four to six things the app needs to keep track of.
> 3. Now list all the relationships between those entities. For each one, describe it in a sentence using a verb: “\[Entity A\] \[verb\] \[Entity B\].”
> 4. For each relationship you listed, classify it: is it one-to-many, many-to-many, or one-to-one?
> 5. For each many-to-many relationship, describe the junction table you’d need: what would you name it, and what would one row represent?
> 6. Does any junction table carry data beyond just connecting the two entities? If so, what data would it hold?
>
> After I’ve answered all the questions, give me a summary of the relationship map I’ve built, note any relationships I might have missed, and point out the most interesting or non-obvious design decision in this app’s data model.

* * *

### Activity 3.3 — Practice: One-to-Many or Many-to-Many?

_This activity gives you practice classifying relationships — the core skill you need before you can design a database. The AI will present scenarios and ask you to identify and justify the relationship type._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m learning about database relationships and I want to practice classifying them. My textbook taught me to ask two questions: “Can one A have many Bs?” and “Can one B have many As?” — and the answers tell me whether the relationship is one-to-many or many-to-many.
>
> Please present the following relationship pairs to me one at a time. For each one, ask me: (a) Is this one-to-many or many-to-many? (b) Why — walk me through the two questions. (c) If it’s many-to-many, what would the junction table be named and what would one row represent?
>
> Wait for my answer each time. Tell me if I’m right, correct me if I’m wrong, and explain the reasoning. Ask if I want to discuss it further before moving on.
>
> Here are the pairs:
>
> 01. Student and Course
> 02. Customer and Order
> 03. Song and Artist
> 04. Movie and Actor
> 05. User and Playlist
> 06. Order and Product
> 07. Employee and Department
> 08. Doctor and Patient
> 09. Tweet and Hashtag
> 10. Post and Like (on Instagram)
>
> After we’ve gone through all of them, give me two new relationship pairs and ask me to classify them myself without your guidance first.

* * *

### Activity 3.4 — Case Study: From a Business Description to a Relationship Map

_This activity puts you in the role of a database designer who has to read a business description and build a relationship map from scratch. The AI plays the role of a project manager who needs you to design their system._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m learning database design in my Introduction to Databases class. I just studied relationships between tables — one-to-many, many-to-many, junction tables, and foreign keys. I want to practice going from a plain-English business description to a database relationship map.
>
> Please play the role of a project manager at a company that runs a music festival. You’re going to describe your business to me and I’m going to design the database. Ask me one question at a time and wait for my answer. After each answer, respond as the project manager — tell me if my design matches what you need, push back if something’s wrong, and add context that helps me refine my thinking.
>
> Here’s the business description to work from:
>
> “We run an annual three-day music festival. We book artists to perform on one of four stages. Each artist performs once, in a specific time slot on a specific day. Fans buy tickets in advance — each ticket is for the whole festival, not a single show. We also have vendors who sell food and merchandise; each vendor is assigned to a specific location on the festival grounds. We need to track which artists are performing, when and where, how many tickets we’ve sold and to whom, and which vendors are where.”
>
> Here are the questions to guide the design:
>
> 1. What are the main entities in this system? List them all.
> 2. For each pair of related entities, describe the relationship in a sentence with a verb. Then classify it: one-to-many or many-to-many?
> 3. Are there any many-to-many relationships? If so, what junction tables do we need, and what would one row in each represent?
> 4. Do any of those junction tables carry additional data beyond just connecting two entities? What data?
> 5. Are there any relationships you’re uncertain about — where it could go either way depending on business decisions? What are they, and what questions would you ask the project manager to resolve them?
> 6. Draw a simple text-based diagram of your relationship map — just entity names connected by lines labeled with the relationship type (1:M or M:M).
>
> After my final answer, give me feedback on the overall design: what did I get right, what did I miss, and what’s the most important thing to nail down before building this database?

## License

![Icon for the Public Domain license](https://pressbooks.marshall.edu/app/themes/pressbooks-book/packages/buckram/assets/images/public-domain.svg)

This work ( [Relational Thinking](https://pressbooks.marshall.edu/mis340) by David Wiley) is free of known copyright restrictions.

## Share This Book

[Share on X](https://pressbooks.marshall.edu/mis340/chapter/relationships-how-things-connect/#) [Share on LinkedIn](https://pressbooks.marshall.edu/mis340/chapter/relationships-how-things-connect/#) [Share via Email](https://pressbooks.marshall.edu/mis340/chapter/relationships-how-things-connect/#)