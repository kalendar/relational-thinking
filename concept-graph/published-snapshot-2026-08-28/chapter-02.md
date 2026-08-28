[Skip to content](https://pressbooks.marshall.edu/mis340/chapter/entities-attributes-identity-tables/#content)

- **Model** a real-world domain as entities and attributes, and **justify** why the same domain might be modeled differently by different stakeholders (e.g., a concert venue’s box office vs. its marketing team).
- **Translate** entities, attributes, and instances into the corresponding table structures — tables, columns, and rows — and **explain** why row order carries no meaning in a relational table.
- **Evaluate** a table design for atomicity, and **identify** the problems caused by non-atomic cells — embedded lists, concatenated strings, or other multi-value fields — when a table is queried.
- **Define** the grain of a table precisely (completing “one row represents one \_\_\_”), and **diagnose** the analytical errors that result from grain mismatches, such as conflating one row per order with one row per order line.
- **Define** a primary key and the two rules it must satisfy (uniqueness, no blanks), and **distinguish** natural keys from surrogate keys, **justifying** why surrogate keys are typically the safer choice for a table’s identity.

* * *

Picture the lineup for a music festival. There’s the headliner, the openers, the food vendors, the stages, the ticketholders, the staff. There are set times, ticket prices, wristband colors, and parking lots. There’s a lot going on – and somehow, the festival organizers need to keep track of all of it.

Now imagine you’re building the database that runs this festival. Where do you even start?

The answer isn’t “open a spreadsheet and start typing.” The answer is to slow down and look at the world you’re trying to model. Who and what are the _things_ that matter? What do you need to know about each of them? How do they connect?

This chapter is about the first step in thinking relationally: learning to see the world as entities and attributes – the building blocks of every database table you’ll ever create.

* * *

## 2.1 Modeling Reality

### What it means to abstract the world into data

Every database is an abstraction. That word – abstraction – just means that you’re taking something complex and representing it in a simpler, more structured form.

The real world is messy. A concert isn’t just a concert – it’s a specific night, in a specific venue, with a specific crowd, with a sound system that had a glitch in the second set, and a merch line that was 45 minutes long. No database captures all of that. A database captures the parts that matter for a specific purpose.

If you’re building a ticketing system, you care about the event name, the date, the venue, the ticket price, and who bought which ticket. You don’t care about the sound system glitch or the merch line wait time. Those things don’t affect whether a ticket is valid or how much revenue was generated.

This is what it means to abstract: to deliberately simplify by keeping what’s useful and leaving out what isn’t. And here’s the key insight – **the right abstraction depends on the purpose.** A ticketing system and a venue operations system might model the same concert completely differently, because they’re answering different questions.

### Simplification as a feature, not a bug

Students sometimes feel like leaving things out is a weakness of databases. It’s not. It’s the point.

If you tried to capture everything about every concert in a database, you’d end up with a system so complex it was unusable. You’d spend more time arguing about what to include than actually building anything. And the resulting database would be so bloated that simple questions – “how many tickets did we sell for the Friday night show?” – would take forever to answer.

Good database design is about finding the _right_ level of simplification. Not too much (you lose information you need), not too little (you drown in information you don’t need).

A map is a useful analogy. A street map of your city is useful precisely because it leaves out the trees, the buildings’ architectural details, and the color of every house. Those things are real, but they’re not what the map is for. The map is for navigating, so it shows roads, intersections, and landmarks. A database is the same: designed for a purpose, simplified to serve it.

### The model is not the territory

There’s a famous saying in philosophy: “the map is not the territory.” A map _represents_ a place; it isn’t the _actual_ place itself. The same is true of databases.

This matters because it’s easy to start treating the database as if it _is_ reality – to forget that it’s a model, made of choices, and those choices might be wrong or incomplete. When a database says a user’s age is 22, that’s only true if someone entered the right birth date. When a database says a ticket is valid, that’s only true if the validation logic was written correctly.

Good data thinkers hold both things at once: the database is useful, _and_ it’s an imperfect model. Never confuse the two.

### Who made this model, and for what purpose?

Every database was designed by someone, for some purpose. That design reflects the designer’s assumptions, priorities, and blind spots.

Spotify’s database was designed to maximize listening engagement and recommend music people will keep streaming. It wasn’t designed to help musicians understand their audience or track long-term career growth. So while Spotify might know exactly how many times a song was skipped in the first 30 seconds, an independent artist trying to understand their fanbase might find the data Spotify provides surprisingly limited – because that’s not a question Spotify’s database was built to answer.

When you’re working with any database, it’s worth asking: who built this, and what were they trying to do? The answer tells you a lot about what the data can and can’t tell you.

### How different stakeholders might model the same domain differently

Here’s a thought experiment. Three different organizations want to build a database about college students. What does each one include?

The **registrar’s office** cares about: student ID, name, enrollment status, major, credit hours completed, GPA, tuition balance. The student is, to them, primarily an academic and financial record.

A **mental health counseling center** cares about: appointment history, presenting concerns, referrals, crisis flags. The student is, to them, primarily a person with wellbeing needs.

A **university athletics department** cares about: sport, eligibility status, scholarship details, practice attendance, academic standing (because NCAA rules require it). The student is, to them, primarily an athlete.

Same student. Three completely different models. None of them is wrong – they’re each right for their purpose. But none of them is a complete picture of the person either.

This is one of the most important things to internalize about data: **every model is a perspective.** It captures what the modeler needed to see.

* * *

## 2.2 Entities and Attributes

### Identifying the things we care about

An **entity** is a thing – a person, place, object, event, or concept – that we want to track information about in our database. An entity is just like a noun in the old song.

Grammer - A Noun Is A Person, Place Or Thing - Schoolhouse Rock - YouTube

Tap to unmute

[Grammer - A Noun Is A Person, Place Or Thing - Schoolhouse Rock](https://www.youtube.com/watch?v=929mBQPQB3g) [Schoolhouse Rock](https://www.youtube.com/channel/UC1yty6F-2neYfwE8xc1A72Q)

Schoolhouse Rock68K subscribers

[Watch on](https://www.youtube.com/watch?v=929mBQPQB3g)

In the festival database, the entities might include:

- **Artist** (the performers)
- **Stage** (the performance spaces)
- **Event** (a specific artist performing on a specific stage at a specific time)
- **Ticket** (proof of purchase for a specific event)
- **Customer** (the person who bought the ticket)
- **Vendor** (the food and merch sellers)

Notice that an entity isn’t just a single instance of a noun – it’s a noun that we have multiple instances of, and that we need to track separately. “Artist” is clearly an entity – there are dozens of artists and we need to know about each one individually. ON the other hand, “festival” might not be an entity if the database we’re building is only for one festival.

A useful test: if you’d have more than one row for it, it’s probably an entity.

### Nouns as entities: customers, orders, products, events

In most business domains, entities fall into a few familiar categories.

**People**: customers, employees, users, students, artists, vendors. Any person the organization has a relationship with and needs to track.

**Things**: products, tickets, venues, devices, vehicles. Physical objects (or digital ones) that the organization manages.

**Events**: purchases, performances, appointments, transactions, logins. Things that happen at a specific point in time.

**Places**: stores, campuses, venues, warehouses, regions. Physical locations that matter to the business.

**Concepts**: categories, plans, statuses, roles. Abstract groupings or classifications that the business uses to organize other things.

When you’re modeling a new domain, scanning for people, things, events, and places is a good starting point. Most of your entities will fall into one of these buckets.

### How scope and purpose shape entity selection

Your list of entities (remember, entities are nouns) depends heavily on what the database will be used for.

A simple concert ticketing database might have four entities: Artist, Venue, Event, and Ticket. That’s enough to sell tickets and validate them at the door.

But if the same festival wants to use its database for marketing, it suddenly needs a Customer entity – with email addresses, purchase history, and communication preferences. If it wants to pay artists, it needs contracts and payment records. If it wants to manage its staff schedule, it needs an Employee entity and a Shift entity.

The scope of the system determines which entities matter. This is why the first question in any database design project isn’t “what tables do we need?” – it’s “what questions does this system need to be able to answer?”

### Choosing attributes: what to include, what to leave out

Every entity has **attributes** – the specific pieces of information we track about it. An Artist entity might have attributes like: artist name, genre, hometown, social media handle, booking fee, and rider requirements (the list of things an artist needs backstage – yes, the “ [no brown M&Ms](https://kmtharakan.medium.com/no-brown-m-ms-the-hidden-genius-in-van-halens-contract-clause-cbc224e051ec)” thing is real, and it goes in a database somewhere).

Choosing attributes requires the same discipline as choosing entities: be purposeful. Not every piece of information is worth capturing.

Three questions help guide attribute selection:

**Is it relevant to the system’s purpose?** The artist’s favorite color is a fact about them, but unless you’re a fan merchandise company, it probably doesn’t belong in your database.

**Is it stable enough to be useful?** Some attributes change so frequently they’re hard to keep accurate. An artist’s Twitter follower count changes by the minute – probably not worth storing. Their booking fee changes occasionally – worth storing, and worth tracking when it changes.

**Is it worth the cost of collecting it?** Data doesn’t collect itself. Someone has to enter it, validate it, and maintain it. If capturing an attribute requires significant effort and delivers little value, leave it out.

### Relevance, stability, and cost of collection

Let’s make this concrete with an example. You’re building a database for a Spotify-like music streaming service. You’re designing the **Song** entity. What attributes does it need?

Here’s a starter list:

- Song title ✓
- Artist ✓
- Album ✓
- Duration (in seconds) ✓
- Release date ✓
- Genre ✓
- Explicit content flag ✓
- Record label ✓
- Lyrics ✓ (for display)
- BPM (beats per minute) ✓ (if you want to offer playlist mood matching)
- Total number of words in the song lyrics – no
- Highest note sung in the song by the artist – no

The last two are silly, but illustrate the point: just because a fact exists doesn’t mean it belongs in your database. Every attribute should earn its place.

### Avoiding the trap of capturing everything

There’s a temptation in database design – especially when storage is cheap and data seems valuable – to capture everything you _might_ ever want to know. Resist this temptation!

Over-capturing data creates several problems. First, it creates maintenance burden: someone has to keep all those attributes current. Second, it creates noise: when a table has 80 columns, finding the five you actually care about becomes harder. Third, it creates a false sense of richness: **a database with lots of columns feels comprehensive but might still be missing the information you need**.

The best database designs are focused. They capture what the system needs, with room to add more when requirements change – not everything imaginable from the start. As Antoine de Saint-Exupéry said:

> “Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.”

* * *

## 2.3 Tables, Rows, and Columns

### The anatomy of a relation

In a relational database, data is stored in **tables**. Each table represents one entity type. (Later we’ll see that tables can also represent relationships, but we’ll get to that in Chapter 3.)

A table has a name – usually the entity it represents, like `Artist` or `Ticket` – and it’s made up of **columns** and **rows**.

Each **column** represents one attribute. In an `Artist` table, the columns might be: `artist_id`, `artist_name`, `genre`, `hometown`.

Each **row** represents one instance of the entity – one specific artist. So one row might be: `1 | Beyoncé | Pop/R&B | Houston, TX`. Another row: `2 | Bad Bunny | Reggaeton | San Juan, PR`.

Together, columns and rows form a grid or table. And **the table is the fundamental unit of a relational database**. Everything else is built on top of it.

Here’s what a simple `Artist` table might look like:

| artist\_id | artist\_name | genre | hometown |
| --- | --- | --- | --- |
| 1 | Beyoncé | Pop/R&B | Houston, TX |
| 2 | Bad Bunny | Reggaeton | San Juan, PR |
| 3 | Olivia Rodrigo | Pop | Temecula, CA |
| 4 | Tyler, the Creator | Hip-Hop | Los Angeles, CA |

Simple, clean, consistent. Each column is the same type of thing all the way down. Each row is one artist.

### Columns as attributes, rows as instances

It helps to keep these two ideas sharp:

- **Column = what kind of information** (genre, hometown, name)
- **Row = which specific thing** (Beyoncé, Bad Bunny, Olivia Rodrigo)

Every cell in the table is the intersection of a specific attribute (column) and a specific instance (row). The cell where the “genre” column meets the “Bad Bunny” row contains “Reggaeton.” That’s one fact about one entity.

This grid structure is what makes relational databases so powerful. Because every piece of data has a precise address – table, column, row – the database can find, update, or delete any fact exactly. And because every row follows the same column structure, the database can compare, sort, filter, and summarize across thousands or millions of rows with ease.

### Why order doesn’t matter (and what that implies)

Here’s something that surprises a lot of people: in a relational table, the order of rows doesn’t matter.

In a spreadsheet, you might sort artists alphabetically and expect them to stay in that order. In a relational database, there’s no guaranteed order. The database might store the rows in any sequence it finds efficient, and when you retrieve them, they might come back in a different order each time.

This isn’t a bug. It’s a consequence of the set-based thinking we mentioned in Chapter 1. A table is a _set_ of rows, and sets don’t have an inherent order. If you want results in a specific order, you ask for that order explicitly when you run a query.

The practical implication: **never design a database that depends on the order of rows**. If order matters – like the track listing on an album – that needs to be an explicit attribute (a `track_number` column), not an assumption about how the rows are stored.

### Atomic values and why they matter

One of the most important rules in database design is that **each cell in a table should contain exactly one value**. This is called **atomicity** – the idea that data should be broken down into its smallest useful pieces.

What does “one value” mean in practice? Let’s look at some examples.

**Not atomic:** Storing a song’s featured artists as “Drake, Lil Wayne, Eminem” in a single cell. That’s three values crammed into one cell.

**Atomic:** Having a separate table for featured artist credits, with one row per artist per song.

**Not atomic:** Storing an address as “1604 Hal Greer Blvd, Huntington, WV 25701” in one column.

**Atomic:** Storing street address, city, state, and ZIP code each in separate columns.

Why does this matter? Because once you mix multiple values into one cell, you can’t work with them individually. If you store “Drake, Lil Wayne, Eminem” in one cell, how do you find all songs that feature Drake? You’d have to search inside that text string – messy, slow, and error-prone. If each featured artist is a separate row, finding all Drake features is instant.

**Atomicity is the discipline that makes data queryable**.

### What “atomic” means: one value per cell

Here’s a good test for atomicity: if you’d ever want to search by part of a cell’s contents, it’s not atomic enough.

Would you ever want to find all artists from a specific city? Then “Houston, TX” should be split into separate `city` and `state` columns. Would you ever want to find all songs longer than four minutes? Then duration should be stored as a number (in seconds or milliseconds), not as “4:32.” Would you ever want to find all tickets for a specific date? Then the date shouldn’t be buried inside a text field like “Saturday, April 12, 2025 at 8pm” – it should be a proper date value.

Every time you’re tempted to combine things, ask: will I ever want to work with just part of this? If yes, split it.

### The problems caused by lists, concatenations, and embedded structure

Storing multiple values in one cell – whether as a comma-separated list, a concatenated string, or a JSON blob – is one of the most common mistakes in database design, especially for people who come from a spreadsheet background.

In a spreadsheet, combining things is convenient. “Genre: Pop, R&B, Soul” fits in one cell and reads nicely. In a database, it’s a trap. You can’t sort by genre. You can’t count how many artists are in the “R&B” category. You can’t find all artists who are in both “Pop” and “Soul.” The data is there, but it’s disguised inside the cell, invisible to the database engine.

The solution is almost always a separate table – which is where relationships come in. We’ll get to that in Chapter 3.

* * *

## 2.4 The Grain of a Table

### What does one row represent?

Every table has what database designers call a **grain** – the precise definition of what one row represents.

Grain sounds technical, but the concept is simple: before you start adding columns to a table, you should be able to complete this sentence: “One row in this table represents one **_\__**\_\_\_\_.”

- One row in the `Artist` table represents one **artist**.
- One row in the `Ticket` table represents one **ticket purchase**.
- One row in the `Song` table represents one **song**.

Seems obvious, right? It gets tricky quickly. Consider a table called `SongPlay`. What does one row represent?

- One play of a song? (Each time a user hits play, a new row.)
- One song’s total plays today? (One row per song per day.)
- One user’s plays of a song? (One row per user per song, with a total count.)

These are three very different tables, even though they’re all about song plays. The grain determines everything: what columns belong in the table, how the data accumulates over time, and what questions the table can answer.

### Defining grain precisely before adding columns

**The discipline of defining grain before designing a table will save you enormous headaches later**

.

Here’s a real scenario. Imagine you’re building a table to track Spotify streaming data. Someone suggests a column called `play_count`. Sounds reasonable – until you ask: play count for what, over what period? For one song? For one artist? For one user? Over all time? Over the last 30 days?

Each of those is a different grain, and each implies a completely different table structure. If you don’t nail down the grain first, you’ll end up with a table that’s trying to be several things at once – and failing at all of them.

The discipline is simple: write the grain statement first (“One row represents one \_\_\_\_\_\_”), then design the columns. Every column you add should be a fact about exactly that one thing.

### Examples: one row per order vs. one row per order line

Imagine you’re building a database for a merch store at a concert. A customer buys three items in one transaction: a t-shirt, a poster, and a beanie. How do you record this? This is one of the most common grain decisions in business databases, and it’s worth spending a moment on.

**Option 1: One row per order.**

| order\_id | customer | items\_purchased | total |
| --- | --- | --- | --- |
| 1001 | Mia Chen | T-shirt, Poster, Beanie | $75 |

This seems clean. But notice what’s been lost: the items are crammed into one cell (violating atomicity), there’s no price per item, and there’s no way to ask “how many posters did we sell?” without parsing text.

**Option 2: One row per order line.**

| order\_id | customer | item | quantity | unit\_price |
| --- | --- | --- | --- | --- |
| 1001 | Mia Chen | T-shirt | 1 | $35 |
| 1001 | Mia Chen | Poster | 1 | $20 |
| 1001 | Mia Chen | Beanie | 1 | $20 |

Now each row represents one line item – one item in one order. The order\_id ties the rows together. Now you can count poster sales, calculate revenue by item, track inventory, and add up order totals. The data is actually useful.

The grain “one row per order line” is almost always the right call for this kind of purchase data – and it’s a pattern you’ll see over and over in real-world databases.

### Grain mismatches and the problems they cause

Grain mismatches happen when different rows in the same table represent different things – or when you try to combine data from tables with incompatible grains.

The most common result is **double-counting**. Imagine you have a `SongPlay` table where some rows represent individual plays and others represent daily totals (maybe because the data came from two different sources). When you add up the `play_count` column, you’re mixing apples and oranges. The total is meaningless – and worse, it looks meaningful.

Another common mismatch: mixing event-level and summary-level data in the same table. If one row says “Beyoncé played to a crowd of 50,000 at Coachella on April 12” and another says “Beyoncé sold 2.3 million tickets in 2024,” those are completely different grains – one is a specific event, the other is a yearly aggregate. Putting them in the same table guarantees confusion.

Grain discipline is one of the things that separates a good database designer from a great one. Getting it right prevents a whole class of subtle, hard-to-debug errors.

### How grain confusion leads to incorrect analysis

Grain confusion doesn’t just cause technical problems – it causes real business mistakes.

Imagine a concert promoter is trying to figure out average ticket revenue per show. Their database has a table that mixes individual ticket sales with summary rows (one row per show, with totals). When they calculate the average, they accidentally include the summary rows in the calculation – and get a number that’s completely wrong. They make staffing decisions based on that number. The decisions turn out to be bad. And the root cause was a table where no one ever clearly defined the grain.

This kind of error is surprisingly common in the real world. And it’s almost always preventable with one simple habit: write down what one row represents before you add a single column.

* * *

### 2.5 The Primary Key: Giving Each Row an Identity

#### Why “the row about Mike Johnson” isn’t good enough

Back in Chapter 1, the ticket sales notebook had a problem: one employee wrote “Mike Johnson,” another wrote “M. Johnson,” a third wrote “Johnson, Michael.” Structuring the data into a table with proper columns fixed the formatting — but it didn’t fix the deeper issue. Even with a clean `customer_name` column, what happens when two different customers are both named Mike Johnson? A name is a description, not an identifier. It can be duplicated, misspelled, or changed, and none of that is acceptable when you need to point at one exact row and say “this one, not any other.”

Every table needs a reliable way to do that. That’s what a primary key is for.

#### What a primary key is

A **primary key** is one or more columns whose values uniquely identify every row in a table. Two rules make this work: no two rows in the table can ever share the same primary key value, and the primary key value can never be blank. If either rule is broken, the key can no longer do its job — you’d have no way to guarantee you’re pointing at exactly one row.

Think back to grain. Grain tells you what one row _means_ — “one row represents one order.” The primary key is what lets you _grab_ that one row out of every other row in the table. They’re two halves of the same idea: grain defines the row, the primary key lets you address it.

#### Natural keys and their risks

Sometimes a real-world attribute is already unique, and it’s tempting to use it as the primary key. A book’s ISBN, a person’s email address, a car’s VIN — these are called **natural keys**, because they come from the domain itself rather than being invented for the database.

The problem is that “unique” in the real world often turns out to be less permanent than it looks. Email addresses change when people switch jobs. Two customers occasionally share a data-entry error that makes them look identical. Even government ID numbers, which seem like the safest bet, are sometimes reissued or entered incorrectly. A key that can change or collide isn’t a safe foundation — and if you’ve built relationships between tables on top of it (which is exactly what Chapter 3 covers), a change to a natural key can silently break every link that depends on it.

#### Surrogate keys: identity without meaning

For this reason, most database designers reach for a **surrogate key** instead: a value generated by the system purely to serve as an identifier, with no business meaning of its own. An auto-incrementing number — 1, 2, 3, 4 — assigned the moment a row is created is the most common example.

A surrogate key never needs to change, because it was never trying to describe anything about the row in the first place. It doesn’t care if the customer’s name is misspelled, if the artist changes their stage name, or if two products happen to share a barcode. It only has one job: point at this row, and no other. That single-purpose design is exactly what makes it trustworthy.

#### A quick example

Picture an `Artist` table with columns `artist_id`, `artist_name`, and `genre`. If two rows both have `artist_name = "Dua Lipa"` — maybe a data entry duplicate, maybe two different, unrelated performers who share a stage name — the table can still tell them apart, because `artist_id` guarantees one value can never repeat. Row 4 is row 4, no matter what happens to the name in the column next to it.

Hold onto that `artist_id` column. In the next chapter, another table is going to reference it — and the moment it does, you’ll be looking at your first relationship between two tables.

* * *

## Chapter Summary

A database is a model of the world – a deliberate simplification designed for a specific purpose. Every design reflects choices about what matters and what doesn’t, who made the model and why, and which level of detail is right for the job. The model is not the territory.

Entities are the things we track: people, places, objects, events, concepts. Each entity becomes a table. Each attribute of an entity becomes a column. Each specific instance of an entity becomes a row.

Attributes should be chosen carefully – relevant to the system’s purpose, stable enough to be useful, and worth the cost of collection. The temptation to capture everything should be resisted.

Every cell in a table should contain exactly one value (atomicity). Combining multiple values into a single cell – lists, concatenated strings, embedded structures – makes the data invisible to queries and leads to bad design.

Every table has a grain: a precise definition of what one row represents. Defining the grain before designing the columns prevents a whole category of design mistakes and analytical errors.

Every table needs a reliable way to point at one exact row, and that’s the job of the primary key: one or more columns whose values uniquely identify each row, never repeating and never blank.

* * *

## Key Terms

**Entity –**

A thing – a person, place, object, event, or concept – that a database tracks information about. Each entity type becomes a table.

**Attribute** – A specific piece of information tracked about an entity. Each attribute becomes a column in the entity’s table.

**Table** – The fundamental structure in a relational database. A table has a name, a set of columns (attributes), and a set of rows (instances).

**Row** – One instance of an entity in a table. One row = one specific thing (one artist, one ticket, one song).

**Column** – One attribute of an entity. All rows in a table share the same columns.

**Atomicity** – The principle that each cell in a table should contain exactly one value, indivisible into smaller useful parts.

**Grain** – The precise definition of what one row in a table represents. Defined by completing the sentence: “One row in this table represents one **_\__**\_\_\_\_.”

**Primary key** — One or more columns whose values uniquely identify each row in a table. No two rows may share a value, and the value can never be blank.

**Natural key** — A primary key drawn from an attribute that already exists in the real world (an email address, an ISBN) because it happens to be unique.

**Surrogate key** — A system-generated identifier with no business meaning, created solely to uniquely identify a row (e.g., an auto-incrementing ID).

* * *

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

* * *

### Activity 2.1 – Concept Check: Entities, Attributes, and Tables

_This activity checks your understanding of the core vocabulary from Chapter 2. The AI will quiz you one question at a time, give you feedback, and help fill in any gaps._

* * *

**Copy and paste this prompt into your AI tool:**

> I’ve just finished reading Chapter 2 of my Introduction to Databases textbook, which covered entities, attributes, tables, atomicity, grain, and primary keys. I want to check my understanding of the key ideas. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and explain it more clearly if needed. Then ask if I’d like to go deeper on that topic before moving to the next question.
>
> Here are the questions:
>
> - What is an entity in database design, and how do you decide what counts as one?
> - What is an attribute? How do you decide which attributes to include for an entity and which to leave out?
> - What is the difference between a row and a column in a database table?
> - Why doesn’t the order of rows matter in a relational database, and what does that imply for how you design tables?
> - What does “atomicity” mean in database design? Give an example of a non-atomic value and explain how you’d fix it.
> - What is the “grain” of a table? Why is it important to define grain before adding columns?
> - What is a primary key, and what two rules must every primary key follow?
> - What’s the difference between a natural key and a surrogate key? Why do most database designers prefer surrogate keys?
> - The chapter argues that every database model is a “perspective” that reflects the designer’s purpose. What does that mean, and why does it matter?

* * *

### Activity 2.2 – Apply It: Model a Domain You Know

_This activity asks you to apply entity and attribute thinking to a real-world domain from your own life. The AI will guide you through the design process step by step and push your thinking._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m studying database design in my Introduction to Databases class. I just learned about entities, attributes, tables, and grain (see attached). I want to practice by designing a simple database for something I actually know.
>
> I’m going to name a domain I’m familiar with – like a favorite app, a sport I follow, a job I’ve had, or an organization I’m part of – and you’ll guide me through designing a simple database for it. Ask me one question at a time and wait for my answer before continuing. After each answer, give me feedback: tell me what’s good, point out anything I’m missing, and help me think more carefully. Here are the questions:
>
> 1. What domain do you want to model? (Name an app, a sport, a business, a club, or any system you know well.)
> 2. What are the three to five main entities in this domain – the key things the system would need to track?
> 3. Pick your most important entity. What attributes would you store for it? List as many as you can think of.
> 4. Now let’s apply the three filters: which of those attributes are truly relevant to the system’s purpose, stable enough to be useful, and worth the cost of collecting? Which ones would you cut?
> 5. For your most important entity, write the grain statement: “One row in this table represents one **_\__**\_\_\_\_.” Is that grain clear and specific?
> 6. Look at your attribute list again. Are any of your attributes non-atomic – do any of them combine multiple values into one? If so, how would you fix them?
>
> After I’ve answered all the questions, give me a brief summary of the database design I’ve sketched out and flag the one or two things I should think about most carefully before building it.

* * *

### Activity 2.3 – Practice: Atomic or Not?

_This activity gives you practice identifying non-atomic values and correcting them – one of the most common design mistakes beginners make._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m studying database design and I want to practice identifying non-atomic values. My textbook says that each cell in a database table should contain exactly one value – and that combining multiple values into one cell causes serious problems when you try to query the data.
>
> Please show me the following examples one at a time. For each one, ask me: (a) Is this value atomic or non-atomic? (b) If it’s non-atomic, what problems would it cause? (c) How would you fix it?
>
> Wait for my answer after each one. Tell me what I got right, correct anything I missed, and explain the reasoning. Ask if I want to discuss it further before moving to the next one.
>
> Here are the examples:
>
> 1. A `Student` table has a column called `courses_enrolled` containing “MKTG 101, ACCT 201, MIS 310”
> 2. A `Song` table has a column called `duration` containing “3:47”
> 3. A `Customer` table has a column called `name` containing “Johnson, Sarah”
> 4. A `Ticket` table has a column called `event_info` containing “Olivia Rodrigo – Charleston Coliseum – March 14, 2026 – 8:00 PM”
> 5. A `Product` table has a column called `price` containing “$24.99”
> 6. A `Concert` table has a column called `opening_acts` containing “Gracie Abrams, Sabrina Carpenter”
> 7. A `User` table has a column called `birthday` containing “October 3rd”
>
> After we’ve gone through all the examples, give me one new non-atomic example from everyday life and ask me to identify the problem and fix it myself.

* * *

### Activity 2.4 – Case Study: Fixing a Messy Spreadsheet

_This activity puts you in a realistic scenario where you inherit a poorly designed spreadsheet and need to redesign it as a proper database. The AI plays the role of a data consultant helping you work through the problems._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m learning about database design in my Introduction to Databases class. I want to work through a realistic scenario about entities, attributes, atomicity, and grain.
>
> Please play the role of an experienced data consultant. I’m going to describe a spreadsheet someone built to track concert tour data, and you’ll guide me through identifying its problems and redesigning it as a proper database. Ask me one question at a time and wait for my answer before continuing. After each answer, respond as the consultant – acknowledge what I got right, push back if I’m missing something, and share your expertise.
>
> The spreadsheet we’re looking at has these columns:
>
> – Tour Name
>
> – Artist(s) (example values: “Taylor Swift” or “Drake, 21 Savage”)
>
> – Dates (example values: “March 12-15, 2026” or “April 4, 2026”)
>
> – Cities (example values: “New York, Los Angeles, Chicago”)
>
> – Venue(s) (example values: “MSG, Staples Center, United Center”)
>
> – Ticket Prices (example values: “$75-$350”)
>
> – Total Revenue
>
> Here are the questions to guide me through the redesign:
>
> 1. Before we fix anything – just looking at the column list and example values, what are the biggest problems you notice with this spreadsheet’s design?
> 2. Which values in this spreadsheet are non-atomic? Pick two or three and explain what problems they’d cause.
> 3. What is the grain of this spreadsheet? Is it clear? What ambiguities do you see?
> 4. If we were redesigning this as a proper database, what entities would we need? What would we name them?
> 5. For the most granular entity (the one with the finest grain), what columns would the table have?
> 6. What information in the current spreadsheet would be lost or need to be captured differently in the new design?
>
> After my final answer, give me a sketch of what the redesigned database structure should look like, and explain why it’s better than the original spreadsheet.

## License

![Icon for the Public Domain license](https://pressbooks.marshall.edu/app/themes/pressbooks-book/packages/buckram/assets/images/public-domain.svg)

This work ( [Relational Thinking](https://pressbooks.marshall.edu/mis340) by David Wiley) is free of known copyright restrictions.

## Share This Book

[Share on X](https://pressbooks.marshall.edu/mis340/chapter/entities-attributes-identity-tables/#) [Share on LinkedIn](https://pressbooks.marshall.edu/mis340/chapter/entities-attributes-identity-tables/#) [Share via Email](https://pressbooks.marshall.edu/mis340/chapter/entities-attributes-identity-tables/#)