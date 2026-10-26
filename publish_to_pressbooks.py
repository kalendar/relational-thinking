#!/usr/bin/env python3
"""
Publish "Relational Thinking: A Concepts-First Introduction to Databases for
the Age of AI" to Pressbooks.

Normally this runs in GitHub Actions, not by hand (see .github/workflows/ci.yml):
  - every pull request runs it with --dry-run, which reports which chapters
    would change on Pressbooks and renders a preview of each;
  - every merge to master runs it for real, and the publish state is saved to
    the `publish-state` branch.

Usage:
    python publish_to_pressbooks.py --dry-run          # safe anywhere: reads only
    python publish_to_pressbooks.py --local ...        # real publish from a laptop
                                                       # (emergencies only)

Credentials come from the environment (GitHub repository secrets in CI), or
from a .env file next to this script when run by hand:
    PRESSBOOKS_USERNAME=your-username
    PRESSBOOKS_APP_PASSWORD=your-app-specific-password
The .env file is gitignored, so the password never gets committed.

The script reads chapter-01.md through chapter-14.md from the same folder,
converts them to HTML, and updates each chapter in the Pressbooks book. It only
writes a chapter whose rendered content, title or place in the book actually
changed since the last publish (or that is named with --only).

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

3. LOCAL IMAGES: A chapter can reference an image sitting next to it in this
   folder with a plain relative-path <img src="./diagram.png"> tag. That
   path only resolves on this machine, so before conversion the script
   uploads any such file to the Pressbooks media library and rewrites src
   to point at the uploaded URL — the same treatment Mermaid diagrams get,
   just for hand-placed images instead of generated ones.

Requirements (pinned in ci/requirements-publish.txt so CI renders exactly what
a laptop does — note that Pygments is deliberately NOT installed, which keeps
code blocks unhighlighted the way they have always been published):
    pip install -r ci/requirements-publish.txt

Pressbooks book URL: https://pressbooks.marshall.edu/mis340/
"""

import os
import re
import sys
import json
import argparse
import struct
import time
import html
import base64
import mimetypes
import getpass
import hashlib
import difflib
import subprocess
import requests
from dotenv import load_dotenv

# Every chapter has always been published from a machine WITHOUT Pygments, so
# code blocks come out unhighlighted. If Pygments happens to be installed (as it
# is on some CI images), python-markdown's codehilite would start emitting
# highlighted markup and every chapter with code would "change". Hiding it keeps
# the output identical on every machine.
sys.modules["pygments"] = None
import markdown as md

# ── Configuration ────────────────────────────────────────────────────────────

BOOK_URL   = "https://pressbooks.marshall.edu/mis340"
API_BASE   = f"{BOOK_URL}/wp-json"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

MERMAID_INK_BASE = "https://mermaid.ink/img"  # public rendering service, no auth needed
MAX_DIAGRAM_WIDTH = 1400  # cap oversized diagrams down to this; never upscale past it

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
    ("chapter-03.md",  26, "Relationships: How Things Connect",          "How We Think About Data",           3, False),
    ("chapter-04.md",  28, "The Relational Model",                       "Relational Thinking",               1, False),
    ("chapter-05.md",  30, "Normalization as a Design Philosophy",       "Relational Thinking",               2, False),
    ("chapter-06.md",  32, "Data Modeling in Practice",                  "Relational Thinking",               3, False),
    ("chapter-07.md",  34, "Query Thinking: What Do You Want to Know?",  "Asking Questions of Data",          1, False),
    ("chapter-08.md",  36, "Introduction to SQL with AI Assistance",     "Asking Questions of Data",          2, False),
    ("chapter-09.md",  38, "Joins and Aggregation",                      "Asking Questions of Data",          3, False),
    ("chapter-10.md",  40, "Designing for a Business Domain",            "Database Design for Real Problems", 1, True),
    ("chapter-11.md",  42, "Data Integrity and Constraints",             "Database Design for Real Problems", 2, True),
    ("chapter-12.md", 114, "When Relational Isn't Enough",               "Beyond the Relational Model",       1, True),
    ("chapter-13.md",  46, "Data at Scale and the Modern Data Stack",    "Beyond the Relational Model",       2, True),
    ("chapter-14.md",  48, "Capstone and the Future of Data Work",       "Putting It Together",               1, True),
]

WIP_PREFIX = "WIP: "

# Records, per chapter, what the last successful publish left on the server:
#   modified_gmt   the server's timestamp right after we wrote it
#   live_sha256    hash of the exact stored content right after we wrote it
#   sent_sha256    fingerprint of what we sent (title, part, order, and the HTML
#                  with image URLs masked) - used to skip unchanged chapters
#   commit         the git commit that was published
# so the next run can tell whether the live page was edited in Pressbooks in the
# meantime. In CI this file lives on the `publish-state` branch (--state), not on
# master, because master only accepts changes through pull requests.
STATE_FILE = os.path.join(SCRIPT_DIR, ".publish-state.json")


def published_title(title: str, wip: bool) -> str:
    return (WIP_PREFIX + title) if wip else title


def load_state(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}


def save_state(state: dict, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, sort_keys=True)
        f.write("\n")


# ── Fingerprints and plain-text comparison ────────────────────────────────────

def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


IMG_SRC_RE = re.compile(r'(<img\b[^>]*?\bsrc=")[^"]*(")')


def mask_images(html_text: str) -> str:
    """Blank out every <img src>. A Mermaid diagram or local image gets a new
    media-library URL on every upload, so the URL says nothing about whether
    the chapter's content changed."""
    return IMG_SRC_RE.sub(r"\1\2", html_text)


def fingerprint(title: str, part_id, order, html_text: str) -> str:
    return sha256(json.dumps([title, part_id, order, mask_images(html_text).strip()]))


def live_fingerprint(chapter: dict) -> str:
    return fingerprint((chapter.get("title") or {}).get("raw", ""), chapter.get("part"),
                       chapter.get("menu_order"), (chapter.get("content") or {}).get("raw", ""))


_TEXT_FOLD = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"',
                            "–": "-", "—": "-", " ": " ", "…": "..."})


def to_text_lines(html_text: str) -> list:
    """HTML -> plain-text lines, for human-readable diffs. Folds curly quotes and
    dashes back to straight ones, since WordPress converts them on display."""
    t = re.sub(r"(?i)<br\s*/?>|</(p|li|h\d|div|tr|blockquote|figure|pre|header)>", "\n", html_text)
    t = html.unescape(re.sub(r"<[^>]+>", "", t)).translate(_TEXT_FOLD)
    return [re.sub(r"\s+", " ", l).strip() for l in t.split("\n") if l.strip()]


def text_diff(old_html: str, new_html: str, old_label: str, new_label: str, limit: int = 120) -> str:
    lines = list(difflib.unified_diff(to_text_lines(old_html), to_text_lines(new_html),
                                      old_label, new_label, lineterm="", n=1))
    if len(lines) > limit:
        lines = lines[:limit] + [f"... ({len(lines) - limit} more diff lines not shown)"]
    return "\n".join(lines)


def markup_diff(old_html: str, new_html: str, old_label: str, new_label: str, limit: int = 80) -> str:
    """Diff of the HTML itself (image URLs masked), one tag per line, for when
    the visible text is the same but the markup isn't."""
    split = lambda h: [l for l in re.sub(r">\s*<", ">\n<", mask_images(h)).split("\n") if l.strip()]
    lines = list(difflib.unified_diff(split(old_html), split(new_html), old_label, new_label, lineterm="", n=0))
    if len(lines) > limit:
        lines = lines[:limit] + [f"... ({len(lines) - limit} more diff lines not shown)"]
    return "\n".join(lines)


def markdown_at_commit(commit: str, filename: str) -> str:
    """The chapter's markdown as of a past commit, or "" if git can't provide it."""
    try:
        return subprocess.run(["git", "show", f"{commit}:{filename}"], cwd=SCRIPT_DIR,
                              capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return ""

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


def _fenced_code_flags(lines: list) -> list:
    """
    Return a same-length list of booleans: True where `lines[i]` is content
    sitting inside a ``` fenced code block (the fence delimiter lines
    themselves are always False). Used so table-row detection below never
    mistakes a literal "|" in example text - crow's-foot notation, pipes in
    a shell command, etc. - for markdown table syntax.
    """
    flags = []
    in_fence = False
    for line in lines:
        if line.strip().startswith("```"):
            flags.append(False)
            in_fence = not in_fence
        else:
            flags.append(in_fence)
    return flags


def ensure_blank_lines_around_tables(text: str) -> str:
    """
    Guarantee a blank line immediately before and after every markdown
    table, regardless of what precedes/follows it in the source. Without
    this, a table that directly follows a text line (e.g. a bold caption
    with no blank line before the header row) gets swallowed into a
    paragraph and never recognized as a table by python-markdown.

    Skips any line inside a fenced code block (see `_fenced_code_flags`).
    A "|" inside a ``` fence is example text, not a table - e.g. Chapter 6's
    crow's-foot notation legend ("|    exactly one (mandatory)") used to
    get a spurious blank line inserted after it because this function saw
    the "|" and treated it as a table row, even though the whole block was
    already literal code-block content.
    """
    lines = text.split("\n")
    in_fence = _fenced_code_flags(lines)

    # Pass 1: ensure a blank line BEFORE each table's header row.
    out = []
    out_fence = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if (
            not in_fence[i]
            and i + 1 < n
            and not in_fence[i + 1]
            and _is_sep_row(lines[i + 1])
            and _is_table_row(line)
            and out
            and out[-1].strip() != ""
        ):
            out.append("")
            out_fence.append(False)
        out.append(line)
        out_fence.append(in_fence[i])
        i += 1

    # Pass 2: ensure a blank line AFTER each table's last row.
    lines2 = out
    fence2 = out_fence
    out2 = []
    n2 = len(lines2)
    i = 0
    while i < n2:
        line = lines2[i]
        out2.append(line)
        is_row = not fence2[i] and (_is_table_row(line) or _is_sep_row(line))
        next_in_fence = i + 1 < n2 and fence2[i + 1]
        next_is_row = (
            i + 1 < n2
            and not next_in_fence
            and (_is_table_row(lines2[i + 1]) or _is_sep_row(lines2[i + 1]))
        )
        next_is_blank = i + 1 < n2 and lines2[i + 1].strip() == ""
        if is_row and i + 1 < n2 and not next_is_row and not next_is_blank:
            out2.append("")
        i += 1

    return "\n".join(out2)


# ── Mermaid fix: render to PNG and upload as media ────────────────────────────

def render_mermaid_png(diagram_code: str) -> bytes:
    """Render Mermaid diagram source to PNG bytes via mermaid.ink.

    Renders at the diagram's own natural size first - mermaid.ink sizes each
    diagram from its own content (node count, label length), so a two-entity
    diagram and a ten-entity ERD each come out proportioned to what they
    actually contain. Only re-renders with an explicit width if that natural
    render is wider than MAX_DIAGRAM_WIDTH, to cap oversized diagrams down to
    a reasonable page width - never to scale a small diagram up.

    Forcing every diagram to a flat width regardless of its natural size used
    to make a trivial two-entity diagram balloon to ~1400x3400px (mermaid.ink
    preserves aspect ratio, so scaling a narrow, tall diagram up to a wide
    fixed width blows up the height even further) while barely touching a
    genuinely complex ERD whose natural width was already close to 1400px.
    """
    encoded = base64.urlsafe_b64encode(diagram_code.encode("utf-8")).decode("ascii")

    def fetch(url: str) -> bytes:
        for attempt in range(3):
            try:
                r = requests.get(url, timeout=30)
                r.raise_for_status()
                return r.content
            except requests.RequestException:
                if attempt == 2:
                    raise
                time.sleep(2)

    natural_url = f"{MERMAID_INK_BASE}/{encoded}?type=png&backgroundColor=white"
    png_bytes = fetch(natural_url)

    # PNG IHDR chunk: 8-byte signature + 4-byte length + 4-byte "IHDR" tag,
    # then a 4-byte big-endian width and a 4-byte big-endian height.
    natural_width = struct.unpack(">I", png_bytes[16:20])[0]

    if natural_width > MAX_DIAGRAM_WIDTH:
        capped_url = (
            f"{MERMAID_INK_BASE}/{encoded}?type=png&width={MAX_DIAGRAM_WIDTH}"
            f"&backgroundColor=white"
        )
        png_bytes = fetch(capped_url)

    return png_bytes


def upload_media(session: requests.Session, image_bytes: bytes, filename: str,
                  content_type: str = "image/png") -> str:
    """Upload an image to the WordPress media library. Returns the media source_url."""
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": content_type,
    }
    r = session.post(f"{API_BASE}/wp/v2/media", headers=headers, data=image_bytes)
    r.raise_for_status()
    return r.json()["source_url"]


class PublishError(Exception):
    """A diagram or image couldn't be prepared, so the chapter must not be published."""


def process_mermaid_diagrams(text: str, session, chapter_slug: str) -> str:
    """
    Replace every ```mermaid fenced block with an <img> of the rendered diagram.

    With a session, the PNG is rendered via mermaid.ink and uploaded to the
    media library. With session=None (previews and change detection) nothing is
    uploaded: the <img> points straight at mermaid.ink, which renders on view.

    A render or upload failure raises PublishError and the chapter is not
    published. (An earlier version fell back to publishing the diagram source as
    a code block, which shipped a broken-looking page without anyone noticing.)
    """
    pattern = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
    counter = {"n": 0}

    def repl(match):
        counter["n"] += 1
        idx = counter["n"]
        diagram_code = match.group(1).strip()

        if session is None:
            encoded = base64.urlsafe_b64encode(diagram_code.encode("utf-8")).decode("ascii")
            media_url = f"{MERMAID_INK_BASE}/{encoded}?type=png&backgroundColor=white"
        else:
            try:
                png_bytes = render_mermaid_png(diagram_code)
                filename = f"{chapter_slug}-diagram-{idx}.png"
                media_url = upload_media(session, png_bytes, filename)
                print(f"      ↳ diagram {idx}: rendered + uploaded ✓")
            except Exception as e:
                raise PublishError(f"diagram {idx} could not be rendered/uploaded ({e})") from e
        return (
            f'\n\n<figure class="wp-block-image size-large">'
            f'<img src="{media_url}" alt="Entity-relationship diagram {idx}" />'
            f"</figure>\n\n"
        )

    return pattern.sub(repl, text)


# ── Local images: upload to media library and rewrite the src ─────────────────

LOCAL_IMG_RE = re.compile(r"<img\b[^>]*>")


def process_local_images(text: str, session, chapter_slug: str) -> str:
    """
    Find every <img> tag whose src is a local relative path (e.g.
    "./set_theory.png", not an http(s) URL) and upload that file from the
    chapter's own folder to the WordPress media library, rewriting src to the
    uploaded source_url. All other attributes on the tag (alt, width, etc.)
    are left untouched.

    With session=None (previews and change detection) nothing is uploaded and
    the relative src is kept. A missing file or a failed upload raises
    PublishError, so a chapter never goes live with a broken image.
    """
    if session is None:
        for src in re.findall(r'<img\b[^>]*\bsrc="(\./[^"]+)"', text):
            if not os.path.exists(os.path.join(SCRIPT_DIR, src[2:])):
                raise PublishError(f"image {src} not found")
        return text
    counter = {"n": 0}

    def repl(match):
        tag = match.group(0)
        src_match = re.search(r'src="([^"]+)"', tag)
        if not src_match:
            return tag
        src = src_match.group(1)
        if re.match(r"^(https?:)?//", src) or src.startswith("http"):
            return tag  # already a remote URL — nothing to upload

        counter["n"] += 1
        idx = counter["n"]
        local_path = os.path.join(SCRIPT_DIR, src.lstrip("./"))

        if not os.path.exists(local_path):
            raise PublishError(f"image {idx} ({src}) not found")

        try:
            with open(local_path, "rb") as fh:
                image_bytes = fh.read()
            ext = os.path.splitext(local_path)[1].lstrip(".").lower() or "png"
            content_type = mimetypes.guess_type(local_path)[0] or f"image/{ext}"
            filename = f"{chapter_slug}-img-{idx}.{ext}"
            media_url = upload_media(session, image_bytes, filename, content_type)
            print(f"      ↳ image {idx} ({src}): uploaded ✓ -> {media_url}")
            return tag.replace(f'src="{src}"', f'src="{media_url}"')
        except Exception as e:
            raise PublishError(f"image {idx} ({src}) upload failed ({e})") from e

    return LOCAL_IMG_RE.sub(repl, text)


# ── Markdown → HTML conversion ────────────────────────────────────────────────

MARKDOWN_EXTENSIONS = [
    "tables",        # GFM-style tables
    "fenced_code",   # ``` code blocks
    "codehilite",    # syntax highlighting (graceful fallback if Pygments missing)
    "toc",           # [TOC] support
    "nl2br",         # newlines → <br> inside paragraphs
    "sane_lists",    # better list handling
]


# Chapters 1 and 2 got their learning-objectives box and shaded activity
# boxes from hand-added Pressbooks "textbox" markup in the web editor (see
# publishing-workflow notes) — plain markdown never produced it, which is
# why chapter 3 published flat. These patterns reproduce that markup from
# the plain HTML python-markdown emits, so every chapter gets it automatically.
LEARNING_OBJECTIVES_RE = re.compile(
    r"<p>By the end of this chapter, you will be able to:</p>\s*(<ul>.*?</ul>)",
    re.DOTALL,
)

ACTIVITY_PROMPT_RE = re.compile(
    r"(<p><strong>Copy and paste this prompt into your AI tool:</strong></p>\s*)"
    r"<blockquote>\s*(.*?)\s*</blockquote>",
    re.DOTALL,
)


def wrap_textboxes(html: str) -> str:
    """Wrap the opening learning-objectives list and each activity's AI-prompt
    blockquote in Pressbooks' native `textbox` markup (matched against chapter
    1's live HTML). Narrative blockquotes elsewhere in the body (e.g. the
    Target pregnancy-prediction anecdote in ch1) are left as plain
    <blockquote> — only blockquotes immediately preceded by the "Copy and
    paste this prompt into your AI tool:" line are activity prompts."""

    def objectives_repl(match):
        ul = match.group(1)
        return (
            '<div class="textbox textbox--learning-objectives">'
            '<header class="textbox__header">\n'
            '<p class="textbox__title">By the end of this chapter, you will be able to:</p>\n\n'
            "</header>\n"
            '<div class="textbox__content">\n\n'
            f"{ul}\n\n"
            "</div>\n"
            "</div>"
        )

    html = LEARNING_OBJECTIVES_RE.sub(objectives_repl, html, count=1)

    def activity_repl(match):
        intro, inner = match.group(1), match.group(2)
        return f'{intro}<blockquote>\n<div class="textbox shaded">\n\n{inner}\n\n</div></blockquote>'

    html = ACTIVITY_PROMPT_RE.sub(activity_repl, html)

    return html


def markdown_to_html(text: str, session, chapter_slug: str) -> str:
    """Convert markdown to HTML, fixing table spacing, rendering Mermaid diagrams
    as images, and applying the learning-objectives / activity textbox styling.
    session=None renders without uploading anything (see process_mermaid_diagrams)."""

    # Strip the top-level H1 (Pressbooks uses the chapter title field instead)
    text = re.sub(r"^#\s+.+\n", "", text, count=1)

    # Render + upload Mermaid diagrams before the markdown pass, so the
    # resulting <figure><img></figure> blocks pass through untouched.
    text = process_mermaid_diagrams(text, session, chapter_slug)

    # Upload any locally-referenced images (e.g. <img src="./diagram.png">)
    # to the media library and rewrite their src to the live URL.
    text = process_local_images(text, session, chapter_slug)

    # Guarantee blank lines around every table so none of them collapse
    # into a plain paragraph of raw pipe characters.
    text = ensure_blank_lines_around_tables(text)

    converter = md.Markdown(extensions=MARKDOWN_EXTENSIONS)
    html = converter.convert(text)
    html = wrap_textboxes(html)
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


def drift_check(chapter: dict, recorded: dict) -> tuple:
    """Decide whether the live page is safe to overwrite.

    Returns (status, message):
      "ok"      - unchanged since our last publish.
      "moved"   - the timestamp moved but the stored content is byte-identical
                  to what we left there. Pressbooks does this on its own, about a
                  second after a publish. Safe.
      "blocked" - someone (probably) edited the chapter in Pressbooks. Their
                  work would be destroyed by a blind update, so we stop.
    """
    if not recorded:
        return ("blocked", "no record of a previous publish for this chapter — "
                           "review it, then run once with --accept-current to adopt the live version")
    live = chapter.get("modified_gmt")
    if not live or live == recorded.get("modified_gmt"):
        return ("ok", "")
    raw = (chapter.get("content") or {}).get("raw", "")
    if recorded.get("live_sha256") and sha256(raw) == recorded["live_sha256"]:
        return ("moved", f"timestamp moved ({recorded.get('modified_gmt')} → {live}) "
                         f"but the content is identical to what was published")
    return ("blocked", f"live page changed since last publish "
                       f"(was {recorded.get('modified_gmt')}, now {live})")


def current_commit() -> str:
    if os.environ.get("GITHUB_SHA"):
        return os.environ["GITHUB_SHA"]
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=SCRIPT_DIR,
                              capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def in_ci() -> bool:
    return os.environ.get("GITHUB_ACTIONS") == "true"


def annotate(kind: str, title: str, msg: str) -> None:
    if in_ci():
        print(f"::{kind} title={title}::{msg}")


PREVIEW_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
 body{{max-width:760px;margin:0 auto;padding:24px 16px 60px;font:17px/1.6 Georgia,serif;color:#222;background:#fff}}
 h1{{font-family:system-ui,sans-serif}} table{{border-collapse:collapse}} td,th{{border:1px solid #ccc;padding:4px 8px}}
 img{{max-width:100%}} pre{{background:#f4f4f4;padding:12px;overflow:auto}}
 .textbox{{background:#eef6f5;border-left:4px solid #117c70;padding:4px 16px;margin:16px 0}}
 .textbox.shaded{{background:#f0f0f0;border-left-color:#999}}
 .note{{font:13px system-ui,sans-serif;color:#666;border-bottom:1px solid #ddd;padding-bottom:8px}}
</style></head><body>
<p class="note">Preview rendered by CI from commit {commit}. Diagrams load from mermaid.ink here; on Pressbooks they are uploaded images. Pressbooks' own theme will look different.</p>
<h1>{title}</h1>
{body}
</body></html>
"""


def write_preview(out_dir: str, filename: str, title: str, html_text: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    for src in re.findall(r'<img\b[^>]*\bsrc="\./([^"]+)"', html_text):
        target = os.path.join(out_dir, src)
        os.makedirs(os.path.dirname(target) or out_dir, exist_ok=True)
        with open(os.path.join(SCRIPT_DIR, src), "rb") as fi, open(target, "wb") as fo:
            fo.write(fi.read())
    page = PREVIEW_PAGE.format(title=html.escape(title), body=html_text, commit=current_commit()[:7])
    with open(os.path.join(out_dir, os.path.splitext(filename)[0] + ".html"), "w", encoding="utf-8") as f:
        f.write(page)


# ── Main publish flow ─────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Publish Relational Thinking to Pressbooks.")
    p.add_argument("--only", nargs="+", metavar="FILE",
                   help="consider only these chapter files (e.g. chapter-02.md)")
    p.add_argument("--always", action="store_true",
                   help="write the chapters even if nothing changed (e.g. after replacing an image file)")
    p.add_argument("--force", action="store_true",
                   help="overwrite even if the live page changed since last publish (never used by CI)")
    p.add_argument("--accept-current", action="store_true",
                   help="record the live version as the baseline without writing content")
    p.add_argument("--dry-run", action="store_true",
                   help="report what would be published without writing anything to Pressbooks")
    p.add_argument("--local", action="store_true",
                   help="allow a real publish from outside CI (emergencies only)")
    p.add_argument("--state", default=STATE_FILE, metavar="PATH",
                   help="publish-state file to read and update (default: .publish-state.json here)")
    p.add_argument("--render-to", metavar="DIR",
                   help="write an HTML preview of every chapter that would change")
    p.add_argument("--report", metavar="FILE",
                   help="write a Markdown summary (used for the CI job summary and issues)")
    return p.parse_args()


def main():
    args = parse_args()
    print("=" * 60)
    print("Pressbooks Publisher")
    print(f"Book: {BOOK_URL}")
    print("=" * 60)

    writes = not args.dry_run
    if writes and not (in_ci() or args.local):
        print("✗ Publishing happens in CI when a pull request is merged into master.")
        print("  Use --dry-run to see what would change, or add --local for an emergency")
        print("  publish from this machine (then expect CI to report the chapter as BLOCKED")
        print("  until its state is reconciled).")
        sys.exit(2)

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
        print("  (Check PRESSBOOKS_USERNAME / PRESSBOOKS_APP_PASSWORD)")
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

    state = load_state(args.state)
    commit = current_commit()
    report = []          # Markdown lines for --report
    details = []         # collapsible per-chapter diffs for --report

    def save():
        if not args.dry_run:
            save_state(state, args.state)

    print()
    counts = {"published": 0, "unchanged": 0, "blocked": 0, "failed": 0}

    for i, (filename, chapter_id, title, part_title, order, wip) in enumerate(CHAPTERS, start=1):
        if args.only and filename not in args.only:
            continue

        filepath = os.path.join(SCRIPT_DIR, filename)
        live_title = published_title(title, wip)
        chapter_slug = os.path.splitext(filename)[0]
        key = str(chapter_id)
        recorded = state.get(key, {})

        def fail(msg):
            print(f"       FAILED ✗ {msg}")
            annotate("error", filename, msg)
            report.append(f"| `{filename}` | ❌ failed | {msg} |")
            counts["failed"] += 1

        if not os.path.exists(filepath):
            print(f"  [{i:02d}] {filename} not found")
            fail("file not found")
            continue

        if part_title not in parts_by_title:
            print(f"  [{i:02d}] {live_title}")
            fail(f"part {part_title!r} not found on the book (available: {', '.join(parts_by_title)})")
            continue
        part_id = parts_by_title[part_title]

        print(f"  [{i:02d}] {live_title} … (id={chapter_id}, {part_title} #{order})")

        try:
            current = fetch_chapter(session, endpoint, chapter_id)
        except requests.HTTPError as e:
            fail(f"could not read the live chapter: {e}")
            continue

        if not current:
            fail(f"chapter id {chapter_id} does not exist on the book. Fix the id in CHAPTERS — "
                 f"this script never creates chapters, because a wrong id would silently duplicate one.")
            continue

        live_raw = (current.get("content") or {}).get("raw", "")
        live_url = f"{BOOK_URL}/chapter/{current.get('slug', '')}/"

        with open(filepath, "r", encoding="utf-8") as f:
            raw_md = f.read()

        # Render once without uploading anything: used to decide whether the
        # chapter changed, for previews, and for diffs.
        try:
            preview_html = markdown_to_html(raw_md, None, chapter_slug)
        except PublishError as e:
            fail(str(e))
            continue
        new_fp = fingerprint(live_title, part_id, order, preview_html)

        if args.accept_current:
            state[key] = {"file": filename, "slug": current.get("slug"),
                          "modified_gmt": current.get("modified_gmt"),
                          "live_sha256": sha256(live_raw),
                          "sent_sha256": live_fingerprint(current),
                          "commit": recorded.get("commit", "")}
            print("       baseline adopted (no content written) ✓" if writes else
                  "       dry run — would adopt the live version as the baseline")
            report.append(f"| `{filename}` | 📌 baseline adopted | live version recorded; nothing written |")
            save()
            counts["unchanged"] += 1
            continue

        # 1. Refuse to clobber edits made in Pressbooks since our last publish.
        status, why = drift_check(current, recorded)
        if status == "blocked" and live_fingerprint(current) == new_fp:
            # The live page is already exactly what the source would publish
            # (apart from image URLs), so there is no edit to lose. This also
            # covers state recorded before content hashes existed.
            status, why = "moved", "live page already matches the source exactly"
        if status == "blocked" and not args.force:
            baseline_commit = recorded.get("commit", "")
            baseline_md = markdown_at_commit(baseline_commit, filename) if baseline_commit else ""
            label = f"last published (commit {baseline_commit[:7]})" if baseline_md else "current markdown"
            try:
                baseline_html = markdown_to_html(baseline_md or raw_md, None, chapter_slug)
                diff = (text_diff(baseline_html, live_raw, label, "live on Pressbooks")
                        or markup_diff(baseline_html, live_raw, label, "live on Pressbooks"))
            except PublishError:
                diff = ""
            print(f"       BLOCKED — {why}")
            print(f"       Review {live_url}")
            print("       Then either pull the Pressbooks edit into the .md, or adopt the live")
            print("       version with --accept-current. Nothing was overwritten.")
            annotate("error", f"BLOCKED {filename}", why)
            report.append(f"| `{filename}` | 🛑 BLOCKED | {why} — [live page]({live_url}) |")
            details.append(f"<details><summary><code>{filename}</code>: what changed on Pressbooks "
                           f"(plain text)</summary>\n\n```diff\n{diff or '(no difference in content)'}\n```\n</details>")
            counts["blocked"] += 1
            continue
        if status == "moved":
            print(f"       note: {why} — safe")
            if recorded:
                recorded["modified_gmt"] = current.get("modified_gmt")
                state[key] = recorded

        # 2. Skip chapters whose rendered content, title and place haven't changed.
        if recorded.get("sent_sha256"):
            changed = new_fp != recorded["sent_sha256"]
        else:
            # First run under fingerprints: compare with what is live right now.
            changed = new_fp != live_fingerprint(current)
            if not changed:
                state[key] = {**recorded, "file": filename, "slug": current.get("slug"),
                              "modified_gmt": current.get("modified_gmt"),
                              "live_sha256": sha256(live_raw), "sent_sha256": new_fp,
                              "commit": recorded.get("commit") or commit}
        if not changed and not args.always:
            print("       unchanged — nothing to publish")
            report.append(f"| `{filename}` | ✅ unchanged | |")
            save()
            counts["unchanged"] += 1
            continue

        diff = text_diff(live_raw, preview_html, "live on Pressbooks", "after this publish")
        n_lines = sum(1 for l in diff.splitlines() if l[:1] in "+-" and l[:3] not in ("+++", "---"))
        what = f"{n_lines} text line(s) differ" if n_lines else "markup/title/position only"
        if args.render_to:
            write_preview(args.render_to, filename, live_title, preview_html)
        if not diff:
            diff = markup_diff(live_raw, preview_html, "live on Pressbooks", "after this publish")
            title_now = (current.get("title") or {}).get("raw", "")
            if title_now != live_title:
                diff = f"title: {title_now!r} -> {live_title!r}\n" + diff
        details.append(f"<details><summary><code>{filename}</code>: changes "
                       f"({'plain text' if n_lines else 'markup'})</summary>\n\n```diff\n{diff or '(no difference in content)'}\n```\n</details>")

        if args.dry_run:
            print(f"       dry run — would publish ({what})")
            report.append(f"| `{filename}` | 📝 would publish | {what} |")
            counts["published"] += 1
            continue

        try:
            chapter_html = markdown_to_html(raw_md, session, chapter_slug)
            update_chapter(session, endpoint, chapter_id, live_title, chapter_html, order, part_id)
            after = fetch_chapter(session, endpoint, chapter_id)
        except PublishError as e:
            fail(f"{e} — nothing was written for this chapter")
            continue
        except requests.HTTPError as e:
            fail(f"{e.response.status_code}: {e.response.text[:200]}")
            continue

        state[key] = {"file": filename, "slug": after.get("slug"),
                      "modified_gmt": after.get("modified_gmt"),
                      "live_sha256": sha256((after.get("content") or {}).get("raw", "")),
                      "sent_sha256": fingerprint(live_title, part_id, order, chapter_html),
                      "commit": commit}
        save()
        print(f"       updated ✓ ({what})")
        report.append(f"| `{filename}` | 🚀 published | {what} — [live page]({live_url}) |")
        counts["published"] += 1

    # Summary
    verb = "would publish" if args.dry_run else "published"
    summary = (f"{counts['published']} {verb}, {counts['unchanged']} unchanged, "
               f"{counts['blocked']} blocked, {counts['failed']} failed.")
    print()
    print("=" * 60)
    print(f"Done.  {summary}")
    if counts["blocked"]:
        print("\n  Blocked chapters were edited in Pressbooks since the last publish.")
        print("  Nothing was overwritten. Pull those edits into the .md first,")
        print("  or adopt the live version with --accept-current.")
    print("=" * 60)

    if args.report:
        title = "Pressbooks dry run" if args.dry_run else "Pressbooks publish"
        lines = [f"### {title}: {summary}", "", "| Chapter | Result | Details |", "|---|---|---|", *report]
        if details:
            lines += ["", *details]
        with open(args.report, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

    sys.exit(1 if counts["blocked"] or counts["failed"] else 0)


if __name__ == "__main__":
    main()
