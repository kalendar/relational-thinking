# Chapter 1: Data as a Way of Seeing

By the end of this chapter, you will be able to:

- Distinguish among data, information, and knowledge, and explain how that distinction shapes the decisions made during database design.
- Justify the claim that database design is a form of prediction, using examples (e.g., what Spotify chooses to log about plays and skips) to show how collection choices constrain future questions.
- Compare the capabilities that structured data enables – automation, analysis, scale – against the costs of unstructured or inconsistent data, citing at least one real-world failure (e.g., the Mars Climate Orbiter, Netflix's rating redesign).
- Trace the historical progression from flat files through hierarchical and network models to the relational model, and explain why the relational model became the dominant approach.

* * *

Imagine you open Spotify on a Monday morning and it serves you a playlist called "Your Daily Mix." The songs feel right – not too heavy for 8 a.m., a few artists you've been into lately, one or two things you didn't know you'd like. That didn't happen by accident.

Somewhere behind that playlist is a database. Actually, several of them. Spotify isn't just storing song files – it's storing the fact that you played a song, how long you listened before skipping, what time of day it was, what device you used, and what you played next. It does this for every listener, every day. Then it uses that data to make decisions – about what to recommend, what to license, what to put on the front page.

That's what databases do. They don't just store things. They make things possible.

This chapter is about getting a feel for what data is, why it gets organized the way it does, and why you should care. We're not going to write any code or learn any commands yet. Before any of that, we need to build a way of _thinking_ about data. Once you have that, the technical stuff will make a lot more sense.

* * *

## 1.1 What Is Data, Really?

### The data–information–knowledge hierarchy

Let's start with a question that sounds simple but isn't: what is data?

Here's a number: **127**.

What does it mean? On its own, nothing. It's just a number. It could be a temperature in Fahrenheit (very hot day), a score on a test (great job), the number of unread texts from your group chat (please turn on Do Not Disturb), or the runtime of a movie in minutes.

**Data** is raw facts without context. A number, a word, a date – these are data. By themselves, they don't tell you anything useful.

Now add context: _127 streams in the last 24 hours._ That's more useful. You know what the number is measuring and over what time period. Now 127 is starting to become **information** – data that's been given meaning through context. You can do something with it. A record label manager looking at that number might get excited or worried, depending on what they expected.

Go one step further: _Taylor Swift's new single got 127 streams in the first 24 hours on our platform – that's 40% below her last three releases, all of which went on to chart in the top 10._ Now you have **knowledge** – information that's been interpreted in light of experience, patterns, and goals. The record label manager isn't just looking at a number anymore; they're making a judgment about whether to increase marketing spend.

This progression – data → information → knowledge – is the foundation of why databases exist. Organizations collect raw facts (data), organize them so they can be interpreted (information), and use that interpretation to make better decisions (knowledge). A database is the system that makes the first step reliable enough to support the rest.

### Why the distinction matters for database design

You might be wondering why this philosophical detour matters for a class about databases. Here's why: when you design a database, you are deciding what data to collect and how to organize it. Those decisions shape what information is possible to extract – and therefore what knowledge is possible to generate.

If Spotify only stored the song title and the user's name, it couldn't generate a personalized playlist. If it stored the play but not the skip, it couldn't learn your taste. The database designers' choices constrain everything that comes after.

This is one of the most important ideas in this book: **design is a form of prediction.** When you build a database, you're predicting what questions you'll want to answer in the future. Get the design wrong, and those questions become impossible – or, at least, very expensive – to answer.

### Data as a representation of the world, not the world itself

Here's something worth sitting with: a database is never the real world. It's a _model_ of the real world, and every model involves choices about what to include and what to leave out.

Think about your college's student information system. It has a record for you. That record has your name, your student ID, your major, your GPA, your enrollment status. It does not have your personality, your ambitions, your financial stress, your sense of humor, or the fact that you pulled an all-nighter before your last exam. The system knows a narrow slice of you – the slice that's useful for the university's purposes.

That's not a flaw. That's the design. A database is supposed to be a simplification. The question is whether it's the _right_ simplification for the job.

### The choices embedded in every act of data collection

Every data point in a database is there because someone decided to collect it. And someone decided not to collect everything else.

When Netflix asks you to rate something with a thumbs up or thumbs down, they made a design choice. They used to use a 5-star rating system. They switched to thumbs up / thumbs down because they found that people were giving movies they liked 3 stars instead of 5 – not because they didn't enjoy them, but because they felt 5 stars should be reserved for masterpieces. The 5-star data wasn't capturing what Netflix needed to know: _will this person want to watch something like this again?_ A thumbs up / thumbs down forced a simpler, more useful signal.

**The data Netflix collects is shaped by what Netflix wants to predict**. Your database designs will be shaped the same way.

### What gets left out – and why that matters

What a database doesn't capture can be just as important as what it does.

In 2012, [Target famously figured out that a teenage girl was pregnant before her father did](https://www.nytimes.com/2012/02/19/magazine/shopping-habits.html) – by analyzing her purchase patterns. But this story cuts both ways. While Target's data could predict pregnancy, it couldn't capture the human sensitivity required to handle that information well. The database knew a purchasing pattern; it didn't know a family situation. As the New York Times Magazine reported:

> About a year after Pole created his pregnancy-prediction model, a man walked into a Target outside Minneapolis and demanded to see the manager. He was clutching coupons that had been sent to his daughter, and he was angry, according to an employee who participated in the conversation.
>
> "My daughter got this in the mail!" he said. "She's still in high school, and you're sending her coupons for baby clothes and cribs? Are you trying to encourage her to get pregnant?"
>
> The manager didn't have any idea what the man was talking about. He looked at the mailer. Sure enough, it was addressed to the man's daughter and contained advertisements for maternity clothing, nursery furniture and pictures of smiling infants. The manager apologized and then called a few days later to apologize again.
>
> On the phone, though, the father was somewhat abashed. "I had a talk with my daughter," he said. "It turns out there's been some activities in my house I haven't been completely aware of. She's due in August. I owe you an apology."

This isn't an argument against databases. It's an argument for being thoughtful about what they can and can't know. Data is powerful precisely because it scales – a system can "notice" patterns across millions of customers. But it's also limited because it only captures what it was designed to capture.

As you learn to build databases, you'll develop a habit of asking: _what is this database leaving out, and does that matter for the decisions it's supposed to support?_

* * *

## 1.2 Why Organizations Structure Data

### The business case for consistent, structured information

Let's say you work at a music venue and you're tracking ticket sales. You could just keep notes in a notebook: "Sold 3 tickets to the Drake show to a guy named Mike, he paid cash, April 12." That works fine when you sell 10 tickets. It becomes a disaster when you sell 10,000.

What goes wrong? A few things.

First, you can't search it. If someone calls and says "I bought tickets under the name Mike," you have to flip through hundreds of pages. Second, you can't calculate totals without reading every entry. Third, different employees write notes differently – one writes "Mike Johnson," another writes "M. Johnson," a third writes "Johnson, Michael." Now you have three records for the same person and no way to tell.

Structured data solves these problems. Instead of freeform notes, you have rows and columns: one row per sale, columns for customer name, customer email, event, date, quantity, price, payment method. Now you can search in seconds, calculate totals instantly, and because every employee fills out the same form, the data is consistent.

**Repeatability** means every sale is recorded the same way. **Comparability** means you can compare sales from April to sales from May because they're measured the same way. **Scale** means you can do this for a million sales just as easily as for ten.

Structure is what makes data useful at scale.

### How structure enables automation and analysis

Structured data doesn't just make things faster – it makes new things possible.

With structured ticket sales data, you can automatically send a confirmation email the moment a ticket is purchased, because the system knows the buyer's email address in a consistent, machine-readable field. You can build a dashboard that shows real-time revenue by event. You can identify your most loyal customers by counting how many shows each person has attended. You can flag suspicious activity – like 500 tickets purchased by a single account in 10 minutes – because the data is structured enough to detect that pattern.

None of this is possible with a notebook.

The key insight is that **structure is a form of discipline that pays off in capability.** It feels like extra work upfront – you have to decide on the columns, enforce the format, validate the inputs. But that upfront work is what unlocks everything that comes later.

### The hidden costs of unstructured and inconsistent data

Bad data isn't just useless. It's actively expensive.

Organizations spend enormous amounts of time and money on what's called **data reconciliation** – the work of cleaning up messy, inconsistent data so it can actually be used. "Mike Johnson," "M. Johnson," and "Johnson, Michael" need to be figured out before you can count that person's purchases. Multiply that by thousands of customers and you have a significant labor cost.

Then there's the trust problem. Once people in an organization discover that the data is unreliable, they stop trusting it – and they start making decisions based on gut feel instead of evidence. **Ironically, bad data can be worse than no data**, because at least with no data, people know they're guessing.

### Real-world examples of data quality failures

Data quality failures aren't just inconvenient. Sometimes they're catastrophic.

In 1999, NASA lost the [Mars Climate Orbiter](https://en.wikipedia.org/wiki/Mars_Climate_Orbiter) – a $327 million spacecraft – because one engineering team was using metric units and another was using imperial units, and no one caught the mismatch. The data was there; it just wasn't consistent.

More commonly, data quality failures are quieter but still costly. A hospital system with inconsistent patient records might give a patient the wrong medication dose because their weight was entered in kilograms in one system and pounds in another. A retailer might over-order inventory because sales data from one region is counted twice due to a system integration bug.

These examples all have the same root cause: data that wasn't structured, validated, or governed carefully enough. Building databases well is, in part, how organizations avoid these failures.

* * *

## 1.3 A Brief History of How We've Stored Data

### From filing cabinets to flat files to relational systems

For most of human history, records were kept on paper. A library's card catalog, a bank's ledger, a hospital's patient files – all of it was physical, manual, and searched by humans walking to a cabinet and flipping through papers.

When computers arrived in the mid-20th century, they didn't immediately transform data storage. Early computers stored data in flat files – essentially digital versions of paper records. A flat file is just a list: one record after another, stored in sequence. To find a specific record, you often had to read through the file starting from the beginning.

In the 1960s, more sophisticated approaches emerged. **Hierarchical databases** organized data in a tree structure, like a folder system: a company at the top, departments branching off it, employees inside each department. **Network databases** were similar but allowed more complex connections – an employee could belong to multiple departments, for example.

These models worked, but they had a serious problem: the structure of the data was deeply tied to the programs that used it. If you wanted to ask a new kind of question – one the database wasn't originally designed for – you often had to rewrite the program. The data and the application you used to query the data were tangled together.

### Hierarchical and network models: what came before

The hierarchical model has an intuitive appeal. Think of a company org chart: the CEO is at the top, VPs branch off below, directors below them, managers below those, and so on. A hierarchical database works the same way – you navigate from parent to child to grandchild.

The problem is that real-world relationships don't always fit a strict hierarchy. A product might belong to multiple categories. A student might take courses taught by multiple professors. A song might be on multiple playlists. The moment you have a many-to-many relationship, the tree structure starts to crack.

Network databases tried to solve this by allowing records to have multiple "parent" records, not just one. But this made the structure very complex, and the programs that navigated the data had to know exactly how everything was connected. If you changed the structure, you broke the programs.

### The limitations that motivated a new approach

By the late 1960s, it was clear that the existing approaches had a fundamental flaw: they forced the application programmer to know too much about how data was physically stored. Wanting to ask a new question of the data meant writing new navigation logic, often from scratch.

What the field needed was a way to separate the _logical_ organization of data from its _physical_ storage – so you could ask new questions without rebuilding the system.

### Why the relational model won

In 1970, a mathematician at IBM named Edgar F. Codd published a paper called " [A Relational Model of Data for Large Shared Data Banks](https://dl.acm.org/doi/epdf/10.1145/362384.362685)." It was one of the most influential papers in the history of computing.

Codd's idea was elegant: organize all data as simple tables (which he called _relations_), and provide a mathematical language for querying those tables. The mathematics behind it was set theory — a table is a *set* of rows, and sets have no inherent order. Crucially, the user wouldn't need to know how the data was stored – just what it contained. You could ask any question that the data could answer, without needing to know the physical structure underneath.

This was revolutionary for two reasons. First, it gave non-programmers a path to querying data themselves. Second, it meant that changing how data was stored didn't break every application that used it.

The relational model took time to catch on – the early implementations were slow, and the established database vendors resisted the change. But by the 1980s, it had won. Structured Query Language, or SQL, the language Codd's model inspired, became the standard. Today, relational databases power the majority of the world's business systems: banking, retail, healthcare, logistics, social media.

Understanding the relational model isn't just historical trivia. The ideas Codd proposed in 1970 are the ideas you'll be using in this course.

* * *

## 1.4 How This Book Works

### Concepts before syntax: the philosophy of this text

Many database courses start with SQL. This one doesn't.

SQL is a language. Like any language, it's much easier to learn once you understand what you're trying to say. If you've ever tried to learn a foreign language by memorizing phrases without understanding the grammar, you know the problem: you can repeat things you've been taught, but you can't construct anything new, and you definitely can't catch errors.

This book takes a different approach. For the first half, you won't write a single line of SQL. Instead, you'll build the mental model that makes SQL make sense. You'll learn what tables, rows, and columns really are. You'll learn why relationships between tables exist and what they mean. You'll learn how to think about a question – a real business question – before you think about how to answer it technically.

**Then, when SQL arrives, it will feel less like memorizing commands and more like translating thoughts you already have into a language the computer understands.**

This approach also sets you up to use AI tools effectively. Tools like Claude, ChatGPT, and GitHub Copilot can write SQL for you. But they can only write SQL that answers the question you give them – and if you ask the wrong question, or if you can't tell when their answer is wrong, those tools will lead you astray. The mental model is what lets you use AI as an accelerant rather than a crutch.

### What it means to think relationally

"Relational thinking" sounds abstract. Here's what it means in practice.

When a business process happens – a customer buys something, a student registers for a class, a concert ticket gets scanned at the door – it involves multiple _things_ interacting with each other. A customer and a product. A student and a course and a professor. A fan and a ticket and a venue and an event.

**Relational thinking means seeing those things clearly – identifying each one, understanding its properties, and recognizing how they connect. It means resisting the urge to smash everything into one giant spreadsheet and instead letting each thing be its own entity, linked to the others through defined relationships.**

Once you can think this way, you can design databases that accurately model the world. And once you can model the world accurately, you can ask questions of it – and trust the answers.

### Skills: designing, querying, evaluating, communicating

By the end of this course, you'll be able to do four things:

**Design** a database from a description of a business domain. Given a scenario – a concert venue, a streaming service, a university – you'll be able to identify the entities, their attributes, and their relationships, and turn that into a working database structure.

**Query** a database to answer business questions. Using SQL (with AI assistance where helpful), you'll be able to extract specific information from a database – filtering, joining, and summarizing data to answer real questions.

**Evaluate** database designs and queries critically. You'll be able to look at someone else's schema or query – including one generated by an AI – and identify whether it's correct, efficient, and fit for purpose.

**Communicate** about data with both technical and non-technical audiences. You'll be able to explain a database design to a business stakeholder, and translate a stakeholder's question into a precise technical specification.

These aren't just academic skills. They're the skills that make a business analyst, a manager, or an entrepreneur more effective in a world that runs on data.

### Fluency: reading AI-generated SQL with informed skepticism

A note on AI tools, because they're going to come up throughout this course.

AI assistants are remarkably good at writing SQL. Give one a schema and a question, and it will often produce a correct query in seconds. This is genuinely useful – it lowers the barrier to getting answers from data, and it frees you from having to memorize syntax.

But AI tools also make mistakes. They produce queries that look correct but aren't. They miss filters. They join tables in ways that silently double-count rows. They answer a slightly different question than the one you asked. And they do all of this confidently, without flagging their uncertainty.

**The person who can catch these mistakes is the person who understands what the query is supposed to do.** **That's what this text is building toward. The goal isn't to make you an AI-free SQL writer – it's to make you the kind of thinker who can use AI tools productively without being misled by them.**

Think of it like this: a good editor doesn't write every word themselves, but they can tell when a sentence is wrong. By the end of this course, you'll be a good editor of data work.

* * *

## Chapter Summary

Data is raw facts. Information is data with context. Knowledge is information used for judgment. Databases exist to make the journey from data to knowledge reliable and repeatable.

Every database is a model of the world – a deliberate simplification that captures what matters for a specific purpose and leaves out everything else. The choices embedded in that model determine what questions can and can't be answered.

Structured data enables scale, automation, and analysis in ways that unstructured records never could. The cost of bad data – inconsistent, unvalidated, ungoverned – is measured in wasted time, poor decisions, and sometimes catastrophic failures.

The relational model, introduced by Edgar Codd in 1970, transformed how we store and query data by separating the logical organization of data from its physical storage. That model is still the foundation of most business databases today.

This course builds conceptual fluency before technical skill. By the time you write your first SQL query, you'll understand what you're doing and why – and you'll be equipped to use AI tools thoughtfully rather than blindly.

* * *

## Key Terms

**Data** – Raw facts without context. A number, a word, a date.

**Information** – Data that has been given meaning through context.

**Knowledge** – Information interpreted in light of experience and goals to support decision-making.

**Flat file** – A simple sequential data storage format, like a spreadsheet or a text file with one record per line.

**Hierarchical database** – A data model that organizes records in a tree structure, with parent and child records.

**Relational model** – A data model that organizes all data as tables (relations) and uses a mathematical framework for querying them. Introduced by Edgar Codd in 1970.

**Data reconciliation** – The work of cleaning and standardizing inconsistent data so it can be used reliably.

* * *

## Interactive Activities

The activities below are designed to be completed with generative AI tools such as Microsoft CoPilot, Claude, ChatGPT, or Gemini. For each activity:

- start a new chat in your AI tool,
- upload a copy of this chapter,
- copy the prompt in the gray box and paste it into the tool, and
- press Enter to begin an interactive study session.

When you complete each activity, look for the Share button in the top right of your AI tool. Get the Shared link to your chat and submit it for this week's homework. Since there are four activities below, you should submit four links.

* * *

### Activity 1.1 – Concept Check: Data, Information, and Knowledge

_This activity checks your understanding of the core vocabulary from Section 1.1. The AI will quiz you on the key concepts from this chapter one at a time, give you feedback on your answers, and help you fill in any gaps._

* * *

**Copy and paste this prompt into your AI tool:**

> I've just finished reading Chapter 1 of my Introduction to Databases textbook (attached), which covered the concepts of data, information, and knowledge, and why organizations structure data. I want to check my understanding of the key ideas. Please quiz me by asking the following questions one at a time. Wait for my answer before moving on. After each answer, tell me what I got right, correct anything I misunderstood, and explain it more clearly if needed. Then ask if I'd like to go deeper on that topic before moving to the next question.
>
> Here are the questions:
>
> - What is the difference between data, information, and knowledge? Can you give an example of each?
> - Why does it matter that data is a "representation of the world" rather than the world itself?
> - What does it mean to say that every database design is a form of prediction?
> - What are three specific problems that arise when data is unstructured or inconsistently recorded?
> - What was the key problem with hierarchical and network databases that the relational model solved?
> - In your own words, what was Edgar Codd's big idea, and why did it matter?
> - What does it mean to think "relationally"?

* * *

### Activity 1.2 – Apply It: What Does an App Know About You?

_This activity takes the idea from Section 1.1 – that every database is a deliberate simplification of the world – and asks you to apply it to an app you already use. The AI will guide you through the analysis step by step and push your thinking further._

* * *

**Copy and paste this prompt into your AI tool:**

> I'm studying Introduction to Databases and I just read about how databases are models of the world – deliberate simplifications that capture some things and leave out others (reading attached). I want to apply this idea to an app I actually use.
>
> I'm going to tell you an app I use, and I want you to guide me through an analysis of it. Ask me one question at a time and wait for my answer before continuing. After each answer, give me feedback – tell me what I got right, what I might be missing, and help me think more carefully. The questions are:
>
> 1. What app do you want to analyze? (I'll answer first, then you continue with the app I name.)
> 2. What specific data do you think this app collects about you and your behavior?
> 3. What does it deliberately leave out – things it could track but probably doesn't, or things about you that no amount of data could capture?
> 4. What is one decision the app makes well because of the data it has?
> 5. What is one decision it makes poorly – or one thing it gets wrong about you – because of what it doesn't know?
> 6. If you were redesigning the app's database to fix that blind spot, what additional data would you try to collect?
>
> After I've answered all the questions, summarize what my analysis reveals about the relationship between what a database captures and what it can do.

* * *

### Activity 1.3 – Practice: Classifying Data, Information, and Knowledge

_This activity gives you hands-on practice with the data → information → knowledge distinction using realistic examples. The AI will present examples, ask for your classification and reasoning, and correct you if you're off track._

* * *

**Copy and paste this prompt into your AI tool:**

> I'm studying the difference between data, information, and knowledge in my Introduction to Databases class (reading attached). I want to practice classifying examples. Please show me the following items one at a time. For each one, ask me whether it's data, information, or knowledge, and ask me to explain my reasoning. Wait for my answer. Then tell me if I'm right, explain why, and clarify anything I seem to be fuzzy on. Ask if I want to discuss it further before moving to the next one.
>
> Here are the items to classify:
>
> 1. The number 4.2
> 2. "User ID 8841 has a 4.2 average star rating from 312 reviews"
> 3. "User ID 8841's rating has dropped 0.3 stars over the past 90 days, which in our experience predicts a 60% chance of churn within six months – we should trigger a retention offer"
> 4. The word "Tuesday"
> 5. "Sales are always 30% lower on Tuesdays, so we schedule fewer staff on those days"
> 6. "87"
> 7. "87 people attended last night's show, which is 23% below the venue's break-even capacity of 113"
>
> After we've gone through all the examples, ask me to come up with one example of my own for each category – data, information, and knowledge – from my everyday life.

* * *

### Activity 1.4 – Case Study: The Cost of Messy Data

_This activity puts you in a realistic business scenario where inconsistent data causes problems. The AI plays the role of your manager and walks you through diagnosing the problem, cleaning it up, and preventing it from happening again._

* * *

**Copy and paste this prompt into your AI tool:**

> I'm studying why structured, consistent data matters in my Introduction to Databases class (reading attached). I want to work through a realistic scenario. Please play the role of my manager at a music festival. I'm your assistant who has been tasked with reporting merchandise sales at the end of the weekend. Here's the situation:
>
> Our team of five people all added sales to a shared Google Sheet throughout the weekend, but nobody agreed on how to enter the data. Looking at the spreadsheet now, I can see entries like: "T-Shirt (Large)," "T-shirt L," "large tee," "tee – L," and "T Shirt Large" – all referring to the same product.
>
> Walk me through this scenario interactively. Ask me one question at a time and wait for my answer before continuing. After each answer, respond as my manager – acknowledging what I got right, pushing back if I'm missing something, and adding context from your experience. The questions are:
>
> 1. Before we even start fixing anything – what specific problems is this inconsistency going to cause when I try to total up sales by product and size?
> 2. What are my options for cleaning up the data now, and what are the trade-offs of each approach?
> 3. How long do you estimate this cleanup will take, and what's the business cost of that time?
> 4. What rules or systems would you put in place before next year's festival to prevent this from happening again?
> 5. If we wanted to build a proper database for tracking merchandise sales instead of a spreadsheet, what would the structure need to look like to make this kind of inconsistency impossible?
>
> After my final answer, give me a short summary of the key lesson about data quality this scenario illustrates.
