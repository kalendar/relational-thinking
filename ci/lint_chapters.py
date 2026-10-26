#!/usr/bin/env python3
"""Structure checks for chapter-NN.md.

Errors fail the build; warnings are shown but don't. Problems are printed as
GitHub annotations, so they appear on the right line of the pull request.

Checks:
  - The first line is "# Chapter N: ..." and N matches the file name.
  - If the learning-outcomes lead-in is present, it is in the exact form the
    publish script styles: H1, one blank line, the lead-in, one blank line,
    then a "- " bullet list. A missing lead-in is only a warning, because WIP
    chapters don't have one yet.
  - Every "Copy and paste this prompt into your AI tool:" is followed by a
    blockquote (the publish script turns that blockquote into a gray box).
  - Code fences are balanced.
  - Every local image (./file) exists.
  - Every link to a practice tool on kalendar.github.io/relational-thinking
    points at a file the tools build actually produces (--site).
"""
import argparse
import glob
import os
import re
import sys

LEAD_IN = "By the end of this chapter, you will be able to:"
PROMPT_LINE = "Copy and paste this prompt into your AI tool:"
TOOLS_URL = re.compile(r"https://kalendar\.github\.io/relational-thinking/([A-Za-z0-9._/-]*)")
LOCAL_IMG = re.compile(r'(?:src="|\]\()\./([^")]+)')

errors = 0
warnings = 0


def report(kind, path, line, msg):
    global errors, warnings
    if kind == "error":
        errors += 1
    else:
        warnings += 1
    print(f"::{kind} file={path},line={line}::{msg}")


def lint(path, site):
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")

    num = int(re.search(r"chapter-(\d+)\.md$", path).group(1))
    m = re.match(r"# Chapter (\d+): \S", lines[0]) if lines else None
    if not m:
        report("error", path, 1, 'First line must be the H1 "# Chapter N: Title".')
    elif int(m.group(1)) != num:
        report("error", path, 1, f"H1 says Chapter {m.group(1)} but the file is chapter {num:02d}.")

    lead = [i for i, l in enumerate(lines) if l.strip() == LEAD_IN]
    if not lead:
        report("warning", path, 1, "No learning-outcomes list yet (fine while the chapter is WIP; add it before finalizing).")
    else:
        i = lead[0]
        if i != 2 or lines[1].strip() != "":
            report("error", path, i + 1, "The learning-outcomes lead-in must come right after the H1, with one blank line between.")
        if i + 2 >= len(lines) or lines[i + 1].strip() != "" or not lines[i + 2].startswith("- "):
            report("error", path, i + 1, 'The lead-in must be followed by one blank line and then a "- " bullet list.')

    for i, l in enumerate(lines):
        if PROMPT_LINE in l:
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            if j >= len(lines) or not lines[j].startswith(">"):
                report("error", path, i + 1, "This activity prompt isn't followed by a blockquote, so it won't get its gray box.")
    if not any(PROMPT_LINE in l for l in lines):
        report("warning", path, 1, "No interactive activities found.")

    fences = [i for i, l in enumerate(lines) if l.lstrip().startswith("```")]
    if len(fences) % 2:
        report("error", path, fences[-1] + 1, "Unbalanced code fence (``` opened but never closed).")

    for i, l in enumerate(lines):
        for img in LOCAL_IMG.findall(l):
            if not os.path.exists(os.path.join(os.path.dirname(path) or ".", img)):
                report("error", path, i + 1, f"Image ./{img} doesn't exist in the repo.")
        if site:
            for target in TOOLS_URL.findall(l):
                target = target.rstrip(".,)") or "index.html"
                if not os.path.exists(os.path.join(site, target)):
                    report("error", path, i + 1, f"Links to the tool '{target}', which the tools build doesn't produce.")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--site", help="assembled tools site (from ci/assemble_site.sh), to check tool links")
    p.add_argument("files", nargs="*")
    a = p.parse_args()
    files = a.files or sorted(glob.glob("chapter-*.md"))
    if not files:
        print("::error::No chapter files found.")
        return 1
    for f in files:
        lint(f, a.site)
    print(f"Checked {len(files)} chapters: {errors} error(s), {warnings} warning(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
