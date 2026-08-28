---
name: publish-intro-db
description: Publish the "Relational Thinking: An Introduction to Databases" textbook chapters to the Marshall University Pressbooks site. Use this skill whenever the user invokes "/publish-intro-db", or asks to publish, push, sync, or upload the Intro to Databases chapters to Pressbooks.
version: 1.0.0
---

# /publish-intro-db — Publish chapters to Pressbooks

Publishes/updates all `chapter-NN.md` files in this project to the book at
https://pressbooks.marshall.edu/mis340 by running `publish_to_pressbooks.py`.

## When to use

Trigger whenever the user types `/publish-intro-db`, or asks to publish, push,
sync, or upload the textbook chapters to Pressbooks.

## How it works

Run, from the project root (venv must already exist — see Setup below if it doesn't):

```
cd "/Users/david/Documents/Claude/Projects/Intro to DBs"
source .venv/bin/activate
python publish_to_pressbooks.py
```

The script:
- reads `PRESSBOOKS_USERNAME` / `PRESSBOOKS_APP_PASSWORD` from `.env` in the project root
- converts `chapter-01.md` through `chapter-14.md` to HTML
- creates any chapter that doesn't exist yet in the book, or updates it in place if a
  chapter with the same title already exists (matched by title, so re-running is safe
  and won't create duplicates)
- publishes everything with `status: "publish"` — changes go live on the public book
  immediately

The user typing `/publish-intro-db` is itself the explicit go-ahead to publish live —
don't ask for confirmation again before running it. Do stop and flag it to the user if
something looks wrong before running (e.g. `.env` is missing, or fewer than 14
`chapter-*.md` files are present — report which are missing rather than silently
publishing a partial set).

After the run, report the summary line (`N published, N skipped, N failed`) and the
book URL. If any chapters failed, show the per-chapter error output so the user can see
what the server returned.

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
