---
name: publish-intro-db
description: Publish the "Relational Thinking: An Introduction to Databases" textbook chapters to the Marshall University Pressbooks site. Use this skill whenever the user invokes "/publish-intro-db", or asks to publish, push, sync, or upload the Intro to Databases chapters to Pressbooks.
version: 2.0.0
---

# /publish-intro-db — Publish chapters to Pressbooks

Publishes/updates all `chapter-NN.md` files in this project to the book at
https://pressbooks.marshall.edu/mis340 by running `publish_to_pressbooks.py`.

## When to use

Trigger whenever the user types `/publish-intro-db`, or asks to publish, push,
sync, or upload the textbook chapters to Pressbooks.

## The workflow this fits into

**The local `chapter-NN.md` files are the single source of truth. The Pressbooks
site is a build output.** Do not hand-edit chapters in the Pressbooks web editor —
edits made there are invisible to git, and four chapters (06, 08, 09, 10) contain
Mermaid diagram source that is rendered to PNG on publish and *cannot be recovered
from the live page*. Pulling the site back down is a lossy, manual repair job, not
a sync.

The project is a git repo. **Commit before every publish**, so each published state
has a matching snapshot to diff against:

```
cd "/Users/david/Documents/Claude/Projects/Intro to DBs"
git add -A && git commit -m "…"
source .venv/bin/activate
python publish_to_pressbooks.py
```

## How it works

The script reads `chapter-01.md` through `chapter-14.md`, converts them to HTML,
and **updates** the matching chapter on the book. It never creates chapters.

Two safety mechanisms, both added 2026-08-28 after a near-miss — do not remove them:

**Chapters are pinned by Pressbooks ID, not title.** The `CHAPTERS` table carries
each chapter's numeric id. An earlier version matched by title, which meant that
renaming a chapter on either side made the lookup miss and the script silently
created a duplicate. By the time this was caught, 13 of 14 titles had drifted (the
`WIP:` prefixes and Chapter 2's rename) and a single run would have produced 13
duplicate chapters. If an id is not found, the script fails that chapter and says
so rather than falling back to creation.

**A drift guard refuses to overwrite pages edited in Pressbooks.** `.publish-state.json`
records each chapter's server-side `modified_gmt` at last publish. Before writing,
the script re-reads the live page; if the timestamp moved, that chapter is BLOCKED
and nothing is written. This is what protects against destroying an edit made on the
site — which is exactly how Section 2.5 of Chapter 2 nearly got erased.

`.publish-state.json` is committed to git on purpose. It is shared state about the
remote, not a local cache.

## The WIP prefix

Chapters still in progress publish with a `WIP: ` title prefix; the book's front
matter explains the convention to readers. The prefix is **not** typed into the
title — it is the last field of each `CHAPTERS` row. To finalize a chapter, flip
that flag to `False`. That is the only place the marker lives, so it can never
drift from the site again.

## Flags

- `--dry-run` — report what would be published, write nothing. Does not render or
  upload diagrams (converting during a dry run would litter the media library).
- `--only chapter-02.md [...]` — restrict the run to specific chapters.
- `--force` — publish even if the live page changed since last publish. **Destroys
  the Pressbooks-side edit.** Only after looking at the live page and deciding it
  is disposable.
- `--accept-current` — record the live version as the new baseline without writing
  any content. Use after manually pulling a Pressbooks edit into the `.md`, or to
  re-establish a baseline.

## Running it

The user typing `/publish-intro-db` is itself the explicit go-ahead to publish live —
don't ask for confirmation again before running it. Do stop and flag it to the user
before running if something looks wrong (`.env` missing, fewer than 14 `chapter-*.md`
files, or uncommitted changes in git — report which, rather than silently publishing).

Run `--dry-run` first when anything about the state is unclear.

After the run, report the summary line and the book URL. **If any chapters are
BLOCKED, do not re-run with `--force` to get past it.** Blocked means someone edited
that chapter on the site and that work is about to be destroyed. Show the user which
chapters blocked and let them decide; the fix is normally to pull the Pressbooks edit
into the `.md` file first.

## Setup (only if `.venv` doesn't exist yet)

```
cd "/Users/david/Documents/Claude/Projects/Intro to DBs"
python3 -m venv .venv && source .venv/bin/activate
pip install requests markdown python-dotenv
```

`.env` must contain:
```
PRESSBOOKS_USERNAME=...
PRESSBOOKS_APP_PASSWORD=...
```
If `.env` is missing, don't create it or ask the user for the password in chat — tell
them to copy `.env.example` to `.env` and fill in their credentials themselves in a text
editor, then re-invoke the skill.

## Known quirks (already handled in the script — don't "fix" these back)

- **Never reinstate title-based chapter matching, and never let the publish loop
  fall back to `create_chapter()`.** Both produce duplicate chapters. `create_chapter`
  still exists for genuinely adding a new chapter by hand, and is deliberately not
  called by the loop.
- Marshall's CloudFront WAF 403s the default `python-requests` User-Agent; the script
  sends a browser-style `User-Agent` header to work around it.
- The chapter REST endpoint is `pressbooks/v2/chapters` (plural), not `chapter`.
- The book is organized into 6 Pressbooks "parts" (sections). Each entry in `CHAPTERS`
  now carries its own `(part_title, order_within_part)` — the script resolves part
  titles to ids via `discover_parts_by_title()` and sends the right `part` + `menu_order`
  (menu_order is relative to the part, not global) on every create/update. **Do not**
  go back to a single default part for all chapters — an earlier version did that and
  it silently wiped out the user's part organization on every run (recovered manually
  2026-07-21 by reconstructing part assignments from part/chapter titles and confirming
  with the user). If the user reorganizes chapters into different parts, update the
  `CHAPTERS` table to match, don't just let the script overwrite it back.
- This Pressbooks instance has no Mermaid.js plugin, and `wptexturize` mangles raw
  diagram syntax anyway. So the script does NOT emit a live `<div class="mermaid">`.
  Instead each ` ```mermaid ` block is rendered to a PNG via the public mermaid.ink
  API, uploaded to the Pressbooks media library, and embedded as a normal `<img>`.
  This is intentional (confirmed with the user 2026-07-20) — don't revert it to a raw
  mermaid div, and don't be alarmed by "diagram N: rendered + uploaded" log lines or by
  requests going out to mermaid.ink — that's expected, normal behavior for every run
  that touches a chapter containing a Mermaid diagram.
- Markdown tables that immediately follow a caption line with no blank line (common in
  these chapters) get swallowed by python-markdown's block parser. The script
  normalizes blank lines around every table before conversion so they render properly.

## Failure modes

- **Auth failure (403 on `/wp/v2/users/me`)**: check `.env` values are correct.
- **CloudFront "Request blocked" HTML page**: the User-Agent workaround broke somehow —
  don't remove it.
- **"Could not find a 'chapters' endpoint"**: the book URL or REST API availability may
  have changed; verify https://pressbooks.marshall.edu/mis340 is reachable.
