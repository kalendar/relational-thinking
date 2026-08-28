#!/usr/bin/env python3
"""Build assignment payloads for the "Clarifying Questions" formative activity,
one per chapter for Chapters 2-14, to be added to the existing MIS 340 class.

Reads: ../chapter-02.md .. ../chapter-14.md (via build_manifest.parse_chapter)
Writes: ./clarifying-questions.json, ./clarifying-questions.md
"""
import json
from pathlib import Path
from build_manifest import ROOT, parse_chapter

OUT_DIR = Path(__file__).resolve().parent

CRITERIA = [
    "The student's questions read as genuine points of confusion in their own words, not textbook review questions copy-pasted verbatim or questions clearly written by another AI tool.",
    "Each question names a specific concept, term, or passage from the chapter rather than a vague catch-all (\"I don't get any of it\").",
    "Every question is genuinely tied to this week's chapter, not off-topic.",
    "For at least one question, the student asks a follow-up rather than accepting the AI's first answer at face value.",
    "At least once, the student restates the idea in their own words or checks their understanding against the AI's explanation (e.g., \"so does that mean...?\").",
    "Where a confusion is more conceptually difficult, the student's follow-up exchange is correspondingly longer — not every question gets the identical one-and-done treatment regardless of difficulty.",
    "By the end of each question's thread, the student explicitly signals understanding (e.g., \"okay that makes sense,\" restating the resolved idea correctly in their own words).",
]


def build_prompt(chapter_num: int, chapter_title: str) -> str:
    return (
        f"This is a student-driven clarification session for Chapter {chapter_num}: {chapter_title}. "
        "The learner has already read the chapter and comes to this conversation with specific things "
        "they found confusing.\n\n"
        "Your role: wait for the learner to name a specific concept, term, or passage from the chapter "
        "that confused them, and ask their first question. Answer clearly, drawing on the chapter content "
        "and examples where they help. After you answer, check whether the explanation actually resolved "
        "their confusion — if they push back, ask for more detail, request an example, or seem unsure, keep "
        "working the same question with them (a different explanation, an example, a check on their "
        "restatement) until they signal they understand it.\n\n"
        "Once a question is genuinely resolved, ask if they have another point of confusion from the "
        "chapter, and repeat the same process. Continue until the learner indicates they've cleared up "
        "everything they were confused about, then bring the session to a natural close.\n\n"
        "If the learner opens by asking you to just summarize or explain the whole chapter, rather than "
        "naming a specific confusion, redirect them: ask what specifically confused them so you can "
        "address it directly."
    )


def main():
    assignments = []
    for path in sorted(ROOT.glob("chapter-*.md")):
        chapter = parse_chapter(path)
        if chapter["number"] == 1:
            continue  # Chapters 2-14 only
        assignments.append(
            {
                "title": f"{chapter['number']}.0 — Clarifying Questions",
                "prompt": build_prompt(chapter["number"], chapter["title"]),
                "context": chapter["body"],
                "published": False,
                "criteria": [{"description": d, "pointsYes": 1, "pointsNo": 0} for d in CRITERIA],
            }
        )
    if len(assignments) != 13:
        raise ValueError(f"expected 13 assignments (chapters 2-14), got {len(assignments)}")

    (OUT_DIR / "clarifying-questions.json").write_text(
        json.dumps(assignments, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [f"# Clarifying Questions — {len(assignments)} assignments (Chapters 2-14)\n"]
    for a in assignments:
        lines.append(f"- {a['title']} ({len(a['criteria'])} criteria, max {len(a['criteria'])} pts)")
    (OUT_DIR / "clarifying-questions.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {len(assignments)} assignments to {OUT_DIR / 'clarifying-questions.json'}")


if __name__ == "__main__":
    main()
