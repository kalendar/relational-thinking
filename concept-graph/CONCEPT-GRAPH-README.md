# Concept dependency graph — *Relational Thinking*

Machine-readable map of every concept in the book and where each is introduced,
assumed, and re-defined.

**Synced to the local chapter markdown at commit `ed07dfe` (28 Aug 2026).** Local
markdown is the source of truth; the Pressbooks site is a build output and is
currently *behind* these files. Chapters 1, 2, 4, 5, 7, 8, 9, 10 and 11 were
re-extracted after the fix pass. Chapters 3, 6, 12, 13 and 14 carry forward the
earlier extraction — their local and published text were compared and differ only
typographically, with identical bolded-term sets.

**Current state: zero open prerequisite violations.** Six dependencies are closed
by an inline gloss, eight were checked and dismissed during verification.

Audit report: https://claude.ai/code/artifact/e2875e1c-ca91-4cc5-858c-a9c1ca482682

## Files

| File | What it is |
|---|---|
| `knowledge-graph.json` | The graph: 366 concept nodes, cross-references, verified findings |
| `CONCEPT-GRAPH-README.md` | This file |

## Graph shape

```jsonc
{
  "chapters": [ { "n": 1, "slug": "...", "title": "...", "wip": false } ],
  "nodes": [
    {
      "concept": "primary key",              // canonical, alias-resolved
      "surface_forms": ["primary key","PK"], // as the book actually words it
      "introduced_in": [ { "chapter": 2, "section": "2.5",
                           "formal": true, "quote": "...",
                           "in_key_terms": true } ],
      "assumed_in":   [ { "chapter": 3, "section": "3.3",
                           "strength": "hard", "quote": "...",
                           "why": "..." } ]
    }
  ],
  "cross_references": [ { "from_chapter": 2, "claim_text": "...",
                          "points_to_chapter": 1, "direction": "backward" } ],
  "findings": { ... },
  "verification": { ... }
}
```

Every node and every finding carries a **verbatim quote** from the chapter text,
so any claim can be checked against the source without re-reading the book.

`strength` is the judgment that matters: `hard` means the passage is
unintelligible without the concept; `soft` means it merely helps.

## The audit is one query

A prerequisite violation is any `hard` entry in `assumed_in` for chapter *N*
where the concept's earliest `introduced_in` chapter is greater than *N* — or
where `introduced_in` is empty — **and** which is not marked `glossed_in_place`
and not already adjudicated.

`glossed_in_place: true` means the chapter relies on a concept it doesn't own but
explains it well enough on the spot, with a pointer to the owning chapter. The
dependency is real and stays in the graph; it just isn't a defect. That is the
house pattern the fix pass used, so treat it as the target shape rather than a
thing to eliminate.

```python
import json
g = json.load(open("knowledge-graph.json"))
for node in g["nodes"]:
    intro = [i["chapter"] for i in node["introduced_in"]]
    first = min(intro) if intro else None
    for a in node["assumed_in"]:
        if a["strength"] != "hard":
            continue
        if first is None or first > a["chapter"]:
            print(node["concept"], "needed in ch", a["chapter"],
                  "but introduced in", first)
```

Same graph answers: which concepts are defined twice, which appear in Key Terms
but are never used again, and how much new vocabulary each chapter lands.

## Checking a newly finished chapter

Eleven chapters are still marked WIP. When one is finalized:

1. Scrape the published chapter to markdown.
2. Extract its concepts to the same node schema — `concepts_introduced`,
   `concepts_assumed` (with `hard`/`soft`), `cross_references` — each with a
   verbatim quote.
3. Merge into `nodes` and re-run the query above.

The alias map matters. If a new chapter says "system-generated identifier"
where Chapter 2 said "surrogate key", they must resolve to one node or the
query reports a violation that isn't real. Check `surface_forms` on the
existing node before adding a new one.

## Known limits

- Coverage is the local chapter markdown, which is ahead of the published site.
  Republishing will bring the two back in line.
- `hard` vs `soft` is a pedagogical judgment, not a fact. Every finding in the
  report was re-verified against the source, but the underlying edges in the
  graph were not all individually re-checked — treat an unverified edge as a
  lead, not a verdict.
- 19 of 23 candidate violations and 57 of 61 cross-reference flags were false
  positives before verification. Do not act on a raw query result without
  reading the quote.

## Re-running after you edit a chapter

This is the loop that caught two regressions the fix pass introduced, so it is
worth actually running rather than trusting an edit.

1. Copy the edited chapter to `current/chapter-NN.md`.
2. Re-extract it against `EXTRACTION_SPEC_LOCAL.md` into `extractions_v2/`.
3. `python3 build_graph_v2.py` and read the OPEN violations count.

`aliases.json` merges surface variants onto one concept (`joining` → `join`,
`FK` → `foreign key`). Check it when a new chapter names something the book
already teaches under another word — a missing alias produces a violation that
isn't real.

`adjudications.json` records candidates already verified against the source and
dismissed, keyed `concept@chapter`. It exists so a rebuild doesn't resurface
settled questions. Remove an entry if the chapter changes enough to reopen it.

## What the rebuild caught

Removing a duplicate definition can turn it into a gap. Both regressions had
that shape:

- `HAVING` was correctly dropped from ch8's Key Terms (ch9 owns it) — but it
  appears in ch8's *first* SQL example and Activity 8.1 quizzes it. Now glossed
  in place.
- Standardizing "destructive change" → "breaking change" updated the body prose
  but missed Activity 10.1 and a line in ch14.

The lesson for the next de-duplication: after removing a definition, check
whether the concept is still *used* earlier than its new owner — including
inside activity prompts.

## Still open

Three imprecise cross-references, none of which block a reader:

- ch6 §6.4 calls one-table design "the anti-pattern we've been fighting since
  Chapter 2" — ch2 only points forward to ch3; the fight starts in ch3.
- ch7 §7.4 cites "the campus music system from Chapter 6" but its first join path
  uses Stream/Song/Artist, which belong to ch8's streaming schema.
- ch10 §10.3 says "exactly the design we'd produce after running through the
  end-to-end walk-through in section 10.1" attached to the *messy* denormalized
  table; 10.1 produces the normalized one. Reads like an editing slip.

Four vocabulary-drift items also remain — the most substantive being `schema`,
used from ch1's course outcomes onward but only ever defined in ch6's Key Terms
as "relational schema".
