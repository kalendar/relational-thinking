# Concept dependency graph — *Relational Thinking*

Machine-readable map of every concept in the book and where each is introduced,
assumed, and re-defined. Built 28 Aug 2026 from the **published Pressbooks text**
(`pressbooks.marshall.edu/mis340`), not the local drafts.

Audit report: https://claude.ai/code/artifact/e2875e1c-ca91-4cc5-858c-a9c1ca482682

## Files

| File | What it is |
|---|---|
| `knowledge-graph.json` | The graph: 372 concept nodes, 146 cross-references, verified findings |
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
where `introduced_in` is empty.

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

- Coverage is the published text only. Chapters still being drafted locally
  aren't represented until they're published.
- `hard` vs `soft` is a pedagogical judgment, not a fact. Every finding in the
  report was re-verified against the source, but the underlying edges in the
  graph were not all individually re-checked — treat an unverified edge as a
  lead, not a verdict.
- 19 of 23 candidate violations and 57 of 61 cross-reference flags were false
  positives before verification. Do not act on a raw query result without
  reading the quote.
