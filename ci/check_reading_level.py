#!/usr/bin/env python3
"""Advisory check: reading level of the sections a change touches.

The book's target is a 10th-grade reading level. For every chapter changed since
--base, this scores each section's body prose with the Flesch-Kincaid grade
formula and warns when a changed section is above WARN_ABOVE, or got more than
WARN_RISE grades harder than it was on the base. It never fails the build: the
formula only counts sentence length and syllables, so it's a prompt for
judgment, not a verdict.

What's scored: prose under each "## " heading, excluding code blocks, tables,
blockquotes (the AI prompts), the Key Terms list and the Interactive
Activities. Words that appear in any chapter's Key Terms are counted as at most
two syllables, so the vocabulary the book deliberately teaches ("normalization",
"referential integrity") doesn't by itself push a section over.

Syllables are estimated with a standard vowel-group rule, so treat scores as
approximate (typically within about half a grade).

Usage: python3 ci/check_reading_level.py --base origin/master [--summary FILE]
"""
import argparse
import glob
import os
import re
import subprocess
import sys

WARN_ABOVE = 10.5   # target is 10.0; a little headroom for estimate noise
WARN_RISE = 1.0     # grades harder than the same section on the base
MIN_WORDS = 150     # shorter sections give unstable scores
SKIP_SECTIONS = ("Key Terms", "Interactive Activities")


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def key_term_words(texts) -> set:
    words = set()
    for t in texts:
        m = re.search(r"\n## Key Terms\n(.*?)(?=\n## |\Z)", t, re.S)
        for term in re.findall(r"^\s*\*\*(.+?)\*\*", m.group(1) if m else "", re.M):
            words.update(re.findall(r"[a-z]+", term.lower()))
    return words


def prose_lines(md: str) -> list:
    md = re.sub(r"```.*?```", "", md, flags=re.S)
    out = []
    for line in md.splitlines():
        s = line.strip()
        if not s or s.startswith(("#", "|", ">", "<", "---", "* * *", "!")) or s.startswith("**Copy and paste"):
            continue
        s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)          # links -> their text
        s = re.sub(r"[*_`]", "", s)
        s = re.sub(r"^([-*+]|\d+\.)\s+", "", s)                  # list markers
        if not re.search(r"[.!?]$", s):
            s += "."                                             # list items, captions: one sentence each
        out.append(s)
    return out


def sentences(md: str) -> list:
    text = " ".join(prose_lines(md))
    return [s for s in re.split(r"(?<=[.!?])\s+", text) if len(s.split()) > 2]


def grade(md: str, easy_words: set):
    sents = sentences(md)
    words = [w for s in sents for w in s.split()]
    if len(words) < MIN_WORDS:
        return None
    syl = sum(min(2, syllables(w)) if re.sub(r"[^a-z]", "", w.lower()) in easy_words else syllables(w)
              for w in words)
    return 0.39 * len(words) / len(sents) + 11.8 * syl / len(words) - 15.59


def sections(md: str) -> dict:
    out = {}
    for m in re.finditer(r"^## (.+?)\n(.*?)(?=^## |\Z)", md, re.S | re.M):
        title = m.group(1).strip()
        if not title.startswith(SKIP_SECTIONS):
            out[title] = m.group(2)
    return out


def git_show(ref: str, path: str) -> str:
    r = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


def changed_chapters(base: str) -> list:
    r = subprocess.run(["git", "diff", "--name-only", base, "--", "chapter-*.md"],
                       capture_output=True, text=True, check=True)
    return sorted(f for f in r.stdout.split() if os.path.exists(f))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="git ref to compare with (e.g. origin/master)")
    p.add_argument("--summary", help="append a Markdown report to this file")
    p.add_argument("--all", action="store_true", help="score every chapter, not just changed ones")
    a = p.parse_args()

    files = sorted(glob.glob("chapter-*.md")) if a.all else changed_chapters(a.base)
    easy = key_term_words(open(f, encoding="utf-8").read() for f in glob.glob("chapter-*.md"))
    rows, notes, warned = [], [], 0

    for f in files:
        head = open(f, encoding="utf-8").read()
        base = git_show(a.base, f)
        hs, bs = sections(head), sections(base)
        for title, body in hs.items():
            g = grade(body, easy)
            if g is None:
                continue
            old_body = bs.get(title)
            changed = a.all or old_body != body
            if not changed:
                continue
            g0 = grade(old_body, easy) if old_body else None
            reasons = []
            if g > WARN_ABOVE:
                reasons.append(f"grade {g:.1f} is above the {WARN_ABOVE} warning line (target 10)")
            if g0 is not None and g - g0 > WARN_RISE:
                reasons.append(f"{g - g0:+.1f} grades harder than before ({g0:.1f} → {g:.1f})")
            was = f"{g0:.1f}" if g0 is not None else "new"
            rows.append(f"| `{f}` | {title[:60]} | {was} | {g:.1f} | {'⚠️' if reasons else '✅'} |")
            if reasons:
                warned += 1
                line = next((i + 1 for i, l in enumerate(head.splitlines()) if l.strip() == f"## {title}"), 1)
                print(f"::warning file={f},line={line},title=Reading level::{title}: {'; '.join(reasons)}")
                longest = sorted(sentences(body), key=lambda s: len(s.split()), reverse=True)[:3]
                notes.append(f"**`{f}` — {title}**: {'; '.join(reasons)}. Longest sentences:\n"
                             + "\n".join(f"- ({len(s.split())} words) {s}" for s in longest))

    print(f"Reading level: {len(rows)} changed section(s) scored, {warned} warning(s).")
    if a.summary and rows:
        with open(a.summary, "a", encoding="utf-8") as out:
            out.write(f"### Reading level: {warned} warning(s)\n\nTarget: 10th grade. "
                      f"Warns above {WARN_ABOVE} or on a rise of more than {WARN_RISE}. Advisory only.\n\n"
                      "| Chapter | Section | Before | After | |\n|---|---|---|---|---|\n"
                      + "\n".join(rows) + "\n\n" + "\n\n".join(notes) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
