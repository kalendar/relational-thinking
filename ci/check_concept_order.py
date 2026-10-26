#!/usr/bin/env python3
"""Mechanical concept-order check, against concept-graph/knowledge-graph.json.

For each chapter changed since --base:

  * Early use (warning): the change adds a use of a concept the graph says is
    introduced in a LATER chapter, e.g. "foreign key" in chapter 2 when the
    book introduces it in chapter 3. Only uses the change adds are reported:
    the existing text has ~60 such matches, nearly all ordinary English words
    ("column", "key", "where"), so re-reporting them on every PR would be noise.
    Sentences that point forward ("Chapter 5 will cover...") are skipped, since
    that is the book's own pattern for a deliberate forward reference.
  * Key Terms (warning): a term defined in the Key Terms of more than one
    chapter, or a Key Term the concept graph doesn't know about. The fix for
    the second is usually to add the Key Terms wording to the matching node's
    surface_forms (if it's distinctive enough to scan for) or key_terms_forms
    (if it's an everyday word, like "Project").

When a change finalizes a chapter (its wip flag in CHAPTERS goes from True to
False), every early use in that chapter must be resolved or recorded with a
reason in concept-graph/concept-order-allowlist.json. Otherwise this fails.

Matching is by the graph's surface forms (the wordings the book actually
uses), case-insensitive, in prose only: code blocks and the Interactive
Activities are skipped.

Usage: python3 ci/check_concept_order.py --base origin/master [--summary FILE]
"""
import argparse
import ast
import collections
import json
import os
import re
import subprocess
import sys

GRAPH = "concept-graph/knowledge-graph.json"
ALLOWLIST = "concept-graph/concept-order-allowlist.json"
PUBLISH_SCRIPT = "publish_to_pressbooks.py"
FORWARD = re.compile(r"\b(later|next chapter|coming up|will (cover|see|explore|learn|meet|return|get to)|"
                     r"chapter\s+\d+|ch\.\s*\d+)\b", re.I)


def git_show(ref, path):
    r = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


def chapter_no(path):
    return int(re.search(r"chapter-(\d+)\.md$", path).group(1))


def wip_flags(source):
    if not source:
        return {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "CHAPTERS" for t in node.targets):
            return {row[0]: row[5] for row in ast.literal_eval(node.value)}
    return {}


def prose_sentences(md):
    """(line number, sentence) pairs of prose, skipping code and the activities."""
    out, in_fence = [], False
    for n, line in enumerate(md.split("\n"), 1):
        if line.strip().startswith("## Interactive Activities"):
            break
        if line.strip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or not line.strip() or line.startswith("# "):   # skip the chapter title
            continue
        for s in re.split(r"(?<=[.!?:])\s+", line):
            if s.strip():
                out.append((n, s.strip()))
    return out


def fold(text):
    return text.lower().replace("\u2019", "'").replace("\u2018", "'").strip()


def surface_pattern(sf):
    if len(sf) < 3:
        return None
    if sf.isupper():
        return re.compile(r"\b" + re.escape(sf) + r"\b")
    return re.compile(r"(?<![\w-])" + re.escape(sf) + r"(?:s|es)?(?![\w-])", re.I)


class Graph:
    def __init__(self, path):
        g = json.load(open(path, encoding="utf-8"))
        self.concepts = []   # (concept, first chapter, patterns, chapters where glossed)
        self.forms = {}
        for node in g["nodes"]:
            # key_terms_forms: how a Key Terms list words the concept when that
            # wording is too common to scan for (e.g. "Project" for projecting).
            for sf in node["surface_forms"] + [node["concept"]] + node.get("key_terms_forms", []):
                self.forms[fold(sf)] = node
            intro = [i["chapter"] for i in node["introduced_in"]]
            if not intro:
                continue
            pats = [p for p in map(surface_pattern, node["surface_forms"]) if p]
            glossed = {a["chapter"] for a in node["assumed_in"] if a.get("glossed_in_place")}
            glossed |= {f["chapter"] for f in g.get("findings", {}).get("closed_by_inline_gloss", [])
                        if f.get("concept") == node["concept"]}
            self.concepts.append((node["concept"], min(intro), pats, glossed))

    def early_uses(self, md, chapter):
        """{concept: (introduced chapter, count, first line, first sentence)}"""
        found = {}
        sents = prose_sentences(md)
        for concept, first, pats, glossed in self.concepts:
            if first <= chapter or chapter in glossed:
                continue
            matches = [(n, s) for n, s in sents if not FORWARD.search(s) and any(p.search(s) for p in pats)]
            if matches:
                found[concept] = (first, len(matches), matches[0][0], matches[0][1])
        return found


def key_terms(md):
    m = re.search(r"\n## Key Terms\n(.*?)(?=\n## |\Z)", md, re.S)
    terms = re.findall(r"^\s*\*\*(.+?)\*\*", m.group(1) if m else "", re.M)
    return [re.sub(r"\s*[–—:-]\s*$", "", t).strip() for t in terms]   # "**Entity –**" -> "Entity"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="git ref to compare with (e.g. origin/master)")
    p.add_argument("--summary", help="append a Markdown report to this file")
    a = p.parse_args()

    graph = Graph(GRAPH)
    allow = {(e["chapter"], e["concept"].lower())
             for e in (json.load(open(ALLOWLIST)) if os.path.exists(ALLOWLIST) else [])}
    changed = subprocess.run(["git", "diff", "--name-only", a.base, "--", "chapter-*.md"],
                             capture_output=True, text=True, check=True).stdout.split()
    changed = sorted(f for f in changed if os.path.exists(f))

    old_wip = wip_flags(git_show(a.base, PUBLISH_SCRIPT))
    new_wip = wip_flags(open(PUBLISH_SCRIPT, encoding="utf-8").read())
    finalized = sorted(f for f, wip in new_wip.items() if not wip and old_wip.get(f, True) and os.path.exists(f))

    all_terms = collections.defaultdict(list)
    for f in sorted(new_wip):
        if os.path.exists(f):
            for t in key_terms(open(f, encoding="utf-8").read()):
                all_terms[t.strip().lower()].append(chapter_no(f))

    lines, warnings, errors = [], 0, 0

    for f in sorted(set(changed) | set(finalized)):
        n = chapter_no(f)
        head = open(f, encoding="utf-8").read()
        now = graph.early_uses(head, n)
        before = graph.early_uses(git_show(a.base, f), n)

        if f in finalized:
            for concept, (first, count, line, sent) in sorted(now.items()):
                if (n, concept.lower()) in allow:
                    continue
                errors += 1
                msg = (f"Chapter {n} is being finalized but uses '{concept}', which the book introduces in "
                       f"Chapter {first}: \"{sent[:120]}\". Rework or gloss it, or record why it's fine in {ALLOWLIST}.")
                print(f"::error file={f},line={line},title=Concept order::{msg}")
                lines.append(f"- ❌ `{f}`:{line} uses **{concept}** (introduced in Ch {first}) — finalization blocked")
        else:
            for concept, (first, count, line, sent) in sorted(now.items()):
                if count > before.get(concept, (0, 0))[1]:
                    warnings += 1
                    msg = (f"Adds a use of '{concept}', which the book introduces in Chapter {first}: "
                           f"\"{sent[:120]}\". Fine if it's plain English here; otherwise gloss it or point forward.")
                    print(f"::warning file={f},line={line},title=Concept order::{msg}")
                    lines.append(f"- ⚠️ `{f}`:{line} adds **{concept}** (introduced in Ch {first})")

        for t in key_terms(head):
            chapters = all_terms[t.strip().lower()]
            line = next((i + 1 for i, l in enumerate(head.splitlines()) if l.lstrip().startswith(f"**{t}")), 1)
            if len(chapters) > 1:
                warnings += 1
                print(f"::warning file={f},line={line},title=Key Terms::'{t}' is defined in the Key Terms of "
                      f"chapters {', '.join(map(str, chapters))}. Define it once, or disambiguate with a "
                      f"parenthetical, e.g. 'Atomicity (data)'.")
                lines.append(f"- ⚠️ `{f}`: Key Term **{t}** is also defined in chapter(s) "
                             f"{', '.join(str(c) for c in chapters if c != n)}")
            base_term = fold(re.sub(r"\s*\(.*\)$", "", t))
            if base_term not in graph.forms and fold(t) not in graph.forms:
                warnings += 1
                print(f"::warning file={f},line={line},title=Key Terms::'{t}' isn't in the concept graph, "
                      f"so concept-order checks can't see it. Add it to {GRAPH}.")
                lines.append(f"- ⚠️ `{f}`: Key Term **{t}** isn't in the concept graph")

    print(f"Concept order: {len(changed)} changed chapter(s), {len(finalized)} finalized, "
          f"{warnings} warning(s), {errors} error(s).")
    if a.summary and lines:
        with open(a.summary, "a", encoding="utf-8") as out:
            out.write(f"### Concept order: {warnings} warning(s), {errors} error(s)\n\n" + "\n".join(lines) + "\n")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
