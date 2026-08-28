# Relational Thinking: A Concepts-First Introduction to Databases for the Age of AI
## Table of Contents

---

### Unit 1: How We Think About Data

**Chapter 1 — Data as a Way of Seeing**

- 1.1 What Is Data, Really?
  - The data–information–knowledge hierarchy
    - Raw facts vs. interpreted meaning vs. actionable insight
    - Why the distinction matters for database design
  - Data as a representation of the world, not the world itself
    - The choices embedded in every act of data collection
    - What gets left out — and why that matters

- 1.2 Why Organizations Structure Data
  - The business case for consistent, structured information
    - Repeatability, comparability, and scale
    - How structure enables automation and analysis
  - The hidden costs of unstructured and inconsistent data
    - Reconciliation work, errors, and lost trust in data
    - Real-world examples of data quality failures

- 1.3 A Brief History of How We've Stored Data
  - From filing cabinets to flat files to relational systems
    - Hierarchical and network models: what came before
    - The limitations that motivated a new approach
  - Why the relational model won
    - Independence between storage and queries
    - The enduring power of a simple abstraction

- 1.4 How This Book Works
  - Concepts before syntax: the philosophy of this course
    - Why understanding comes before tooling
    - What it means to think relationally
  - What you will be able to do — and understand — by the end
    - Skills: designing, querying, evaluating, communicating
    - Fluency: reading AI-generated SQL with informed skepticism

---

**Chapter 2 — Entities, Attributes, and the World as Tables**

- 2.1 Modeling Reality
  - What it means to abstract the world into data
    - Simplification as a feature, not a bug
    - The model is not the territory
  - The choices embedded in every data model
    - Who made this model, and for what purpose?
    - How different stakeholders might model the same domain differently

- 2.2 Entities and Attributes
  - Identifying the things we care about
    - Nouns as entities: customers, orders, products, events
    - How scope and purpose shape entity selection
  - Choosing attributes: what to include, what to leave out
    - Relevance, stability, and cost of collection
    - Avoiding the trap of capturing everything

- 2.3 Tables, Rows, and Columns
  - The anatomy of a relation
    - Columns as attributes, rows as instances
    - Why order doesn't matter (and what that implies)
  - Atomic values and why they matter
    - What "atomic" means: one value per cell
    - The problems caused by lists, concatenations, and embedded structure

- 2.4 The Grain of a Table
  - What does one row represent?
    - Defining grain precisely before adding columns
    - Examples: one row per order vs. one row per order line
  - Grain mismatches and the problems they cause
    - Double-counting in aggregations
    - How grain confusion leads to incorrect analysis

---

**Chapter 3 — Relationships: How Things Connect**

- 3.1 Why Relationships Belong Between Tables
  - The danger of embedding relationships inside a single table
    - Repeating groups, nulls, and structural distortion
    - What it looks like when a relationship is forced into one table
  - Separation of concerns as a design principle
    - Each table models one thing well
    - Relationships are first-class citizens, not afterthoughts

- 3.2 Types of Relationships
  - One-to-many: the most common relationship in business data
    - Examples: customers to orders, departments to employees
    - How to represent it: the foreign key lives on the "many" side
  - Many-to-many: why a third table is usually the answer
    - Examples: students to courses, products to orders
    - The junction table: what it is and what it can carry
  - One-to-one: rare, but worth knowing
    - When one-to-one appears and why it's often a design smell
    - Legitimate uses: security partitioning, optional extensions

- 3.3 The Foreign Key as a Concept
  - How one table references another
    - The foreign key as a pointer, not a copy
    - What "referencing" means at the data level
  - What referential integrity means in plain English
    - You can't reference a row that doesn't exist
    - The database as enforcer of real-world constraints

- 3.4 Recognizing Relationships in the Wild
  - Reading a business process and spotting its relationships
    - Verbs as relationships: "places," "contains," "assigned to"
    - Distinguishing relationships from attributes
  - Practice: mapping relationships in familiar domains
    - A retail scenario, a university scenario, a healthcare scenario
    - What changes across domains — and what stays the same

---

### Unit 2: Relational Thinking

**Chapter 4 — The Relational Model**

- 4.1 Codd's Insight: Data as Sets
  - Why treating data as sets (not sequences) was revolutionary
    - Position doesn't matter; membership does
    - Operations on sets: union, intersection, difference
  - The mathematical foundations without the math
    - Enough set theory to reason clearly
    - Why this foundation makes the model provably correct

- 4.2 Relations, Tuples, and Attributes
  - Precise vocabulary for imprecise ideas
    - Relation = table, tuple = row, attribute = column
    - Why precision in language prevents confusion in design
  - Why terminology matters when communicating across teams
    - Speaking the same language as developers and architects
    - Terminology as a signal of fluency

- 4.3 Keys and Uniqueness
  - Candidate keys, primary keys, and surrogate keys
    - Natural keys: meaningful but fragile
    - Surrogate keys: stable but opaque
  - The role of uniqueness in guaranteeing data integrity
    - No two rows can be identical in a true relation
    - How the primary key enforces this guarantee

- 4.4 Integrity Rules
  - Entity integrity: no null primary keys
    - Why a row without an identity is meaningless
    - Practical implications for data entry and import
  - Referential integrity: foreign keys must point somewhere real
    - Orphaned records and the problems they cause
    - How the database enforces this automatically
  - Domain integrity: values must be valid
    - Data types, constraints, and allowed ranges
    - The database as the last line of defense against bad data

---

**Chapter 5 — Normalization as a Design Philosophy**

- 5.1 The Problem: Redundancy and Its Costs
  - What redundant data looks like in practice
    - The "everything in one spreadsheet" anti-pattern
    - Spotting redundancy before it causes problems
  - Update, insert, and delete anomalies
    - Update anomaly: changing one fact requires changing many rows
    - Insert anomaly: you can't record something without recording something else
    - Delete anomaly: deleting one fact destroys another

- 5.2 Functional Dependencies
  - What it means for one attribute to determine another
    - A → B: knowing A tells you B
    - Examples from business data: ZIP code → city, employee ID → department
  - Spotting functional dependencies in a table
    - The smell test: "does this column really belong here?"
    - Drawing a dependency diagram before normalizing

- 5.3 The Normal Forms
  - First Normal Form: atomicity and repeating groups
    - Every attribute must contain a single, indivisible value
    - Eliminating lists and nested structures
  - Second Normal Form: eliminating partial dependencies
    - Every non-key attribute must depend on the whole key
    - Only relevant when the key is composite
  - Third Normal Form: eliminating transitive dependencies
    - Non-key attributes must depend on the key, not on each other
    - The classic example: storing both ZIP code and city

- 5.4 Normalization as Judgment, Not Formula
  - When to normalize and when to stop
    - 3NF is usually enough for transactional systems
    - Signs that you've over-normalized
  - Denormalization and the performance trade-off
    - Analytical systems often deliberately denormalize
    - How to document intentional denormalization decisions

---

**Chapter 6 — Data Modeling in Practice**

- 6.1 Entity-Relationship Diagrams as a Communication Tool
  - Why ER diagrams exist: bridging business and technical perspectives
    - The diagram as a shared language, not a technical artifact
    - Who should be in the room when you draw one
  - Reading and drawing ER diagrams
    - Crow's foot notation: entities, attributes, cardinality
    - Minimum and maximum cardinality: mandatory vs. optional

- 6.2 From Business Narrative to ER Diagram
  - Extracting entities and relationships from a prose description
    - Underlining nouns and verbs as a starting technique
    - What to do when the narrative is ambiguous
  - Resolving ambiguity in business requirements
    - Asking the right clarifying questions
    - Documenting assumptions explicitly

- 6.3 From ER Diagram to Relational Schema
  - Translating entities into tables
    - One entity → one table (usually)
    - Attributes become columns; identifier becomes primary key
  - Handling many-to-many relationships with junction tables
    - What columns the junction table carries
    - When the junction table becomes an entity in its own right

- 6.4 Design Critique and Iteration
  - What good design looks like — and what bad design looks like
    - Clarity, consistency, minimal redundancy, enforced integrity
    - Red flags: catch-all tables, columns named "other," nullable foreign keys
  - Revising a model when the requirements change
    - Additive changes vs. breaking changes
    - Why good initial design makes iteration cheaper

---

### Unit 3: Asking Questions of Data

**Chapter 7 — Query Thinking: What Do You Want to Know?**

- 7.1 Starting with the Business Question
  - Why "what SQL do I write?" is the wrong first question
    - Syntax is the last step, not the first
    - The cost of writing a query before understanding the question
  - Translating business questions into data operations
    - "Which customers have placed more than three orders this year?"
    - Breaking the question into filtering, joining, aggregating steps

- 7.2 The Core Operations of Relational Thinking
  - Filtering: keeping only the rows you care about
    - Conditions on attributes: equality, ranges, membership
    - Filtering before or after joining: order matters
  - Projecting: keeping only the columns you care about
    - Why returning fewer columns is almost always better
    - Projection as a form of privacy and clarity
  - Joining: combining information across tables
    - Matching rows from two tables on a shared key
    - What happens when the join key is wrong or missing
  - Aggregating: summarizing many rows into fewer
    - Collapsing detail into summary: COUNT, SUM, AVG
    - What you lose when you aggregate — and when that's fine

- 7.3 Relational Algebra as Intuition
  - The select, project, and join operations in plain language
    - Select = filter, project = column selection, join = merge
    - Composing operations: the output of one is the input of the next
  - Thinking in sets before thinking in syntax
    - A query as a pipeline of set transformations
    - Visualizing the shape of data at each step

- 7.4 Planning a Query Before Writing It
  - Sketching the result before writing the code
    - Draw the columns you want in the output
    - Work backward to find which tables supply them
  - Identifying which tables you need and how they connect
    - The join path: tracing foreign keys from table to table
    - What to do when the path is long or ambiguous

---

**Chapter 8 — Introduction to SQL with AI Assistance**

- 8.1 What SQL Is and How It Relates to Relational Thinking
  - SQL as a language for expressing relational operations
    - SELECT = project, WHERE = filter, JOIN = join, GROUP BY = aggregate
    - SQL is declarative: you say what you want, not how to get it
  - Declarative vs. procedural thinking
    - Why the database engine, not you, decides how to execute the query
    - The implication: understanding results, not optimizing execution

- 8.2 Your First Queries: SELECT, FROM, WHERE
  - Filtering and projecting in SQL
    - Basic SELECT syntax and common mistakes
    - WHERE conditions: comparison operators, AND, OR, NOT
  - Reading query results critically
    - Does the row count make sense?
    - Spot-checking results against known facts

- 8.3 Using AI to Write SQL
  - How to prompt an AI assistant effectively
    - Providing schema context: table names, column names, relationships
    - Being specific about the business question, not the SQL you expect
  - Translating a business question into a precise prompt
    - The anatomy of a good SQL prompt
    - Iterating with the AI when the first result is wrong

- 8.4 Verifying AI-Generated SQL
  - Why conceptual fluency is required to catch AI mistakes
    - The AI doesn't know your data — it knows syntax
    - Common AI failure modes: wrong joins, missing filters, incorrect aggregation
  - A checklist for reviewing queries you didn't write
    - Does the FROM clause include all needed tables?
    - Is every join condition correct and complete?
    - Does the result grain match what you asked for?

---

**Chapter 9 — Joins and Aggregation**

- 9.1 Why Joins Are the Heart of Relational Thinking
  - The join as the practical payoff of the relational model
    - Normalization splits data apart; joins bring it back together
    - The join is not a workaround — it's the design
  - What happens when you join incorrectly
    - Cartesian products: the silent killer of query results
    - Fan traps and chasm traps: when joins multiply or drop rows

- 9.2 Types of Joins
  - INNER JOIN: only matching rows
    - When unmatched rows should be excluded
    - The risk: silently dropping data you wanted
  - LEFT JOIN: all rows from one side, matches from the other
    - When you need to preserve unmatched rows
    - NULLs in the result and what they mean
  - When to use which, and why it matters
    - The business question determines the join type
    - Testing join type choices with small, known datasets

- 9.3 Aggregation and Grouping
  - COUNT, SUM, AVG, MIN, MAX as business operations
    - Choosing the right aggregation for the question
    - NULL behavior in aggregate functions
  - GROUP BY and HAVING: summarizing subsets of data
    - GROUP BY: one output row per group
    - HAVING vs. WHERE: filtering before vs. after aggregation

- 9.4 AI-Assisted Join and Aggregation Queries
  - Prompting strategies for complex queries
    - Describing the join path explicitly in the prompt
    - Specifying the expected grain of the result
  - Recognizing when an AI join is logically wrong
    - Row count sanity checks
    - Comparing aggregated results against known totals

---

### Unit 4: Database Design for Real Problems

**Chapter 10 — Designing for a Business Domain**

- 10.1 From Narrative to Schema: An End-to-End Walk-Through
  - Reading a business description and identifying design decisions
    - What is being tracked, by whom, and for what purpose?
    - Separating stable facts from transient states
  - The iterative nature of database design
    - First drafts are always wrong — that's fine
    - How to use feedback loops to improve a schema

- 10.2 Common Design Patterns
  - Orders and line items
    - The header-detail pattern and why it's everywhere
    - Capturing price at time of order vs. current price
  - Users, roles, and permissions
    - Many-to-many between users and roles
    - Audit columns: created_at, created_by, updated_at
  - Events, logs, and time-series data
    - Append-only tables and their characteristics
    - Querying temporal data: snapshots vs. current state

- 10.3 Spotting and Fixing Poor Designs
  - Red flags in an existing schema
    - Columns named "misc," "notes," or "data"
    - Tables with hundreds of nullable columns
  - Refactoring a bad design without losing data
    - Migration strategies: additive first, destructive last
    - Testing that refactored queries return identical results

- 10.4 Communicating Design Decisions
  - Explaining your schema choices to non-technical stakeholders
    - Translating "junction table" into business language
    - When to show the ER diagram and when to hide it
  - Using ER diagrams as documentation
    - Keeping the diagram in sync with the schema
    - The diagram as an onboarding tool for new team members

---

**Chapter 11 — Data Integrity and Constraints**

- 11.1 Constraints as Encoded Business Rules
  - NOT NULL: when absence of data is a problem
    - Distinguishing "unknown" from "not applicable"
    - The cost of over-using NULLs
  - UNIQUE and CHECK: enforcing valid values
    - UNIQUE constraints beyond the primary key
    - CHECK constraints as embedded business logic

- 11.2 Referential Integrity in Practice
  - Foreign key constraints and what happens when they're violated
    - Insertion order matters: parent before child
    - The database error as a helpful message, not an obstacle
  - Cascading updates and deletes
    - ON DELETE CASCADE: convenient but dangerous
    - ON DELETE RESTRICT: safe but requiring explicit cleanup

- 11.3 Transactions and ACID Properties
  - What a transaction is and why it matters
    - The bank transfer example: both legs or neither
    - Transactions as all-or-nothing units of work
  - Atomicity, Consistency, Isolation, Durability as business concepts
    - Atomicity: no partial updates
    - Consistency: the database moves from one valid state to another
    - Isolation: concurrent transactions don't interfere
    - Durability: committed data survives system failure

- 11.4 When Integrity Fails
  - Real-world consequences of integrity violations
    - Orphaned records, phantom totals, broken reports
    - High-profile examples of data integrity failures
  - Defensive design: anticipating bad data
    - Designing for the worst-case input, not the ideal input
    - Application-level vs. database-level enforcement

---

### Unit 5: Beyond the Relational Model

**Chapter 12 — When Relational Isn't Enough**

- 12.1 The Limits of the Relational Model
  - Schemas that change, data that doesn't fit tables, scale that overwhelms
    - The impedance mismatch between objects and tables
    - When joins become too expensive to be practical
  - Why NoSQL emerged — and what problem it was solving
    - Web-scale data: billions of users, millions of writes per second
    - The trade-offs NoSQL systems explicitly accept

- 12.2 NoSQL Data Models
  - Document stores: data as self-describing objects
    - JSON documents: flexible schema, nested structure
    - When documents are the right unit: user profiles, product catalogs
  - Key-value stores: simplicity at extreme scale
    - The simplest possible data model: a dictionary
    - Use cases: session state, caching, leaderboards
  - Graph databases: when relationships are the data
    - Nodes and edges as first-class citizens
    - Use cases: social networks, fraud detection, recommendation engines
  - Columnar stores: optimized for analytical reads
    - Storing data by column rather than by row
    - Why this is dramatically faster for aggregation at scale

- 12.3 JSON in a Relational World
  - Semi-structured data in modern relational databases
    - JSON columns in PostgreSQL, MySQL, SQL Server
    - Querying inside a JSON column with SQL
  - When to use JSON columns and when to normalize instead
    - JSON is appropriate when structure varies unpredictably
    - The danger: losing integrity guarantees inside JSON

- 12.4 Choosing a Data Model
  - A decision framework: relational vs. NoSQL
    - Questions to ask: How structured is the data? How often does it change? What queries will dominate?
    - Default to relational; deviate with a reason
  - Polyglot persistence: using multiple models together
    - The modern application uses several databases for different purposes
    - The data professional's job: knowing which tool to use when

---

**Chapter 13 — Data at Scale and the Modern Data Stack**

- 13.1 OLTP vs. OLAP: Two Different Jobs
  - Transactional systems: optimized for writes
    - Many small, fast, concurrent operations
    - Normalized schemas reduce write overhead
  - Analytical systems: optimized for reads across large datasets
    - Few large, slow, sequential scans
    - Denormalized schemas and pre-aggregation improve read performance

- 13.2 The Modern Data Stack
  - Data warehouses, data lakes, and lakehouses
    - Warehouse: structured, curated, query-optimized
    - Lake: raw, unstructured, cheap storage at scale
    - Lakehouse: the attempt to get both
  - ETL and ELT: moving data between systems
    - Extract-Transform-Load vs. Extract-Load-Transform
    - Why ELT has become dominant and what it implies

- 13.3 How BI Tools Connect to Data
  - What happens between a database and a dashboard
    - The query layer: SQL under every chart
    - Semantic layers and metrics definitions
  - The database professional's role in the analytics pipeline
    - Designing for queryability, not just storage
    - Documenting tables so analysts can find what they need

- 13.4 The Data Professional in an AI-Assisted World
  - What AI can and cannot do with data
    - AI writes syntax; humans supply meaning and judgment
    - The value of knowing when a query is logically wrong
  - Why relational thinking remains the durable skill
    - Tools change; the underlying model has been stable for 50 years
    - Fluency in the model transfers across every tool that implements it

---

### Unit 6: Synthesis

**Chapter 14 — Capstone and the Future of Data Work**

- 14.1 What You Now Know How to Do
  - A review of the conceptual arc: from entities to queries to design
    - The through-line: every concept served the ability to model and question data
    - Self-assessment: what can you now do that you couldn't before?
  - The difference between knowing SQL and thinking relationally
    - Syntax is learnable in a weekend; the mental model takes longer
    - Why employers value the mental model more than the syntax

- 14.2 Capstone Project Discussion
  - Presenting and critiquing database designs
    - What to look for in a peer's schema
    - How to give design feedback that is specific and constructive
  - What separates a good design from a great one
    - Correctness is the floor, not the ceiling
    - Clarity, maintainability, and fitness for purpose

- 14.3 Data Literacy as a Professional Skill
  - Reading and questioning data in any context
    - Asking "where does this number come from?" as a professional reflex
    - Recognizing when a report is hiding something in its grain or filter
  - Communicating with technical teams as an informed stakeholder
    - The business analyst who can read a schema is worth more than one who can't
    - Speaking enough of the language to ask the right questions

- 14.4 Where to Go From Here
  - Advanced SQL, data engineering, analytics, and database administration
    - Window functions, CTEs, query optimization
    - Data pipelines, orchestration, and data quality at scale
  - Staying current as tools and AI capabilities evolve
    - The AI will keep getting better at syntax; double down on judgment
    - Communities, certifications, and continuing education
