[Skip to content](https://pressbooks.marshall.edu/mis340/chapter/data-at-scale-and-the-modern-data-stack/#content)

* * *

The databases we’ve designed throughout this book — the concert ticketing system, the music streaming schema, the campus sports league — are designed to handle the day-to-day work of running a business. A student buys a ticket; the ticket record is inserted. A song gets played; a stream event is recorded. An artist updates their bio; the row is changed. These are small, fast, precise operations on current data.

But organizations also need to answer a completely different kind of question: not “did this transaction go through?” but “what are our top ten most-streamed genres over the past three years, broken down by student subscription tier and region?” These analytical questions scan millions or billions of rows, crunch them into summaries, and power the dashboards and reports that drive business decisions.

These two types of work — day-to-day transactions and large-scale analysis — have fundamentally different requirements. Trying to do both on the same database is like trying to run a restaurant kitchen and a catering operation for 10,000 people in the same space with the same staff. They can coexist, but not efficiently.

This chapter explains why the data world split into two types of systems, what the modern infrastructure for each looks like, how data flows between them, and how BI tools and dashboards sit on top of it all. It closes with a look at what the data professional’s role looks like in a world where AI is increasingly capable of writing code and generating queries.

* * *

## 13.1 OLTP vs. OLAP: Two Different Jobs

The distinction between **OLTP** (Online Transaction Processing) and **OLAP** (Online Analytical Processing) is one of the most important architectural concepts in data work. The two types of systems are built for entirely different jobs, and confusing them — or trying to use one for the other’s job — is a common source of performance and design problems.

### Transactional systems: optimized for writes

An **OLTP system** is what we’ve been designing throughout this book. Its job is to support the operational work of running a business: recording transactions, processing requests, maintaining current state. These systems are characterized by:

**Many small, fast, concurrent operations.** An OLTP database might handle thousands of INSERT, UPDATE, and DELETE operations per second, each touching only a handful of rows. A ticket purchase inserts three rows (Ticket, Payment, and a log entry). An account update changes one row. These are small, targeted operations.

**Short-lived queries.** A query to check “does this student have a valid ticket?” should return in milliseconds. Queries that take seconds are performance problems. Queries that take minutes are crises.

**High concurrency.** Many users and systems interact with the database simultaneously. ACID transactions (Chapter 11) ensure these concurrent operations don’t corrupt each other.

**Current data.** OLTP systems are the source of truth for what is happening right now. What is the current ticket count? What is this user’s current subscription status? The question is always about the present state.

**Normalized schemas.** The normalization we covered in Chapter 5 reduces redundancy and makes writes efficient. When you update an artist’s name, you change it in one row in the Artist table — not in every stream record, playlist entry, and review that mentions that artist.

Examples of OLTP systems: a ticketing system, a bank’s account management system, an e-commerce checkout system, a university enrollment system, a restaurant’s point-of-sale system.

### Analytical systems: optimized for reads across large datasets

An **OLAP system** (or analytical system, or data warehouse) is built for the opposite job: scanning large volumes of historical data to produce insights. These systems are characterized by:

**Few large, slow, sequential scans.** A single analytical query might scan 500 million rows, reading the `genre` and `seconds_listened` columns from every stream record over the past two years. This is the opposite of an OLTP query — it’s enormous, slow by comparison, and touches a tiny number of columns across a huge number of rows.

**Long-running queries.** A complex analytical query might take minutes or even hours to run. This is expected and acceptable — the question is complex, the data is vast, and users (analysts, data scientists, executives) understand they’re waiting for a meaningful answer.

**Low concurrency.** While an OLTP system handles thousands of simultaneous users, an analytical system might serve dozens of analysts running queries, not thousands of real-time transactions.

**Historical data.** Analytical systems are about patterns over time, not current state. “How did stream counts change quarter over quarter for the past three years?” is an analytical question. The system needs years of history, not just today’s data.

**Denormalized schemas.** Joins are expensive when you’re scanning billions of rows. Analytical systems often deliberately denormalize — storing redundant copies of data in a flat structure so queries can scan a single table rather than joining many. The query performance gain is worth the storage cost.

### Why you can’t just do both on the same system

When an analyst runs a large scan across millions of rows on an OLTP system, it competes for resources with the transactional operations that are trying to run simultaneously. The scan holds locks, consumes I/O bandwidth, and slows down the fast queries that users depend on. A long-running report that scans the entire Stream table will slow down every ticket purchase happening at the same time.

Conversely, running an OLTP system on infrastructure optimized for analytical workloads means your transactional queries are slower than they need to be — the system isn’t designed for many small, fast operations.

The solution: separate systems. OLTP systems handle the operational work. Analytical systems receive copies of the data, optimized for reading. Data flows from OLTP to analytical systems through a process called ETL or ELT (covered in section 13.2).

### The schema difference: OLTP vs. analytical

The differences in optimization show up in the schema.

An **OLTP schema** is normalized — the music streaming schema from Chapter 8 is a good example. Data lives in one place; joins retrieve it when needed. This is efficient for writes.

An **analytical schema** is often organized as a **star schema** or **snowflake schema** — a denormalized structure designed for read performance.

In a star schema, there’s a central **fact table** containing the measurements you want to analyze (stream events, sales, clicks), surrounded by **dimension tables** containing the context for those measurements (who, what, when, where).

For our streaming platform:

```
Fact table:    STREAM_FACT (stream_id, user_key, song_key, date_key, seconds_listened, completed)
Dimension:     USER_DIM (user_key, username, subscription_tier, signup_month, signup_year, university)
Dimension:     SONG_DIM (song_key, song_title, artist_name, genre, release_year, explicit)
Dimension:     DATE_DIM (date_key, date, day_of_week, week, month, quarter, year, is_weekend)
```

Notice what’s different from the normalized OLTP schema:

- `SONG_DIM` contains `artist_name` directly — no join to the Artist table needed
- `DATE_DIM` is a separate table containing pre-computed date attributes (day of week, quarter, etc.) that would be slow to compute on the fly for billions of rows
- The grain of `STREAM_FACT` is one row per stream event — same as the OLTP `STREAM` table, but with denormalized keys pointing to dimension tables rather than to normalized entity tables

This design makes analytical queries fast. “Total streaming hours by genre and subscription tier, by quarter” is a single scan of STREAM\_FACT joined to three small dimension tables — no chain of joins through Artist → Song → Stream as in the OLTP schema.

* * *

## 13.2 The Modern Data Stack

The infrastructure that moves data from where it’s generated to where it can be analyzed is called the **data stack**. The modern data stack has evolved considerably over the past decade, driven by cloud computing and the explosion of data volume.

### Data warehouses: structured, curated, query-optimized

A **data warehouse** is a centralized analytical database that consolidates data from multiple source systems, structures it for analysis, and provides a consistent environment for business intelligence and reporting.

Before data warehouses, organizations ran reports directly on their OLTP databases — with the performance problems described above — or maintained separate copies of data in spreadsheets, which quickly became inconsistent with each other. The data warehouse was invented to solve this: one place where all the data lives, in a form optimized for analysis, with a single version of the truth.

Data warehouses are:

- **Structured.** Data in a warehouse is modeled (often as star or snowflake schemas), cleaned, and documented. An analyst querying a warehouse can trust that the tables are consistent and that the definitions are documented.
- **Integrated.** A warehouse consolidates data from many source systems — the ticketing system, the streaming app, the payment processor, the marketing platform — into a unified model.
- **Historical.** Warehouses retain data over long time horizons. While the OLTP system might only store the current state, the warehouse stores every historical record.
- **Query-optimized.** Columnar storage, pre-computed aggregations, and analytical query engines make warehouse queries fast even over billions of rows.

**Snowflake**, **Amazon Redshift**, **Google BigQuery**, and **Databricks SQL** are the major modern cloud data warehouses. They’re entirely cloud-based, scale storage and compute independently, and charge based on usage rather than requiring up-front hardware investment.

### Data lakes: raw, unstructured, cheap storage at scale

A **data lake** is a large storage repository that holds raw, unprocessed data in its native format — structured tables, JSON files, log files, images, video, audio, and anything else. Think of it as a landing zone for data before it gets processed.

The key characteristics of a data lake:

- **Schema-on-read, not schema-on-write.** In a relational database, you define the schema before data goes in. In a data lake, data goes in first and the schema is applied when you read it. This makes it easy to ingest data quickly, but it means the lake can accumulate messy, inconsistent data if nobody maintains it.
- **Cheap storage.** Data lakes use cloud object storage (Amazon S3, Google Cloud Storage, Azure Blob Storage), which is much cheaper than the storage used by relational databases or warehouses. Storing petabytes of raw data costs a fraction of what it would in a traditional database.
- **Any data format.** A data lake doesn’t care whether your data is CSV files, JSON logs, Parquet files, images, or video streams. It stores everything.

The danger of a data lake is what happens when nobody manages it. Raw data pours in, nobody cleans or documents it, and the lake becomes a **data swamp** — a repository of data that technically exists but is too messy to use. The data is all in there, somewhere, but nobody can find the right version, nobody knows what the columns mean, and nobody trusts the numbers.

Data lakes work best when they’re paired with strong data governance: clear ownership, documented schemas, quality checks on incoming data, and a process for promoting clean, curated data from the lake into the warehouse.

### Lakehouses: the attempt to get both

The **lakehouse** is an architectural pattern that tries to combine the cheap, flexible storage of a data lake with the structure, performance, and ACID guarantees of a data warehouse.

The core idea: store data in open file formats (like Apache Parquet or Apache Iceberg) on cheap cloud storage, but layer a transactional engine on top that provides ACID properties, schema enforcement, and SQL querying capabilities.

**Databricks** (with Delta Lake) and **Apache Iceberg** (supported by many platforms including Snowflake, BigQuery, and Amazon Athena) are the leading implementations. The promise: one platform for all your data, from raw ingestion to curated analytics, without the cost of duplicating data between a lake and a warehouse.

Whether the lakehouse fully delivers on that promise is still being worked out in the industry. But the concept captures the direction: breaking down the hard separation between raw storage and curated analytics.

### ETL: Extract, Transform, Load

**ETL** (Extract, Transform, Load) is the traditional process for moving data from source systems (OLTP databases, APIs, files) into a data warehouse.

**Extract:** Pull data from the source systems. This might mean querying the OLTP database for all records changed since the last extract, calling an API to retrieve new events, or reading files deposited by partner systems.

**Transform:** Clean, reshape, and enrich the data so it fits the warehouse schema. Transformations might include:

– Standardizing inconsistent values (“West Virginia,” “WV,” and “w. virginia” → “WV”)

– Converting data types (a timestamp stored as text → a proper datetime)

– Joining data from multiple sources (combining stream events with user attributes)

– Computing derived values (converting seconds to hours, calculating age from birth date)

– Filtering out records that fail quality checks

**Load:** Insert the transformed data into the warehouse.

In traditional ETL, all three steps happen in a separate processing environment — a dedicated ETL server or service that orchestrates the pipeline. The data is transformed before it enters the warehouse.

### ELT: Extract, Load, Transform

**ELT** (Extract, Load, Transform) reverses the order: data is extracted from sources and loaded into the warehouse first, in raw form. Transformation then happens inside the warehouse, using the warehouse’s own computational power.

This approach became practical as cloud data warehouses became powerful enough (and cheap enough per query) to handle large-scale transformations. Instead of building and maintaining separate transformation infrastructure, you load raw data and transform it with SQL inside the warehouse.

ELT has several advantages:

**Faster initial load.** You don’t need to wait for transformation to complete before data enters the warehouse. Raw data is available immediately; curated data is available after transformation runs.

**Transformation is version-controlled and debuggable.** When transformations are SQL queries run inside the warehouse, they can be version-controlled (stored in Git), tested, and debugged using the same skills analysts already have. They’re transparent.

**Re-transformation is easy.** If you discover a bug in a transformation, you can fix it and re-run it against the raw data already in the warehouse. With ETL, you might need to re-extract from the source system.

**dbt (data build tool)** is the dominant tool for managing ELT transformations. It lets analysts write transformations as SQL SELECT statements, manages dependencies between transformations, and generates documentation automatically. dbt has become a standard part of the modern data stack.

### The modern data stack in practice

A typical modern data stack for a streaming platform like StreamU:

1. **Source systems** (OLTP): PostgreSQL database powering the streaming app — tables for Users, Songs, Artists, Streams, Payments
2. **Data ingestion**: Tools like Fivetran or Airbyte extract changed records from PostgreSQL and load them into the warehouse in near-real-time
3. **Cloud data warehouse**: Snowflake or BigQuery receives the raw data in landing tables
4. **Transformation layer**: dbt transforms raw landing tables into clean, documented, analysis-ready models — the star schema dimension and fact tables
5. **BI and analytics layer**: Looker, Tableau, or Power BI connects to the warehouse and provides dashboards and reports

Each layer has specialized tools. The modern data professional doesn’t build these layers from scratch — they configure, connect, and maintain them, and they write the SQL and data models that make the data useful.

* * *

## 13.3 How BI Tools Connect to Data

**BI tools** (Business Intelligence tools) are the applications that sit on top of the data infrastructure and make the data accessible to business users — the people who need to answer questions and make decisions but who may not write SQL themselves.

Looker, Tableau, Microsoft Power BI, and Google Looker Studio are the major players. Each connects to a database or warehouse, allows users to build charts and dashboards, and provides some way to query data without writing raw SQL.

### What happens between a database and a dashboard

When a business user views a dashboard showing “Top 10 Most-Streamed Songs This Week,” here’s what’s happening under the hood:

1. The BI tool generates a SQL query based on the dashboard’s configuration — something like `SELECT song_title, COUNT(*) AS streams FROM STREAM_FACT JOIN SONG_DIM ... WHERE date_key >= ... GROUP BY song_title ORDER BY streams DESC LIMIT 10`
2. The BI tool sends that query to the data warehouse
3. The warehouse executes the query (possibly against billions of rows) and returns the results
4. The BI tool formats the results as a bar chart and displays it to the user

**SQL is under every chart.** Every number on every dashboard is the result of a SQL query, even if the person viewing the dashboard has never seen SQL. When a chart shows wrong numbers, the root cause is almost always a wrong query — wrong filters, wrong joins, wrong aggregation grain — even if the BI tool’s interface hides the SQL entirely.

This is why your relational thinking skills matter even if you never build a dashboard yourself. Being able to look at a chart and think “what SQL would produce this number?” is how you catch errors that others miss.

### Semantic layers and metrics definitions

One of the most important problems in BI is **metric consistency**. When two teams both pull a report on “monthly active users,” do they get the same number? Usually not — because “active” means different things to different teams, and they’ve each defined it slightly differently in their queries.

A **semantic layer** (also called a metrics layer) is a centralized place where metric definitions are maintained once and shared across all reports. Instead of every analyst writing their own `COUNT(DISTINCT user_id) WHERE stream_date >= ...` query, the company defines “Monthly Active Users” once in the semantic layer, and every tool that needs that metric reads the definition from the same place.

When the definition changes — maybe “active” now means streaming at least 15 minutes rather than at least 1 minute — you change it in one place, and every report that uses that metric is automatically updated.

Tools like **dbt metrics**, **Looker LookML**, and **Cube.js** implement semantic layers. The idea is simple and powerful: stop defining the same thing in a hundred places. Define it once, use it everywhere.

### Designing for queryability, not just storage

Here’s a perspective shift that matters for database professionals: the schemas you design will be queried by other people, many of whom are not database experts. A schema that’s technically correct and well-normalized can still be hard to use if it’s not designed with the query experience in mind.

**Naming conventions.** Column names like `usr_id`, `ts`, and `amt` are cryptic to analysts who didn’t build the system. `user_id`, `created_at`, and `amount_usd` are self-explanatory. The database works either way; the humans using it work much better with clear names.

**Documentation.** A column called `status` on a Stream table might have values of 0, 1, 2, and 3 — but what do they mean? If there’s no documentation, every analyst has to reverse-engineer the meaning from the data. A data dictionary — a document that defines each table, column, and valid value — turns “I don’t know what this column means” into a 30-second lookup.

**Consistent grain.** Tables with unclear or inconsistent grain confuse analysts and produce incorrect aggregations. The Stream table we’ve used throughout this book has a clear grain: one row per stream event. A table where some rows represent individual streams and others represent daily summaries (because someone accidentally mixed them in an import) is a trap.

**Documenting intentional denormalization.** When you deliberately denormalize for performance — storing `artist_name` directly in the Song table rather than always joining to Artist — document that it’s intentional. Otherwise, the next developer will “fix” it and cause regressions.

The database professional’s job isn’t just to design correct schemas. It’s to design schemas that people can use effectively.

### The role of the database professional in the analytics pipeline

In a modern organization, data work is distributed across several roles:

**Data engineers** build and maintain the pipelines that move data from source systems to warehouses. They write ELT transformations, maintain data quality, and ensure data arrives reliably.

**Analytics engineers** (often dbt practitioners) model data in the warehouse — building the clean, documented, analysis-ready tables that analysts query. They sit between data engineers and analysts.

**Data analysts** query the warehouse, build dashboards, and answer business questions. They’re heavy SQL users and often the primary consumers of the warehouse’s curated models.

**Data scientists** build statistical models and machine learning systems on top of the data. They need large volumes of historical data and often work closely with the warehouse.

**Business stakeholders** view dashboards and reports, ask questions, and make decisions. They may never write SQL, but they need to trust the numbers they see.

A business professional with relational thinking skills can play an effective role anywhere in this chain — asking better questions of analysts, building simple dashboards themselves, designing schemas that engineers can implement, and evaluating data quality with informed skepticism.

* * *

## 13.4 The Data Professional in an AI-Assisted World

This course has been teaching you to use AI as a tool for SQL generation and verification. It’s worth stepping back and thinking about what this means for the data professional’s role more broadly — what AI changes, what it doesn’t, and where the durable value lies.

### What AI can and cannot do with data

AI tools — large language models like the one you’ve been using throughout this book — are remarkably good at certain data tasks and remarkably bad at others.

**What AI does well:**

_Writing syntax._ Given a clear description of what you want, a schema, and the relevant tables, AI can write correct SQL for a wide range of queries. Simple queries, complex joins, window functions, CTEs — all of these are within reach of modern AI with good prompting.

_Boilerplate transformation._ Writing the same type of data transformation in multiple variations (format a date this way, standardize these values, calculate this derived field) is tedious for humans and easy for AI.

_Explaining code._ AI can explain what an existing SQL query does in plain English, which is valuable for understanding inherited code or queries written by someone else.

_Generating documentation._ Given a table schema, AI can draft descriptions of each column — a starting point for a data dictionary that a human then reviews and refines.

**What AI does not do:**

_Know your data._ AI knows syntax. It doesn’t know that 15% of your stream records have NULL in `seconds_listened`, or that your `genre` column has inconsistent capitalization, or that a legacy data import created duplicate artist records. These facts about your specific data are invisible to AI and they change which query is correct.

_Supply meaning._ When you ask “what’s our monthly active user count?”, AI doesn’t know what “active” means for your business — whether it’s logging in, streaming for 5 minutes, streaming for any duration, or something else. You supply the definition; AI implements it.

_Validate the logic._ AI can write a query that is syntactically correct and that produces a result, but it cannot tell you whether the result answers your business question correctly. A fan trap produces a plausible-looking number. A wrong join type silently drops rows. AI-generated SQL requires the same verification checklist as any other query — because the AI’s confidence in its output is uncorrelated with its correctness.

_Understand context._ “Show me our top artists” seems simple, but the AI doesn’t know whether “top” means by stream count, by unique listeners, by revenue, or by growth rate — or whether “our” means artists signed to your label or any artist on the platform. You have to specify.

### The value of knowing when a query is logically wrong

The most important thing a data professional can do in an AI-assisted world is not write queries faster. It’s know when the query is wrong.

AI tools make it easy to get a query that runs without errors and returns a result. The result might be wrong. The wrong answer doesn’t announce itself — it looks like a number, the chart loads, the dashboard updates. The error is in the logic, not the syntax, and logic errors require conceptual understanding to catch.

This is exactly what you’ve been building throughout this book. Understanding normalization tells you why a fan trap produces inflated numbers. Understanding joins tells you when LEFT JOIN vs. INNER JOIN is correct. Understanding grain tells you when an aggregation is summarizing at the wrong level. Understanding integrity tells you when NULLs are silently excluded from an average.

None of this is something you can outsource to AI. The AI is the one making the mistakes. You’re the one catching them.

### Why relational thinking remains the durable skill

Data tools change fast. SQL has been the dominant data query language for 50 years, but the systems it runs on have changed dramatically. Twenty years ago, SQL ran on Oracle and SQL Server. Ten years ago, Hadoop and MapReduce briefly looked like they might displace SQL entirely. Today, SQL runs on Snowflake, BigQuery, Databricks, dbt, and dozens of other systems — some of which didn’t exist five years ago.

The underlying mental model — data as sets of entities with relationships, queries as set operations, normalization as a design philosophy — has been essentially unchanged since Edgar Codd published it in 1970. Tools come and go. The model persists.

The data professionals with the longest careers aren’t the ones who learned the hottest tool at the right moment. They’re the ones who understood the underlying model well enough to pick up new tools quickly, evaluate new systems clearly, and explain data concepts to colleagues who’ve never written a query.

Relational thinking is the durable skill precisely because it’s not about any particular tool. It’s about how to think about data — as entities, relationships, keys, integrity constraints, and set operations. Every new data technology either implements this model or makes explicit trade-offs against it. Either way, understanding the model helps you understand the technology.

### Where to invest your attention going forward

As you leave this course, here’s how to think about your continued learning:

**Double down on the fundamentals.** You now understand the relational model, normalization, keys, integrity, joins, aggregation, and the basics of the modern data ecosystem. These will remain relevant regardless of how tools evolve. Going deeper on these — reading about database internals, studying how query optimizers work, understanding distributed systems concepts — pays long-term dividends.

**Use AI as a learning tool, not just a shortcut.** When AI generates SQL you don’t fully understand, dig into it. Ask the AI to explain each clause. Modify it and see what changes. Break it intentionally and understand why it breaks. The goal isn’t to have AI write all your queries — it’s to understand data well enough that you can use AI effectively and critically.

**Stay curious about data quality.** Most data problems aren’t interesting algorithm problems or clever query optimizations. They’re data quality problems: missing values, inconsistent formats, orphaned records, wrong grain. Developing an instinct for data quality — asking “where did this number come from and can I trust it?” — is more valuable in practice than knowing any particular syntax.

**Learn to communicate about data.** The ability to explain a data model to a non-technical stakeholder, to translate a business question into a precise data question, and to present analysis with appropriate caveats is enormously valuable and underrated. Data work happens inside organizations. Organizations are full of people who don’t think in tables and queries. The bridge between those worlds is worth building.

* * *

## Chapter Summary

OLTP systems support operational business work: many small, fast, concurrent transactions on current data with normalized schemas. OLAP systems support analytical work: large, slow queries scanning billions of historical rows with denormalized schemas. The two types have different requirements and are typically separate systems.

Analytical systems organize data into star schemas with a central fact table surrounded by dimension tables. The fact table holds measurements; dimension tables provide context.

The modern data stack moves data from OLTP source systems through ingestion (Fivetran, Airbyte), into a cloud data warehouse (Snowflake, BigQuery, Redshift), through transformation layers (dbt), and out to BI tools (Tableau, Looker, Power BI). ETL transforms data before loading; ELT loads raw data first and transforms it inside the warehouse using SQL. ELT has become dominant because cloud warehouses are powerful enough to handle large-scale transformation.

BI tools generate SQL automatically — every chart is a query — making relational thinking relevant even for people who never build dashboards themselves. Semantic layers and metrics definitions address the problem of different teams defining the same metric differently.

In an AI-assisted world, AI writes syntax well and handles boilerplate transformation. It cannot know your data, supply business meaning, validate logic, or catch its own errors. The data professional’s value lies in knowing when a query is wrong — a judgment that requires conceptual understanding, not just syntax knowledge. Relational thinking is the durable skill because the underlying model has been stable for 50 years while tools have changed constantly.

* * *

## Key Terms

**OLTP (Online Transaction Processing)** — A type of database system optimized for operational work: many small, fast, concurrent read/write operations on current data. Examples: ticketing systems, banking systems, e-commerce checkout.

**OLAP (Online Analytical Processing)** — A type of database system optimized for analytical work: large queries that scan many rows of historical data to produce summaries and insights. Examples: data warehouses, analytical databases.

**Star schema** — An analytical data model with a central fact table connected to surrounding dimension tables. Optimized for analytical query performance.

**Fact table** — In a star schema, the central table containing measurements (stream events, sales amounts, click counts) and foreign keys to dimension tables.

**Dimension table** — In a star schema, a table providing context for the measurements in the fact table (user attributes, song attributes, date attributes).

**Data warehouse** — A centralized analytical database that consolidates data from multiple source systems, structured and optimized for querying and reporting.

**Data lake** — A large storage repository that holds raw data in its native format, often at very low cost. Flexible but requires strong data governance to remain useful.

**Data swamp** — A data lake that has become disorganized, undocumented, and difficult to use due to poor governance of incoming data.

**Lakehouse** — An architectural pattern combining the cheap, flexible storage of a data lake with the structure, performance, and ACID guarantees of a data warehouse.

**ETL (Extract, Transform, Load)** — A data pipeline process that extracts data from source systems, transforms it into the target format, and loads it into the warehouse. Transformation happens before loading.

**ELT (Extract, Load, Transform)** — A data pipeline process that extracts and loads raw data first, then transforms it inside the warehouse using SQL. Has become dominant in cloud-based stacks.

**dbt (data build tool)** — A widely used tool for managing ELT transformations as version-controlled SQL SELECT statements. A standard part of the modern data stack.

**BI tool (Business Intelligence tool)** — Software that connects to a data warehouse and enables users to build charts, dashboards, and reports. Examples: Tableau, Looker, Power BI.

**Semantic layer** — A centralized layer where metric definitions are maintained once and shared across all reports, ensuring consistency in how key metrics are calculated.

**Data dictionary** — Documentation that defines each table, column, and valid value in a database. Turns cryptic column names and codes into self-explanatory definitions.

**Polyglot persistence** — Using multiple database systems within a single application, each chosen for its strengths. (Also defined in Chapter 12.)

* * *

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

* * *

### Activity 13.1 — Concept Check: The Modern Data Stack

_This activity checks your understanding of the key concepts from Chapter 13. The AI will quiz you one question at a time and give feedback after each answer._

* * *

**Copy and paste this prompt into your AI tool:**

> I’ve just finished reading Chapter 13 of my Introduction to Databases textbook, which covered OLTP vs. OLAP systems, star schemas, the modern data stack (data warehouses, data lakes, lakehouses), ETL vs. ELT, BI tools, and the data professional’s role in an AI-assisted world. I want to check my understanding. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and ask if I’d like to go deeper before moving to the next question.
>
> Here are the questions:
>
> - What is the difference between OLTP and OLAP? Give an example of a query that belongs to each type.
> - Why can’t you efficiently run analytical and transactional workloads on the same database?
> - What is a star schema? Name the two types of tables in a star schema and explain what each contains.
> - What is a data warehouse? How does it differ from an OLTP database?
> - What is a data lake? What is a data swamp, and how does a lake become one?
> - What is the difference between ETL and ELT? Why has ELT become more common with cloud-based data stacks?
> - The chapter says “SQL is under every chart.” What does this mean, and why does it matter for non-technical business users?
> - What is a semantic layer, and what problem does it solve?
> - What can AI do well with data, and what can it not do? Be specific.
> - The chapter says “relational thinking is the durable skill.” What does this mean and why?

* * *

### Activity 13.2 — Apply It: OLTP or OLAP?

_This activity builds your ability to classify database operations and design decisions correctly as transactional or analytical._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m studying the difference between OLTP and OLAP systems. I want to practice classifying scenarios and explaining why they belong to each type. For each scenario below, I’ll identify: (a) Is this an OLTP or OLAP workload? (b) Which system design characteristics make it one or the other? (c) What would go wrong if you tried to run this workload on the wrong type of system?
>
> Please present each scenario one at a time. Wait for my answer, give feedback, and explain the reasoning. Ask if I want to discuss it further before moving on.
>
> Scenario 1: A student clicks “Buy Ticket” on the StreamU concert platform. The system inserts a ticket record, decrements the available seat count, and records the payment — all inside a single transaction.
>
> Scenario 2: The StreamU analytics team wants to know the top 10 most-streamed artists by total listening hours for each semester over the past three years, broken down by university and subscription tier.
>
> Scenario 3: A student updates their profile picture. The system updates one row in the User table.
>
> Scenario 4: A data scientist wants to train a recommendation model using the complete stream history for all 500,000 users — two years of individual stream events.
>
> Scenario 5: When a song starts playing, the system checks whether the user has a valid subscription and whether the song is available in their region. The response must come back in under 100 milliseconds.
>
> Scenario 6: The CFO needs a dashboard showing monthly revenue trends, churn rate by subscription tier, and the average revenue per user for each university, updated daily.
>
> After all six, ask me: If StreamU ran all of these workloads on a single relational OLTP database, what would break first?

* * *

### Activity 13.3 — Practice: Trace the Data Stack

_This activity walks you through a realistic data pipeline from end to end, asking you to identify what happens at each step._

* * *

**Copy and paste this prompt into your AI tool:**

> I’m studying the modern data stack. I want to practice tracing data from its source to a business dashboard. Below is a description of StreamU’s data infrastructure. I’ll walk through a specific piece of data — a single stream event — from the moment a student presses play to when it appears in a chart on the analytics dashboard.
>
> StreamU’s infrastructure:
>
> – OLTP database: PostgreSQL, contains the live User, Song, Artist, and Stream tables
>
> – Data ingestion: Fivetran runs every hour, detecting new rows in the OLTP Stream table and loading them into the warehouse
>
> – Data warehouse: Snowflake, with raw landing tables and curated dbt models (a STREAM\_FACT table and dimension tables)
>
> – dbt models: Transform raw landing data into STREAM\_FACT joined with USER\_DIM, SONG\_DIM, and DATE\_DIM
>
> – BI tool: Looker, connected to Snowflake, with a dashboard showing “Streams by Genre This Week”
>
> Please ask me these questions one at a time about the journey of one stream event:
>
> 1. Where is the stream event first recorded, and in what form?
> 2. How long might it take before that event is visible in the data warehouse? What process moves it there?
> 3. When Fivetran loads the stream event into Snowflake, is it immediately visible in STREAM\_FACT? What has to happen first?
> 4. What SQL does dbt probably run to build STREAM\_FACT? What tables does it join, and what does it output?
> 5. When the Looker dashboard refreshes and shows updated stream counts, what is Looker actually doing behind the scenes?
> 6. If a song’s genre is changed in the OLTP Artist table today, how long will it take for that change to show up in the “Streams by Genre” dashboard? What steps does it need to go through?
>
> After all six questions, give me feedback on how well I understood the pipeline, and point out the step that most students get wrong.

* * *

### Activity 13.4 — Case Study: The Wrong Number on the Dashboard

_This activity puts you in the role of a data analyst investigating a discrepancy between two reports. You’ll need to apply your understanding of the full data stack to diagnose it._

* * *

**Copy and paste this prompt into your AI tool:**

> I want to practice diagnosing a real-world data problem. You’ll play the role of Jordan, the Head of Analytics at StreamU. I’m a data analyst you just hired. It’s my second week on the job.
>
> Here’s the situation: Jordan sent out the weekly business report yesterday showing 2.4 million streams for the week of April 7–13, 2026. This morning, the VP of Product pulled the same metric from the Looker dashboard and got 2.1 million. Now Jordan is calling you (me) to find out why the numbers don’t match.
>
> The relevant information about StreamU’s data infrastructure (which you know and Jordan will share with me as needed):
>
> – The OLTP PostgreSQL database records stream events in real time
>
> – Fivetran syncs new records to Snowflake every hour, with up to a 90-minute lag
>
> – The dbt model for STREAM\_FACT runs at 6 AM daily
>
> – The weekly report Jordan sent was generated manually using a SQL query on Sunday morning (April 14) at 7 AM
>
> – The Looker dashboard uses STREAM\_FACT and refreshes every 24 hours at 6 AM
>
> – The Looker dashboard has a date filter that defaults to “last 7 days” (rolling), not “week of April 7–13” (fixed)
>
> – The dbt STREAM\_FACT model filters out streams under 30 seconds (a business rule to exclude accidental plays for royalty calculations)
>
> – Jordan’s manual SQL query ran directly against the raw OLTP Stream table with no filter on stream duration
>
> Jordan: “Okay, I need you to figure out why these numbers don’t match. What are you going to investigate first?”
>
> Play out the investigation as a dialogue. I’ll ask questions, request data, and propose hypotheses. You respond as Jordan — sharing information as I ask for it, pushing back if my reasoning is wrong, and confirming when I identify the right cause. The goal is for me to correctly identify all the reasons the numbers differ and explain each one clearly.
>
> After I’ve found all the causes, step out of character and give me feedback: Did I think systematically? Did I miss anything? What would a senior analyst have done differently?

## License

![Icon for the Public Domain license](https://pressbooks.marshall.edu/app/themes/pressbooks-book/packages/buckram/assets/images/public-domain.svg)

This work ( [Relational Thinking](https://pressbooks.marshall.edu/mis340) by David Wiley) is free of known copyright restrictions.

## Share This Book

[Share on X](https://pressbooks.marshall.edu/mis340/chapter/data-at-scale-and-the-modern-data-stack/#) [Share on LinkedIn](https://pressbooks.marshall.edu/mis340/chapter/data-at-scale-and-the-modern-data-stack/#) [Share via Email](https://pressbooks.marshall.edu/mis340/chapter/data-at-scale-and-the-modern-data-stack/#)