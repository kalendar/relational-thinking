# Chapter 11: Data Integrity and Constraints

---

A database without integrity controls is just a place to put data. Data can go in wrong. It can point to things that don't exist. It can contradict itself. And the system will accept it all without complaint.

Most data problems in real organizations don't come from software bugs or hardware failures. They come from bad data entering the system in the first place — a ticket sold for a negative price, a foreign key pointing to a deleted customer, an order recorded without a date, a transaction that half-completed before the system crashed. These aren't exotic edge cases. They're the normal, daily grind of data at scale.

Constraints are how the database fights back. A **constraint** is a rule that the database enforces automatically, regardless of what the application layer does or doesn't check. When data violates a constraint, the database refuses the operation and returns an error. The data doesn't go in. The problem is caught at the source, not discovered weeks later when someone runs a report and gets a wrong answer.

This chapter covers the main types of constraints — NOT NULL, UNIQUE, CHECK, and foreign key — and then moves to the deeper concept of **transactions**: the mechanism that ensures a group of related operations either all succeed or all fail together. Together, constraints and transactions are the foundation of database integrity.

---

## 11.1 Constraints as Encoded Business Rules

Every constraint in a database schema is a business rule translated into enforcement logic. "A ticket must have a price" becomes a NOT NULL constraint. "No two users can have the same email address" becomes a UNIQUE constraint. "A ticket price must be greater than zero" becomes a CHECK constraint. The rule is the same; the constraint is what makes it automatic.

This framing matters because it shifts how you think about designing constraints. You're not adding technical scaffolding — you're encoding knowledge about your business domain into the database itself. That knowledge stays there even when the application layer changes, even when a new developer joins the team, even when someone bypasses the application and writes directly to the database with a script.

### NOT NULL: when absence of data is a problem

A **NOT NULL constraint** on a column means that column must have a value in every row. The database will reject any INSERT or UPDATE that leaves the column empty.

```sql
CREATE TABLE Ticket (
    ticket_id     INT          NOT NULL,
    student_id    INT          NOT NULL,
    concert_id    INT          NOT NULL,
    price_paid    DECIMAL(8,2) NOT NULL,
    purchase_date DATE         NOT NULL
);
```

Every column here is NOT NULL. Every ticket must identify the student who bought it, the concert it's for, the price paid, and when the purchase happened. Without any of these facts, the ticket record is incomplete in a way that matters for the business.

NOT NULL sounds simple, but applying it requires judgment. The question isn't "can this column ever be empty?" — it's "is this column required to make the row meaningful?"

Consider a `middle_name` column on a User table. Some people don't have middle names. NULL is a legitimate value here because NULL means "this person has no middle name" (or "we don't know their middle name"). Requiring a value would force you to store something like "N/A" or leave the column filled with a dummy value, which is worse than NULL.

Now consider `email` on the same table. Can a user have no email? If your system uses email for login, the answer is no — a User row without an email is meaningless in your domain. NOT NULL is correct.

The key distinction: **NULL means "unknown" or "not applicable."** If those meanings make sense for the column — if some rows legitimately have no value — allow NULL. If absence of a value makes the row invalid or unusable, require NOT NULL.

### Distinguishing "unknown" from "not applicable"

NULL actually covers two distinct situations that are conceptually different but technically identical:

**Unknown:** The value exists in the real world, but we don't have it. A student's GPA at the start of their first semester is unknown — they have a GPA category (they're a student), but we don't know the number yet. 

**Not applicable:** The column doesn't apply to this row at all. A dog's maiden name is not applicable — the concept doesn't exist for that entity.

Both map to NULL in SQL, which can create ambiguity. If `secondary_email` is NULL, does it mean "we don't know their secondary email" or "they don't have one"? The difference matters when you're filtering — if you want users who have no secondary email, NULL means different things depending on which interpretation is correct.

When this ambiguity matters, the fix is usually to add a boolean column that makes the state explicit: `has_secondary_email BOOLEAN NOT NULL DEFAULT false`. Then NULL in `secondary_email` unambiguously means "they don't have one" rather than "we don't know."

### The cost of over-using NULLs

Allowing NULL everywhere feels permissive and flexible. In practice, it creates problems:

**Queries become more complex.** SQL's NULL handling is counterintuitive. `NULL = NULL` evaluates to NULL (not TRUE), so standard equality checks don't work. You need `IS NULL` and `IS NOT NULL`. Forgetting this is one of the most common sources of silent query errors.

**Aggregates silently exclude NULLs.** As we saw in Chapter 9, aggregate functions skip NULL values. If 20% of your rows have NULL in a column you're averaging, your average is calculated on the other 80% — and nothing tells you this happened.

**NULLs propagate.** Any arithmetic involving NULL produces NULL. `100 + NULL = NULL`. If a revenue calculation pulls a NULL from one column, the whole expression evaluates to NULL — and you might not notice.

**Columns that could be NOT NULL but aren't** are the most insidious case. If you allow NULL in `purchase_date` on a Ticket table, someone will eventually insert a ticket without a date. That ticket will then be invisible to any date-filtered report. The report looks right — it has a row count, it has totals — but those tickets aren't in the numbers. This is how databases silently give you wrong answers.

The principle: **be as strict as the business rules allow.** If a column is required, enforce it with NOT NULL. Prefer explicit defaults (DEFAULT 0, DEFAULT '') over nullable columns where the business never actually intends NULL. Reserve NULL for genuinely optional data where absence is meaningful.

### UNIQUE: enforcing valid identifiers

A **UNIQUE constraint** ensures that no two rows in a table have the same value in the specified column (or combination of columns). Unlike a primary key, a UNIQUE column can allow NULLs (depending on the database — in most systems, multiple NULLs are allowed in a UNIQUE column, since NULL ≠ NULL).

```sql
CREATE TABLE Student (
    student_id    INT          NOT NULL PRIMARY KEY,
    mu_id         VARCHAR(9)   NOT NULL UNIQUE,   -- e.g., "100123456"
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL
);
```

Both `mu_id` and `email` have UNIQUE constraints. You can't register two students with the same university ID or the same email address. The database enforces this at the point of insertion or update.

UNIQUE constraints are useful beyond just candidate key columns. Consider:

- A concert venue might require that no two events be scheduled at the same venue on the same date: `UNIQUE(venue_id, concert_date)`
- A user role assignment table might require that a user can only be assigned the same role once: `UNIQUE(user_id, role_id)`
- A playlist might require that the same song doesn't appear twice: `UNIQUE(playlist_id, song_id)`

Multi-column UNIQUE constraints (called composite unique constraints) enforce uniqueness on the *combination* of values, not on each column individually. `UNIQUE(venue_id, concert_date)` allows the same venue to host multiple concerts on different dates, and allows multiple venues to have events on the same date — just not the same venue on the same date.

### CHECK: embedding business logic directly in the schema

A **CHECK constraint** evaluates an expression against a row's data and rejects the row if the expression is false. CHECK constraints let you encode business rules as conditions that the database tests automatically on every INSERT and UPDATE.

```sql
CREATE TABLE Ticket (
    ticket_id     INT          NOT NULL PRIMARY KEY,
    student_id    INT          NOT NULL,
    concert_id    INT          NOT NULL,
    price_paid    DECIMAL(8,2) NOT NULL CHECK (price_paid >= 0),
    purchase_date DATE         NOT NULL,
    quantity      INT          NOT NULL CHECK (quantity BETWEEN 1 AND 10)
);
```

The CHECK constraints here encode two business rules:
- Tickets cannot have a negative price
- A single purchase can include between 1 and 10 tickets

These rules are now enforced by the database, not just by the application. Even if a developer writes a buggy script that generates negative-priced tickets, the database will reject them.

More CHECK constraint examples:

```sql
-- Subscription tier must be one of the allowed values
subscription_tier VARCHAR(20) NOT NULL 
    CHECK (subscription_tier IN ('free', 'student', 'premium', 'family'))

-- End date must be after start date
concert_end_time TIME NOT NULL,
CHECK (concert_end_time > concert_start_time)

-- Rating must be between 1 and 5
rating INT CHECK (rating BETWEEN 1 AND 5)  -- allows NULL (optional rating)

-- Email must contain an @ symbol (basic validation)
email VARCHAR(255) NOT NULL CHECK (email LIKE '%@%')
```

### The database as the last line of defense

Together, NOT NULL, UNIQUE, and CHECK constraints form a defensive layer around your data. They're not a substitute for validation in the application layer — you still want your web form to show users a helpful error message before they hit the database. But application-layer validation can be bypassed, misconfigured, or simply not present in every code path that writes to the database.

Constraints at the database level catch everything — every INSERT and UPDATE, from every source, from every application, from every developer script, from every data import. The database is the last line of defense, and it defends consistently.

When data violates a constraint, you get a database error, not a wrong answer. That's a feature, not a bug. An error you can see and fix is better than corrupt data that silently propagates through your reports.

---

## 11.2 Referential Integrity in Practice

Constraints like NOT NULL, UNIQUE, and CHECK operate on individual column values. **Referential integrity** operates on *relationships between tables*: it ensures that a foreign key value in one table actually points to an existing row in the referenced table.

Without referential integrity, you can insert a Ticket with a `student_id` of 99999 even if no Student with `student_id = 99999` exists. You've created an **orphaned record** — a row that references nothing. That ticket can't be joined to a Student. It won't show up in reports that join Ticket to Student. It's invisible garbage in your database.

Foreign key constraints are the mechanism that prevents this.

### Foreign key constraints and what happens when they're violated

When you define a foreign key with a constraint, the database checks that the referenced value exists before allowing the operation:

```sql
CREATE TABLE Ticket (
    ticket_id     INT NOT NULL PRIMARY KEY,
    student_id    INT NOT NULL REFERENCES Student(student_id),
    concert_id    INT NOT NULL REFERENCES Concert(concert_id),
    price_paid    DECIMAL(8,2) NOT NULL CHECK (price_paid >= 0),
    purchase_date DATE NOT NULL
);
```

The `REFERENCES` keyword creates a foreign key constraint. Now:

- You cannot insert a Ticket with a `student_id` that doesn't exist in the Student table → INSERT is rejected
- You cannot delete a Student who has existing tickets → DELETE is rejected (by default)
- You cannot update a `student_id` to a value that doesn't exist in Student → UPDATE is rejected

Each of these restrictions enforces a real-world rule: a ticket must belong to a real student, and a student can't be removed from the system while they have active records that reference them.

### Insertion order matters: parent before child

When working with foreign keys, you must insert the "parent" record before the "child" record that references it. In our schema:

1. Insert Venue first (no foreign keys)
2. Insert Concert second (references Venue)
3. Insert Student (no foreign keys)
4. Insert Ticket last (references both Concert and Student)

If you try to insert a Ticket before the Concert or Student exists, the database rejects it with a foreign key violation error. This isn't an obstacle — it's the constraint working correctly. The error tells you that you're trying to create a relationship to something that doesn't exist yet.

When loading data in bulk (such as importing from a spreadsheet), this order matters. A common import failure is trying to load records in alphabetical table order rather than dependency order. The fix: always analyze the foreign key relationships and load parent tables before child tables.

### The database error as a helpful message

Foreign key violations and other constraint errors are often experienced as frustrating obstacles, especially by developers who are new to relational databases. This framing gets it backwards.

A constraint violation error means: *"You just tried to put bad data in the database, and I stopped you."* The error is the database doing its job. The alternative — no constraint, no error, bad data inserted — is much worse. You'd rather have an error message now than an incorrect report six months from now.

Learning to read database error messages is a practical skill. A foreign key violation error typically tells you:
- Which table the violation occurred in
- Which foreign key constraint was violated
- What value you tried to insert that didn't have a matching parent

That information is enough to diagnose the problem: either the parent record doesn't exist yet (insert it first), or the foreign key value is wrong (find the correct ID).

### Cascading updates and deletes

What should happen when you delete a Student who has existing Tickets? By default, most databases reject the DELETE with a foreign key violation. But you have options.

**ON DELETE RESTRICT** (the default in most databases): The DELETE is rejected if any child rows reference the parent. You must delete the child rows first, then the parent.

**ON DELETE CASCADE**: When you delete the parent, the database automatically deletes all child rows that reference it. Delete a Student, and all their Tickets are deleted automatically.

**ON DELETE SET NULL**: When you delete the parent, the database sets the foreign key column in child rows to NULL. Delete a Student, and all Tickets have their `student_id` set to NULL (only works if the column allows NULL).

**ON DELETE SET DEFAULT**: Sets the foreign key to its default value when the parent is deleted.

```sql
-- Example: cascading delete
CREATE TABLE Ticket (
    ticket_id     INT NOT NULL PRIMARY KEY,
    student_id    INT REFERENCES Student(student_id) ON DELETE CASCADE,
    concert_id    INT NOT NULL REFERENCES Concert(concert_id),
    price_paid    DECIMAL(8,2) NOT NULL,
    purchase_date DATE NOT NULL
);
```

### ON DELETE CASCADE: convenient but dangerous

Cascading deletes feel convenient. Delete the parent, and all the children disappear automatically. No orphans, no cleanup needed.

But they're also a source of accidental data loss. If you delete a Student record — perhaps because you thought it was a test account, or because you were cleaning up duplicates — and that student has 50 ticket purchases in the database, all 50 tickets silently disappear. You may not even realize what happened.

The risk is highest in complex schemas with multiple levels of cascading. If deleting a User cascades to delete their Orders, which cascades to delete Order Lines, which cascades to delete something else — a single DELETE statement can remove thousands of rows across multiple tables in an instant.

**The safer default is ON DELETE RESTRICT.** When a DELETE is blocked by a foreign key constraint, the error message forces you to think about what you're doing. Maybe the right action is to mark the student as inactive (add an `is_active` flag) rather than deleting the record at all. Soft deletion — setting a flag rather than actually deleting — is often the right approach for records that have history attached to them.

**ON DELETE CASCADE is appropriate when:** the child rows have no independent meaning without the parent, and you are certain that deleting the parent is always the right time to delete the children. Example: if you delete a concert that was just created in error and has no tickets yet, it's fine to cascade-delete the ConcertPerformer rows that link it to performers.

---

## 11.3 Transactions and ACID Properties

Constraints protect individual rows and relationships. But many business operations require multiple changes to the database, and those changes need to succeed or fail together.

Think about what happens when a student buys a ticket. In our system, that involves:
1. Inserting a new row into the Ticket table
2. Updating the available ticket count on the Concert table (decreasing it by 1)
3. Recording the payment in a Payment table

What if the system inserts the Ticket row and updates the Concert count — but then crashes before recording the payment? The database is now in an inconsistent state: a ticket exists and a seat is reserved, but no payment has been recorded. The student has a ticket they didn't pay for. Or the payment went through but the ticket wasn't issued. Either way, the data is wrong.

This is exactly the problem that **transactions** solve.

### What a transaction is and why it matters

A **transaction** is a sequence of database operations that the database treats as a single unit. Either all the operations succeed and are permanently recorded, or none of them take effect. There is no in-between state visible to the rest of the system.

In SQL, a transaction begins with `BEGIN` (or `START TRANSACTION`) and ends with either `COMMIT` (make it permanent) or `ROLLBACK` (undo everything since BEGIN):

```sql
BEGIN;

-- Step 1: Create the ticket
INSERT INTO Ticket (student_id, concert_id, price_paid, purchase_date)
VALUES (42, 7, 25.00, '2026-04-01');

-- Step 2: Decrease available seats
UPDATE Concert
SET seats_available = seats_available - 1
WHERE concert_id = 7;

-- Step 3: Record the payment
INSERT INTO Payment (ticket_id, amount, payment_method, payment_date)
VALUES (LASTVAL(), 25.00, 'credit_card', '2026-04-01');

COMMIT;  -- All three changes become permanent
```

If anything goes wrong between BEGIN and COMMIT, you can issue a ROLLBACK — or the database will automatically roll back if the connection is lost. The ticket doesn't get created, the seat count isn't decremented, and no payment is recorded. The database returns to the state it was in before the transaction began.

### The classic example: the bank transfer

The canonical example for transactions is a bank transfer. Moving $500 from Account A to Account B requires two operations:
1. Subtract $500 from Account A
2. Add $500 to Account B

If only step 1 succeeds — the money leaves A but never arrives at B — $500 has vanished. If only step 2 succeeds — money appears in B but A wasn't debited — $500 has been created from nothing. Both outcomes are catastrophically wrong.

A transaction ensures that either both operations happen (the transfer succeeds) or neither does (the transfer fails cleanly and no money moves). There is no partial outcome.

This is the foundational insight behind transactions: some operations are only meaningful as a group. Doing half of them isn't half-right; it's wrong.

### ACID: the four guarantees

Databases provide a set of four guarantees about transaction behavior, summarized with the acronym **ACID**. Each property addresses a specific category of failure.

**Atomicity** — the transaction is all or nothing.

If any part of a transaction fails, the entire transaction is rolled back. No partial changes are left in the database. From the database's perspective, either the transaction happened completely or it didn't happen at all.

Business analogy: buying a concert ticket is atomic. You don't "partially buy" a ticket. Either the purchase goes through — ticket issued, payment recorded, seats decremented — or it doesn't go through and nothing changes.

**Consistency** — the database moves from one valid state to another.

Every transaction takes the database from a state where all constraints and rules are satisfied to another state where all constraints and rules are still satisfied. A transaction that would violate a constraint cannot be committed. The database is never left in an inconsistent state.

Business analogy: a concert can't have more tickets sold than its capacity. A transaction that would cause `tickets_sold > capacity` is rejected. The database enforces this consistency rule as part of the transaction.

**Isolation** — concurrent transactions don't interfere with each other.

If two students try to buy the last available ticket at the same moment, isolation ensures they don't both succeed. Each transaction sees a consistent snapshot of the database, and the database manages concurrent access so that the final state reflects what would have happened if the transactions had run one at a time.

Without isolation, two transactions could both read "1 seat remaining," both decide to sell it, and both complete — resulting in -1 seats available and two tickets issued for one seat.

Business analogy: two cashiers at a concert box office can't sell the same physical ticket to two different people. They each hold one at a time, check it out, and return it (or keep it sold) before the next cashier can touch it.

**Durability** — committed data survives system failure.

Once a transaction is committed, the changes are permanent. Even if the server crashes a millisecond after the COMMIT, the data is preserved. Databases achieve this by writing committed transactions to durable storage (disk) before returning a success response.

Business analogy: a ticket purchase that went through is yours, even if the ticketing website goes down right after you buy it. The record of your purchase is permanent.

### ACID in everyday terms

You don't need to think about ACID explicitly every time you write a query. Database systems implement these guarantees automatically. But understanding them helps you reason about what the database is doing and why certain behaviors exist.

- If you see an error and your changes "disappeared," that's atomicity working: the transaction was rolled back.
- If you get a constraint violation error, that's consistency working: your transaction would have violated a rule.
- If two users experience a conflict when both try to update the same record, that's isolation managing concurrent access.
- If data you committed yesterday is still there after a server restart, that's durability.

ACID properties are why you trust a database with financial records, medical data, and other information where being wrong has real consequences. A spreadsheet doesn't have these guarantees. A text file doesn't. A relational database does.

---

## 11.4 When Integrity Fails

Constraints and transactions are powerful, but they're not always in place. Legacy databases, imported data, poorly designed applications, and misconfigured systems can all allow bad data into a database. Understanding what integrity failures look like — and how to recognize and address them — is a practical skill.

### Real-world consequences of integrity violations

**Orphaned records.** A foreign key without a constraint can produce orphaned records — rows that reference something that no longer exists. 

Consider: a student withdraws from school, and an administrator deletes their Student record. But no one thought to delete the student's Ticket records (because there was no ON DELETE RESTRICT to enforce the cleanup). Now the Ticket table has rows with `student_id` values that point to nothing. Queries that join Ticket to Student will silently exclude these tickets. A count of "tickets sold" will be higher than a count of "tickets sold to enrolled students" — but not obviously so.

**Phantom totals.** When data is inconsistent, aggregation queries produce numbers that look correct but aren't. A sum of revenues that should equal $125,000 returns $119,800 — but no error message explains why. The $5,200 difference is in tickets attached to students who no longer exist, or tickets with NULL prices that were excluded from the SUM, or events that were double-counted because of grain problems in the query.

These phantom totals are among the most damaging forms of data corruption because they're invisible. Reports look right. Dashboards display numbers. Decisions get made based on those numbers. The numbers are wrong.

**Broken reports.** A report that joins three tables correctly will silently drop rows if some rows have foreign key values that reference nonexistent parents. The report author doesn't know the rows were dropped. The business stakeholder doesn't know the numbers are low. Everyone acts as if the report is accurate.

### High-profile examples of data integrity failures

Data integrity failures have caused serious real-world harm. A few well-known examples:

In 1996, the Mars Climate Orbiter was lost because one engineering team used imperial units and another used metric. The data entering their shared system had no unit validation — no constraint that would have caught the inconsistency. The spacecraft disintegrated entering the Martian atmosphere.

Healthcare databases with orphaned patient records have led to incorrect medication dosages, missed allergies, and billing for services rendered to "ghost" patients. The underlying data problem: records updated or deleted in one table without corresponding updates in related tables.

Financial systems without transaction integrity have produced situations where money was debited from one account but never credited to another — or credited without being debited — due to partial system failures between the two operations.

These aren't cautionary tales about exotic technical failures. They're consequences of missing the basics: constraints that validate values, foreign keys that enforce relationships, and transactions that keep related operations together.

### Defensive design: anticipating bad data

The most effective way to handle integrity failures is to prevent them through design. This is called **defensive design** — building a schema that assumes bad data will arrive and prepares for it.

Defensive design principles:

**Design for the worst-case input, not the ideal input.** When you add a column, don't think "well, this will always have a valid value." Think "what's the worst value that could end up in here, and how do I prevent it?" Add NOT NULL if absence is wrong. Add CHECK if the range is constrained. Add UNIQUE if duplicates are impossible.

**Be explicit about optional vs. required.** Every column should be explicitly NOT NULL or explicitly nullable, with a documented reason for the choice. A column that's nullable "just in case" but is actually always required is a future data quality problem.

**Don't rely on application-layer validation alone.** Application validation is good. Database constraints are better. Application validation shows users helpful error messages; database constraints catch *everything*, including bulk imports, developer scripts, and API calls that bypass the application.

**Consider soft deletion over hard deletion.** For records with history attached — students, customers, orders, users — deleting the record destroys the relationships and can corrupt the history. A better pattern: add an `is_deleted` or `is_active` flag, and filter inactive records in queries. The record stays in the database; it's just marked as no longer active. This preserves historical data and prevents orphaned records.

```sql
-- Soft delete pattern
ALTER TABLE Student ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- "Delete" a student by marking them inactive
UPDATE Student SET is_active = false WHERE student_id = 42;

-- Queries filter to active students
SELECT * FROM Student WHERE is_active = true;
```

### Application-level vs. database-level enforcement

Both application-level validation and database-level constraints are valuable, and they serve different purposes.

**Application-level validation** is what happens in the web form, the API, or the business logic layer before data reaches the database. It's responsible for:
- Showing users helpful error messages ("Please enter a valid email address")
- Catching errors early, before a database round-trip
- Implementing complex business rules that involve calculations or cross-system lookups

**Database-level constraints** are what happens inside the database itself, regardless of how the data got there. They're responsible for:
- Serving as the final safety net for all data entry, from any source
- Enforcing rules that must hold for the data to be meaningful
- Making the schema self-documenting — the constraints tell you what the rules are

The right answer isn't one or the other. Use both. Application validation gives users good experiences. Database constraints give you a guarantee.

When the two layers disagree — when application code allows something the database constraint rejects — the database is correct. The application code needs to be fixed to match the constraint, not the other way around.

---

## Chapter Summary

Constraints encode business rules into the database schema, enforcing them automatically for every operation from every source. NOT NULL ensures columns that are required for a row to be meaningful always have values. UNIQUE prevents duplicate values in columns or column combinations that must be unique. CHECK validates that column values satisfy a specified condition. Together, they make the database the last line of defense against bad data.

NULL represents "unknown" or "not applicable." Over-using NULL adds query complexity, causes silent errors in aggregation, and allows rows with missing required data. The principle: be as strict as the business rules allow.

Referential integrity — enforced by foreign key constraints — ensures that foreign key values always point to existing parent rows. Orphaned records, which result from missing or unenforced referential integrity, silently corrupt queries and reports. Cascade behaviors (RESTRICT, CASCADE, SET NULL) control what happens to child rows when a parent is deleted. ON DELETE RESTRICT is safer than CASCADE; soft deletion (marking records inactive) is often better than either.

Transactions group multiple database operations into a single atomic unit. Either all operations commit permanently, or all are rolled back. The ACID properties — Atomicity, Consistency, Isolation, Durability — define the guarantees that make transactions reliable. These properties are why relational databases are trusted for financial records, medical data, and any application where data correctness has real consequences.

When integrity fails, the consequences include orphaned records, phantom totals, and broken reports — often with no visible error, just quietly wrong answers. Defensive design means designing schemas for worst-case inputs, using constraints liberally, not relying on application validation alone, and preferring soft deletion for records with attached history.

---

## Key Terms

**Constraint** — A rule defined in the database schema that the database automatically enforces on every INSERT, UPDATE, or DELETE. Violations cause the operation to be rejected with an error.

**NOT NULL constraint** — A constraint specifying that a column must have a value in every row. Rows that leave the column empty are rejected.

**UNIQUE constraint** — A constraint specifying that no two rows can have the same value (or combination of values) in the specified column(s). Enforces the uniqueness of identifiers and natural keys.

**CHECK constraint** — A constraint that evaluates a boolean expression against a row's data. Rows that make the expression false are rejected. Used to encode business rules directly in the schema.

**Soft deletion** — The practice of marking records as inactive (with a flag column) rather than deleting them. Preserves historical data and prevents orphaned records.

**Orphaned record** — A row in a child table whose foreign key value no longer has a matching row in the parent table. Occurs when referential integrity is not enforced.

**ON DELETE RESTRICT** — The default cascading behavior: reject a DELETE on the parent if any child rows reference it. The developer must explicitly clean up child rows first.

**ON DELETE CASCADE** — A cascading behavior that automatically deletes child rows when the parent is deleted. Convenient but dangerous; use with care.

**Transaction** — A sequence of database operations treated as a single unit. All operations in a transaction either commit together or roll back together. There is no partial success.

**COMMIT** — The SQL command that makes a transaction's changes permanent.

**ROLLBACK** — The SQL command that undoes all changes made since the transaction began.

**ACID** — An acronym for the four guarantees that transactions provide: Atomicity (all or nothing), Consistency (valid state to valid state), Isolation (concurrent transactions don't interfere), Durability (committed data survives failure).

**Atomicity** — The ACID property that ensures all operations in a transaction succeed together or none take effect.

**Consistency** — The ACID property that ensures every transaction moves the database from one constraint-satisfying state to another.

**Isolation** — The ACID property that ensures concurrent transactions behave as if they ran sequentially, preventing interference between them.

**Durability** — The ACID property that ensures committed data is permanently recorded and survives system failures.

**Phantom total** — An aggregation result that appears correct but isn't, due to orphaned records, NULL values excluded from aggregation, or other data integrity problems.

**Defensive design** — The practice of designing a schema to anticipate and prevent bad data, using constraints, NOT NULL, soft deletion, and other integrity mechanisms rather than assuming inputs will always be valid.

---

## Interactive Activities

The activities below are designed to be completed with a generative AI tool such as Claude (claude.ai) or ChatGPT. For each activity, copy the prompt in the gray box and paste it directly into your AI tool to begin an interactive study session.

---

### Activity 11.1 — Concept Check: Constraints and ACID

*This activity checks your understanding of the key ideas from Chapter 11. The AI will quiz you one question at a time and give feedback after each answer.*

---

**Copy and paste this prompt into your AI tool:**

> I've just finished reading Chapter 11 of my Introduction to Databases textbook, which covered NOT NULL, UNIQUE, and CHECK constraints; referential integrity and foreign keys; cascading behaviors; and ACID transaction properties. I want to check my understanding. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and ask if I'd like to go deeper before moving to the next question.
>
> Here are the questions:
>
> - What is the difference between a NOT NULL constraint and a UNIQUE constraint? Give an example of each.
> - The chapter distinguishes between NULL meaning "unknown" and NULL meaning "not applicable." What's the difference? Give one example of each.
> - What is a CHECK constraint? Give a realistic example of a business rule you could encode with one.
> - What is an orphaned record? How does a foreign key constraint prevent them?
> - What is the difference between ON DELETE RESTRICT and ON DELETE CASCADE? Which is safer, and why?
> - What is soft deletion? Why might you prefer it over actually deleting a record?
> - Explain ACID in plain English. What does each letter stand for, and what problem does each property solve?
> - What is a phantom total? Why is it dangerous?
> - The chapter says "the database error as a helpful message." What does this mean? Why is a constraint violation error better than no error?
> - What is the difference between application-level validation and database-level constraints? Why do you need both?

---

### Activity 11.2 — Apply It: Design the Constraints

*This activity gives you practice deciding which constraints belong on a schema. The AI will present tables and ask you to specify the constraints.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying data integrity and constraints in my Introduction to Databases class. I want to practice deciding which constraints belong on a given schema. For each table description below, I'll specify the appropriate constraints for each column: NOT NULL or nullable, UNIQUE if needed, CHECK conditions if applicable, and whether each foreign key should use ON DELETE RESTRICT or ON DELETE CASCADE. You'll give me feedback on each decision and explain your reasoning.
>
> Please do this one table at a time. Present the table, ask for my constraint decisions column by column, then give feedback before moving on to the next table. After all three, tell me which constraint type I seemed least confident about.
>
> Table 1: A PAYMENT table for the campus concert ticketing system.
> Columns: payment_id, ticket_id (references Ticket), amount, payment_method (one of: 'credit_card', 'debit_card', 'dining_dollars', 'cash'), payment_date, refunded (true/false, defaults to false)
>
> Table 2: A REVIEW table where users rate songs they've streamed.
> Columns: review_id, user_id (references User), song_id (references Song), rating (1–5 stars), review_text (optional written comment), reviewed_at, edited_at (NULL if never edited)
> Note: a user should only be able to review each song once.
>
> Table 3: A STAFF table for university employees.
> Columns: staff_id, mu_employee_id (unique 8-digit university ID), first_name, last_name, email, department, hire_date, termination_date (NULL if currently employed), hourly_rate (must be greater than 0), is_active (true/false)

---

### Activity 11.3 — Practice: Trace the Transaction

*This activity builds intuition for transactions by walking through multi-step business operations and identifying what breaks without ACID guarantees.*

---

**Copy and paste this prompt into your AI tool:**

> I'm studying database transactions and ACID properties. I want to build intuition for why transactions matter by analyzing what goes wrong when they don't exist. For each scenario below, I'll identify: (a) which database operations need to happen together, (b) which ACID property is most relevant, and (c) what goes wrong if the operations are not wrapped in a transaction and the system crashes or errors in the middle.
>
> Please present each scenario one at a time. Ask for my answers, give feedback, and explain the ACID concept in context before moving on.
>
> Scenario 1: Canceling a concert ticket.
> When a student cancels a ticket, the system needs to mark the ticket as canceled, restore the seat count on the concert, and void the payment record.
>
> Scenario 2: A student changes their username.
> The platform uses usernames for login and displays them in playlists, reviews, and stream history. Changing a username means updating it in the User table and in every other table that stores it as a denormalized value for performance.
>
> Scenario 3: Processing a batch playlist import.
> A user uploads a CSV of 200 songs to add to a playlist. The system checks each song against the Song table and inserts 200 PlaylistSong rows. The 150th song fails validation because it's marked as unavailable in the current region.
>
> Scenario 4: Transferring a ticket from one student to another.
> A student wants to give their concert ticket to a friend. The system creates a new ticket for the friend, marks the original ticket as transferred, and logs the transfer event.
>
> After all four, tell me which ACID property I seem least clear on, and give me one more scenario designed to test that specific concept.

---

### Activity 11.4 — Case Study: Diagnose the Integrity Failure

*This activity presents data quality problems discovered in a real-ish business scenario. Your job is to trace each problem back to a missing constraint or integrity rule.*

---

**Copy and paste this prompt into your AI tool:**

> I'm practicing data integrity diagnosis. You'll play the role of a data analyst at a campus events company. I'm the new database intern. You've just audited the ticketing database and found several problems. Present each problem to me one at a time. For each one, ask me: (a) What is the root cause of this problem — what missing constraint or integrity rule allowed it to happen? (b) What is the business impact — what could go wrong because of this data? (c) What constraint or design change would prevent this in the future?
>
> Wait for my answer, give me feedback, and explain the correct analysis before moving on to the next problem.
>
> Problem 1:
> You found 47 rows in the Ticket table where the student_id doesn't match any row in the Student table. These tickets have valid concert_ids and prices, but no matching student.
>
> Problem 2:
> The Concert table has a seats_available column. Your audit found 3 concerts where seats_available is negative — for example, one concert shows -12 available seats. Total tickets sold for that concert exceed the venue's capacity by 12.
>
> Problem 3:
> The Payment table has an amount column. Your audit found 8 rows where amount is NULL and 3 rows where amount is 0.00. These correspond to tickets that were "sold" but have no payment on record.
>
> Problem 4:
> You ran a query to count total revenue last semester: SELECT SUM(amount) FROM Payment WHERE payment_date BETWEEN '2025-08-01' AND '2025-12-31'. The result is $87,400. But your finance team's report (built from a different system) shows $91,200 for the same period. The $3,800 gap is unexplained.
>
> Problem 5:
> A developer deleted 12 "test" Student accounts from the database. Now 89 Ticket records reference those deleted student_ids. Those tickets still have valid concert_ids and prices, but no corresponding student.
>
> After diagnosing all five, tell me which type of integrity failure — missing NOT NULL, missing CHECK, missing foreign key, missing transaction, or something else — seemed most common in this audit, and what that suggests about the original schema design.
