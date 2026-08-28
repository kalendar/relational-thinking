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

# Each chapter's home part and its 1-based position *within that part*
# (Pressbooks' menu_order is relative to the part, not global across the book).
CHAPTERS = [
    ("chapter-01.md", "Data as a Way of Seeing",                       "How We Think About Data",           1),
    ("chapter-02.md", "Entities, Attributes, and the World as Tables", "How We Think About Data",           2),
    ("chapter-03.md", "Relationships: How Things Connect",             "How We Think About Data",           3),
    ("chapter-04.md", "The Relational Model",                          "Relational Thinking",               1),
    ("chapter-05.md", "Normalization as a Design Philosophy",          "Relational Thinking",               2),
    ("chapter-06.md", "Data Modeling in Practice",                     "Relational Thinking",               3),
    ("chapter-07.md", "Query Thinking: What Do You Want to Know?",     "Asking Questions of Data",           1),
    ("chapter-08.md", "Introduction to SQL with AI Assistance",        "Asking Questions of Data",           2),
    ("chapter-09.md", "Joins and Aggregation",                         "Asking Questions of Data",           3),
    ("chapter-10.md", "Designing for a Business Domain",                "Database Design for Real Problems", 1),
    ("chapter-11.md", "Data Integrity and Constraints",                 "Database Design for Real Problems", 2),
    ("chapter-12.md", "When Relational Isn't Enough",                   "Beyond the Relational Model",       1),
    ("chapter-13.md", "Data at Scale and the Modern Data Stack",        "Beyond the Relational Model",       2),
    ("chapter-14.md", "Capstone and the Future of Data Work",           "Putting It Together",               1),
]

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


# ── Main publish flow ─────────────────────────────────────────────────────────

def main():
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

    # Load existing chapters (to support re-runs without duplication)
    print("Loading existing chapters…")
    existing = list_existing_chapters(session, endpoint)
    # WordPress's title.rendered is HTML (wptexturize turns straight quotes into
    # curly ones and HTML-encodes them), so unescape + normalize curly quotes back
    # to straight ones before matching against our plain-text CHAPTERS titles.
    def normalize_title(t: str) -> str:
        t = html.unescape(t).strip()
        return t.replace("’", "'").replace("‘", "'")

    existing_by_title = {
        normalize_title(ch["title"]["rendered"]): ch["id"]
        for ch in existing
    }
    print(f"  Found {len(existing)} existing chapter(s).")

    # Publish each chapter
    print()
    success, skipped, failed = 0, 0, 0

    for i, (filename, title, part_title, order) in enumerate(CHAPTERS, start=1):
        filepath = os.path.join(SCRIPT_DIR, filename)

        if not os.path.exists(filepath):
            print(f"  [SKIP] {filename} not found — skipping.")
            skipped += 1
            continue

        if part_title not in parts_by_title:
            print(f"  [{i:02d}] {title} … ✗ part {part_title!r} not found on the book "
                  f"(available: {', '.join(parts_by_title)})")
            failed += 1
            continue
        part_id = parts_by_title[part_title]

        print(f"  [{i:02d}] {title} … ({part_title} #{order})")

        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()

        chapter_slug = os.path.splitext(filename)[0]  # e.g. "chapter-06"
        chapter_html = markdown_to_html(raw, session, chapter_slug)

        try:
            if title in existing_by_title:
                chapter_id = existing_by_title[title]
                update_chapter(session, endpoint, chapter_id, title, chapter_html, order, part_id)
                print("       updated ✓")
            else:
                result = create_chapter(session, endpoint, title, chapter_html, order, part_id)
                print(f"       created (id={result['id']}) ✓")
            success += 1
        except requests.HTTPError as e:
            print(f"       FAILED ✗\n       {e.response.status_code}: {e.response.text[:200]}")
            failed += 1

    # Summary
    print()
    print("=" * 60)
    print(f"Done.  {success} published,  {skipped} skipped,  {failed} failed.")
    if success > 0:
        print(f"\nView your book: {BOOK_URL}")
    print("=" * 60)


if __name__ == "__main__":
    main()
