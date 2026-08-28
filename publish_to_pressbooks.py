#!/usr/bin/env python3
"""
Publish "Relational Thinking: A Concepts-First Introduction to Databases for
the Age of AI" to Pressbooks.

Usage:
    python publish_to_pressbooks.py

Credentials are read from a .env file next to this script:
    PRESSBOOKS_USERNAME=your-username
    PRESSBOOKS_APP_PASSWORD=your-app-specific-password

Copy .env.example to .env and fill in your values (the .env file is
gitignored so your password never gets committed). If .env is missing
either value, you'll be prompted for it interactively instead.

The script reads chapter-01.md through chapter-14.md from the same folder,
converts them to HTML, and publishes each as a chapter in your Pressbooks book.

--- What this script fixes vs. a naive markdown->HTML conversion ---

1. TABLES: Several chapters have a bold "label" line (e.g. "**Song table:**")
   immediately followed by a markdown table with no blank line in between.
   python-markdown's block parser requires a blank line before a table to
   recognize it as a table; without one, the whole thing collapses into a
   single paragraph and the raw "| a | b |" pipe syntax leaks onto the page
   as plain text. This script normalizes blank lines around every table
   before conversion so every table renders as a real <table>.

2. MERMAID DIAGRAMS: Marshall's Pressbooks instance has no Mermaid.js
   plugin installed, and WordPress's default `wptexturize` filter mangles
   raw diagram text (straight quotes -> curly quotes, "--" -> an en-dash),
   which corrupts Mermaid syntax even if a renderer were later added. So
   instead of emitting a live <div class="mermaid">, this script renders
   each ```mermaid block to a PNG image via the public mermaid.ink
   rendering service, uploads that PNG to the Pressbooks media library,
   and embeds a normal <img> tag. Images aren't touched by wptexturize and
   don't depend on any Pressbooks plugin, so they display reliably.

Requirements:
    pip install requests markdown python-dotenv

Pressbooks book URL: https://pressbooks.marshall.edu/mis340/
"""

import os
import re
import sys
import json
import argparse
import time
import html
import base64
import getpass
import requests
from dotenv import load_dotenv
import markdown as md

# ── Configuration ────────────────────────────────────────────────────────────

BOOK_URL   = "https://pressbooks.marshall.edu/mis340"
API_BASE   = f"{BOOK_URL}/wp-json"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

MERMAID_INK_BASE = "https://mermaid.ink/img"  # public rendering service, no auth needed

load_dotenv(os.path.join(SCRIPT_DIR, ".env"))

# Each chapter is pinned to its Pressbooks chapter ID. Matching by *title* (as
# an earlier version did) is unsafe: renaming a chapter on either side makes the
# lookup miss, and the script then CREATES A DUPLICATE instead of updating. The
# ID is stable across renames, so it is the only safe identity.
#
# Fields: (filename, chapter_id, title, part_title, order_within_part, wip)
#   wip=True prefixes the published title with "WIP: " — the book's front matter
#   tells readers that prefix means the chapter is still in progress. Flip it to
#   False when a chapter is finalized; that is the one place the marker lives.
# Pressbooks' menu_order is relative to the part, not global across the book.
CHAPTERS = [
    ("chapter-01.md",  21, "Data as a Way of Seeing",                    "How We Think About Data",           1, False),
    ("chapter-02.md",  24, "Entities, Attributes, and Identity: The World as Tables",
                                                                         "How We Think About Data",           2, False),
    ("chapter-03.md",  26, "Relationships: How Things Connect",          "How We Think About Data",           3, True),
    ("chapter-04.md",  28, "The Relational Model",                       "Relational Thinking",               1, True),
    ("chapter-05.md",  30, "Normalization as a Design Philosophy",       "Relational Thinking",               2, True),
    ("chapter-06.md",  32, "Data Modeling in Practice",                  "Relational Thinking",               3, True),
    ("chapter-07.md",  34, "Query Thinking: What Do You Want to Know?",  "Asking Questions of Data",          1, True),
    ("chapter-08.md",  36, "Introduction to SQL with AI Assistance",     "Asking Questions of Data",          2, True),
    ("chapter-09.md",  38, "Joins and Aggregation",                      "Asking Questions of Data",          3, True),
    ("chapter-10.md",  40, "Designing for a Business Domain",            "Database Design for Real Problems", 1, True),
    ("chapter-11.md",  42, "Data Integrity and Constraints",             "Database Design for Real Problems", 2, True),
    ("chapter-12.md", 114, "When Relational Isn't Enough",               "Beyond the Relational Model",       1, True),
    ("chapter-13.md",  46, "Data at Scale and the Modern Data Stack",    "Beyond the Relational Model",       2, True),
    ("chapter-14.md",  48, "Capstone and the Future of Data Work",       "Putting It Together",               1, True),
]

WIP_PREFIX = "WIP: "

# Records each chapter's server-side modified timestamp as of the last successful
# publish, so the next run can tell whether the live page was edited in Pressbooks
# in the meantime. Committed to git on purpose — it is shared state, not a cache.
STATE_FILE = os.path.join(SCRIPT_DIR, ".publish-state.json")


def published_title(title: str, wip: bool) -> str:
    return (WIP_PREFIX + title) if wip else title


def load_state() -> dict:
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, sort_keys=True)
        f.write("\n")

# ── Table fix: normalize blank lines around markdown tables ──────────────────

def _is_sep_row(line: str) -> bool:
    """True if `line` is a table divider row like '|---|:--:|---|'."""
    s = line.strip()
    if not s or "|" not in s or "-" not in s:
        return False
    return bool(re.fullmatch(r"[\s\|:\-]+", s))


def _is_table_row(line: str) -> bool:
    """True if `line` looks like a pipe-delimited table row."""
    s = line.strip()
    return "|" in s and not s.startswith("#")


def ensure_blank_lines_around_tables(text: str) -> str:
    """
    Guarantee a blank line immediately before and after every markdown
    table, regardless of what precedes/follows it in the source. Without
    this, a table that directly follows a text line (e.g. a bold caption
    with no blank line before the header row) gets swallowed into a
    paragraph and never recognized as a table by python-markdown.
    """
    lines = text.split("\n")

    # Pass 1: ensure a blank line BEFORE each table's header row.
    out = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if (
            i + 1 < n
            and _is_sep_row(lines[i + 1])
            and _is_table_row(line)
            and out
            and out[-1].strip() != ""
        ):
            out.append("")
        out.append(line)
        i += 1

    # Pass 2: ensure a blank line AFTER each table's last row.
    lines2 = out
    out2 = []
    n2 = len(lines2)
    i = 0
    while i < n2:
        line = lines2[i]
        out2.append(line)
        is_row = _is_table_row(line) or _is_sep_row(line)
        next_is_row = i + 1 < n2 and (_is_table_row(lines2[i + 1]) or _is_sep_row(lines2[i + 1]))
        next_is_blank = i + 1 < n2 and lines2[i + 1].strip() == ""
        if is_row and i + 1 < n2 and not next_is_row and not next_is_blank:
            out2.append("")
        i += 1

    return "\n".join(out2)


# ── Mermaid fix: render to PNG and upload as media ────────────────────────────

def render_mermaid_png(diagram_code: str) -> bytes:
    """Render Mermaid diagram source to PNG bytes via mermaid.ink."""
    encoded = base64.urlsafe_b64encode(diagram_code.encode("utf-8")).decode("ascii")
    url = f"{MERMAID_INK_BASE}/{encoded}?type=png&width=1400&backgroundColor=white"
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            return r.content
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2)


def upload_media(session: requests.Session, image_bytes: bytes, filename: str) -> str:
    """Upload an image to the WordPress media library. Returns the media source_url."""
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "image/png",
    }
    r = session.post(f"{API_BASE}/wp/v2/media", headers=headers, data=image_bytes)
    r.raise_for_status()
    return r.json()["source_url"]


def process_mermaid_diagrams(text: str, session: requests.Session, chapter_slug: str) -> str:
    """
    Replace every ```mermaid fenced block with a rendered <img> pointing at
    an uploaded PNG. Falls back to a labeled code block if rendering or
    upload fails, so a diagram problem never silently deletes content.
    """
    pattern = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
    counter = {"n": 0}

    def repl(match):
        counter["n"] += 1
        idx = counter["n"]
        diagram_code = match.group(1).strip()

        try:
            png_bytes = render_mermaid_png(diagram_code)
            filename = f"{chapter_slug}-diagram-{idx}.png"
            media_url = upload_media(session, png_bytes, filename)
            print(f"      ↳ diagram {idx}: rendered + uploaded ✓")
            return (
                f'\n\n<figure class="wp-block-image size-large">'
                f'<img src="{media_url}" alt="Entity-relationship diagram {idx}" />'
                f"</figure>\n\n"
            )
        except Exception as e:
            print(f"      ↳ diagram {idx}: render/upload FAILED ({e}) — keeping as code block")
            escaped = (
                diagram_code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            )
            return f"\n\n```\n{escaped}\n```\n\n"

    return pattern.sub(repl, text)


# ── Markdown → HTML conversion ────────────────────────────────────────────────

MARKDOWN_EXTENSIONS = [
    "tables",        # GFM-style tables
    "fenced_code",   # ``` code blocks
    "codehilite",    # syntax highlighting (graceful fallback if Pygments missing)
    "toc",           # [TOC] support
    "nl2br",         # newlines → <br> inside paragraphs
    "sane_lists",    # better list handling
]


def markdown_to_html(text: str, session: requests.Session, chapter_slug: str) -> str:
    """Convert markdown to HTML, fixing table spacing and rendering Mermaid diagrams as images."""

    # Strip the top-level H1 (Pressbooks uses the chapter title field instead)
    text = re.sub(r"^#\s+.+\n", "", text, count=1)

    # Render + upload Mermaid diagrams before the markdown pass, so the
    # resulting <figure><img></figure> blocks pass through untouched.
    text = process_mermaid_diagrams(text, session, chapter_slug)

    # Guarantee blank lines around every table so none of them collapse
    # into a plain paragraph of raw pipe characters.
    text = ensure_blank_lines_around_tables(text)

    converter = md.Markdown(extensions=MARKDOWN_EXTENSIONS)
    html = converter.convert(text)
    return html


def get_credentials() -> tuple:
    """
    Return (username, app_password), preferring PRESSBOOKS_USERNAME /
    PRESSBOOKS_APP_PASSWORD from .env. Falls back to an interactive prompt
    for whichever value is missing.
    """
    username = os.environ.get("PRESSBOOKS_USERNAME") or input("Pressbooks username: ").strip()
    app_password = os.environ.get("PRESSBOOKS_APP_PASSWORD") or getpass.getpass("App Specific Password: ").strip()

    if os.environ.get("PRESSBOOKS_USERNAME") and os.environ.get("PRESSBOOKS_APP_PASSWORD"):
        print(f"Using credentials from .env for: {username}")

    return username, app_password


# ── Pressbooks / WordPress REST API helpers ───────────────────────────────────

def get_session(username: str, app_password: str) -> requests.Session:
    session = requests.Session()
    session.auth = (username, app_password)
    session.headers.update({
        "Content-Type": "application/json",
        # Marshall's CloudFront WAF blocks the default python-requests
        # User-Agent with a 403 before the request ever reaches WordPress.
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
    })
    return session


def verify_credentials(session: requests.Session) -> dict:
    """Check that the credentials are valid and return the WP user record."""
    r = session.get(f"{API_BASE}/wp/v2/users/me")
    r.raise_for_status()
    return r.json()


def discover_chapter_endpoint(session: requests.Session) -> str:
    """
    Pressbooks registers a 'chapter' custom post type with rest_base 'chapters'.
    Try the Pressbooks v2 API first, then fall back to wp/v2/chapters.
    Returns the base endpoint URL for creating chapters.
    """
    r = session.get(f"{API_BASE}/pressbooks/v2/chapters")
    if r.status_code == 200:
        return f"{API_BASE}/pressbooks/v2/chapters"

    r = session.get(f"{API_BASE}/wp/v2/chapters")
    if r.status_code == 200:
        return f"{API_BASE}/wp/v2/chapters"

    raise RuntimeError(
        "Could not find a 'chapters' endpoint on this Pressbooks instance.\n"
        "Check that the book exists at the configured URL and that the REST API is enabled."
    )


def discover_parts_by_title(session: requests.Session) -> dict:
    """
    Chapters must belong to a 'part'. Return {part title: part id} so each
    chapter can be placed in the correct part (see CHAPTERS above) instead
    of all being dumped into a single default part.
    """
    r = session.get(f"{API_BASE}/pressbooks/v2/parts", params={"per_page": 100, "status": "any"})
    r.raise_for_status()
    parts = r.json()
    if not parts:
        raise RuntimeError("This book has no 'part' to attach chapters to.")
    return {html.unescape(p["title"]["rendered"]).strip(): p["id"] for p in parts}


def list_existing_chapters(session: requests.Session, endpoint: str) -> list:
    """Return all chapters currently in the book (title + id)."""
    chapters = []
    page = 1
    while True:
        r = session.get(endpoint, params={"per_page": 100, "page": page, "status": "any"})
        if r.status_code == 400:
            break  # no more pages
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        chapters.extend(batch)
        page += 1
    return chapters


def create_chapter(session: requests.Session, endpoint: str,
                   title: str, html: str, menu_order: int, part_id: int) -> dict:
    """Create a brand-new chapter. DELIBERATELY NOT CALLED by the publish loop.

    Every chapter in CHAPTERS is pinned to an existing Pressbooks ID, and the
    loop refuses to proceed when an ID is missing rather than falling back to
    creation. That fallback is exactly what produced duplicate chapters before.
    Call this by hand when genuinely adding a chapter, then record its new ID in
    CHAPTERS and run once with --accept-current.
    """
    payload = {
        "title":      title,
        "content":    html,
        "status":     "publish",
        "menu_order": menu_order,
        "part":       part_id,
    }
    r = session.post(endpoint, json=payload)
    r.raise_for_status()
    return r.json()


def update_chapter(session: requests.Session, endpoint: str,
                   chapter_id: int, title: str, html: str, menu_order: int, part_id: int) -> dict:
    payload = {
        "title":      title,
        "content":    html,
        "status":     "publish",
        "menu_order": menu_order,
        "part":       part_id,
    }
    r = session.patch(f"{endpoint}/{chapter_id}", json=payload)
    r.raise_for_status()
    return r.json()


def fetch_chapter(session: requests.Session, endpoint: str, chapter_id: int) -> dict:
    """Current server state for one chapter, or {} if it no longer exists."""
    r = session.get(f"{endpoint}/{chapter_id}", params={"context": "edit"})
    if r.status_code == 404:
        return {}
    r.raise_for_status()
    return r.json()


def drift_check(chapter: dict, recorded: dict) -> str:
    """Return a human-readable reason to STOP, or "" if it is safe to publish.

    The live page is safe to overwrite only if it has not been modified since we
    last published it. Anything else means someone edited in Pressbooks and that
    work would be destroyed by a blind update.
    """
    if not recorded:
        return ("no record of a previous publish for this chapter — "
                "publish once with --accept-current to adopt the live version")
    live = chapter.get("modified_gmt")
    if live and live != recorded.get("modified_gmt"):
        return (f"live page changed since last publish "
                f"(was {recorded.get('modified_gmt')}, now {live})")
    return ""


# ── Main publish flow ─────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Publish Relational Thinking to Pressbooks.")
    p.add_argument("--only", nargs="+", metavar="FILE",
                   help="publish only these chapter files (e.g. chapter-02.md)")
    p.add_argument("--force", action="store_true",
                   help="overwrite even if the live page changed since last publish")
    p.add_argument("--accept-current", action="store_true",
                   help="record the live version as the baseline without writing content")
    p.add_argument("--dry-run", action="store_true",
                   help="show what would be published without writing anything")
    return p.parse_args()


def main():
    args = parse_args()
    print("=" * 60)
    print("Pressbooks Publisher")
    print(f"Book: {BOOK_URL}")
    print("=" * 60)

    # Credentials
    username, app_password = get_credentials()

    session = get_session(username, app_password)

    # Verify credentials
    print("\nVerifying credentials…")
    try:
        user = verify_credentials(session)
        print(f"✓ Authenticated as: {user.get('name', username)}")
    except requests.HTTPError as e:
        print(f"✗ Authentication failed: {e}")
        print("  (Check PRESSBOOKS_USERNAME / PRESSBOOKS_APP_PASSWORD in .env)")
        sys.exit(1)

    # Find chapter endpoint
    print("Discovering chapter endpoint…")
    try:
        endpoint = discover_chapter_endpoint(session)
        print(f"✓ Chapter endpoint: {endpoint}")
    except RuntimeError as e:
        print(f"✗ {e}")
        sys.exit(1)

    # Map each chapter's part title (see CHAPTERS above) to its part id
    try:
        parts_by_title = discover_parts_by_title(session)
        print(f"✓ Found {len(parts_by_title)} part(s): {', '.join(parts_by_title)}")
    except (RuntimeError, requests.HTTPError) as e:
        print(f"✗ {e}")
        sys.exit(1)

    state = load_state()

    print()
    success, skipped, failed, blocked = 0, 0, 0, 0

    for i, (filename, chapter_id, title, part_title, order, wip) in enumerate(CHAPTERS, start=1):
        if args.only and filename not in args.only:
            continue

        filepath = os.path.join(SCRIPT_DIR, filename)
        live_title = published_title(title, wip)

        if not os.path.exists(filepath):
            print(f"  [SKIP] {filename} not found — skipping.")
            skipped += 1
            continue

        if part_title not in parts_by_title:
            print(f"  [{i:02d}] {live_title} … ✗ part {part_title!r} not found on the book "
                  f"(available: {', '.join(parts_by_title)})")
            failed += 1
            continue
        part_id = parts_by_title[part_title]

        print(f"  [{i:02d}] {live_title} … (id={chapter_id}, {part_title} #{order})")

        try:
            current = fetch_chapter(session, endpoint, chapter_id)
        except requests.HTTPError as e:
            print(f"       FAILED ✗ could not read live chapter: {e}")
            failed += 1
            continue

        if not current:
            print(f"       ✗ chapter id {chapter_id} does not exist on the book. "
                  f"Fix the id in CHAPTERS — this script never creates chapters, "
                  f"because a wrong id would silently duplicate one.")
            failed += 1
            continue

        # Refuse to clobber edits made in Pressbooks since our last publish.
        if not (args.force or args.accept_current):
            reason = drift_check(current, state.get(str(chapter_id)))
            if reason:
                print(f"       BLOCKED — {reason}")
                print(f"       Review {BOOK_URL}/chapter/{current.get('slug','')}/ then re-run with")
                print(f"         --only {filename} --force            (overwrite the live page)")
                print(f"         --only {filename} --accept-current   (adopt live as the baseline)")
                blocked += 1
                continue

        if args.accept_current:
            state[str(chapter_id)] = {"file": filename, "slug": current.get("slug"),
                                      "modified_gmt": current.get("modified_gmt")}
            print("       baseline adopted (no content written) ✓")
            save_state(state)
            success += 1
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()

        # Check this BEFORE converting: markdown_to_html renders every Mermaid
        # block and uploads the PNG to the media library, so converting during a
        # dry run would litter the library with orphan images on every run.
        if args.dry_run:
            diagrams = raw.count("```mermaid")
            print(f"       dry run — would update from {filename} "
                  f"({len(raw):,} chars of markdown"
                  + (f", {diagrams} diagram(s) to render" if diagrams else "")
                  + f"), title {live_title!r}")
            success += 1
            continue

        chapter_slug = os.path.splitext(filename)[0]
        chapter_html = markdown_to_html(raw, session, chapter_slug)

        try:
            result = update_chapter(session, endpoint, chapter_id, live_title,
                                    chapter_html, order, part_id)
            state[str(chapter_id)] = {"file": filename, "slug": result.get("slug"),
                                      "modified_gmt": result.get("modified_gmt")}
            save_state(state)
            print("       updated ✓")
            success += 1
        except requests.HTTPError as e:
            print(f"       FAILED ✗\n       {e.response.status_code}: {e.response.text[:200]}")
            failed += 1

    # Summary
    print()
    print("=" * 60)
    verb = "would publish" if args.dry_run else "published"
    print(f"Done.  {success} {verb},  {skipped} skipped,  {blocked} blocked,  {failed} failed.")
    if blocked:
        print("\n  Blocked chapters were edited in Pressbooks since the last publish.")
        print("  Nothing was overwritten. Pull those edits into the .md first,")
        print("  or re-run with --force if the live version is disposable.")
    if success > 0:
        print(f"\nView your book: {BOOK_URL}")
    print("=" * 60)


if __name__ == "__main__":
    main()
