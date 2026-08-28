#!/usr/bin/env python3
"""Build a Kaiwa bulk-import manifest.json for the MIS 340 class from the
local textbook chapter files and the activity grading rubric.

Reads: ../chapter-01.md .. ../chapter-14.md, ../activity-grading-rubric-only.md
Writes: ./manifest.json, ./manifest.md (human-readable summary)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = Path(__file__).resolve().parent

ACTIVITY_TYPE_TO_SECTION = {
    "Concept Check": "4A",
    # Chapter 14's capstone x.1 activity is a whole-course "Reflection" instead of a
    # single-chapter concept quiz, but it's structurally the same move (explain concepts,
    # give own examples, engage with follow-up) so it's graded against the same block.
    "Reflection": "4A",
    "Apply It": "4B",
    "Practice": "4C",
    "Case Study": "4D",
}

TABLE_ROW_RE = re.compile(r"^\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*\|\s*$")


def parse_rubric_sections(text: str) -> dict[str, list[str]]:
    """Returns {"1": [...], "2": [...], "3": [...], "4A": [...], ...}."""
    sections: dict[str, list[str]] = {}
    current_key = None
    for line in text.splitlines():
        h2 = re.match(r"^## Section (\d+)", line)
        h3 = re.match(r"^### (4[A-D])", line)
        if h2:
            current_key = h2.group(1)
            sections.setdefault(current_key, [])
            continue
        if h3:
            current_key = h3.group(1)
            sections.setdefault(current_key, [])
            continue
        row = TABLE_ROW_RE.match(line.strip())
        if row and current_key is not None:
            id_col, criterion = row.groups()
            if id_col in ("#", "---"):
                continue
            sections[current_key].append(criterion)
    return sections


def criteria_for_activity_type(rubric_sections: dict[str, list[str]], section4_key: str):
    rows = []
    for key, points_yes in (("1", 0), ("2", 1), ("3", 1), (section4_key, 1)):
        for desc in rubric_sections[key]:
            rows.append({"description": desc, "pointsYes": points_yes, "pointsNo": 0})
    return rows


def parse_chapter(path: Path):
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    title_line = lines[0]
    m = re.match(r"^# Chapter (\d+): (.+)$", title_line)
    if not m:
        raise ValueError(f"{path}: unexpected title line {title_line!r}")
    chapter_num, chapter_title = int(m.group(1)), m.group(2)

    marker = "\n## Interactive Activities\n"
    if marker not in text:
        raise ValueError(f"{path}: no Interactive Activities section found")
    body_part, activities_part = text.split(marker, 1)
    # Drop the title line from the body; keep everything else (through Key Terms) as context.
    body = body_part.split("\n", 1)[1].strip()
    body = re.sub(r"^---\n+", "", body)  # drop the title's leading horizontal-rule artifact
    body = re.sub(r"\n+---$", "", body).strip()  # drop the trailing rule before Interactive Activities

    activity_re = re.compile(
        r"### Activity (\d+\.\d+) — ([^:]+): (.+?)\n"
        r"\n\*(.+?)\*\n"
        r"\n---\n"
        r"\n\*\*Copy and paste this prompt into your AI tool:\*\*\n"
        r"\n(.+?)(?=\n---\n\n### Activity |\Z)",
        re.DOTALL,
    )
    activities = []
    for match in activity_re.finditer(activities_part):
        number, activity_type, subtitle, _description, blockquote = match.groups()
        activity_type = activity_type.strip()
        if activity_type not in ACTIVITY_TYPE_TO_SECTION:
            raise ValueError(f"{path}: unknown activity type {activity_type!r}")
        prompt_lines = []
        for line in blockquote.strip("\n").splitlines():
            if line == ">":
                prompt_lines.append("")
            elif line.startswith("> "):
                prompt_lines.append(line[2:])
            else:
                raise ValueError(f"{path}: unexpected non-blockquote line in activity {number}: {line!r}")
        prompt = "\n".join(prompt_lines).strip()
        activities.append(
            {
                "number": number,
                "type": activity_type,
                "subtitle": subtitle.strip(),
                "prompt": prompt,
            }
        )
    if len(activities) != 4:
        raise ValueError(f"{path}: expected 4 activities, found {len(activities)}")

    return {"number": chapter_num, "title": chapter_title, "body": body, "activities": activities}


def main():
    rubric_text = (ROOT / "activity-grading-rubric-only.md").read_text(encoding="utf-8")
    rubric_sections = parse_rubric_sections(rubric_text)
    expected_counts = {"1": 4, "2": 9, "3": 7, "4A": 3, "4B": 4, "4C": 4, "4D": 4}
    for key, expected in expected_counts.items():
        got = len(rubric_sections.get(key, []))
        if got != expected:
            raise ValueError(f"rubric section {key}: expected {expected} criteria, found {got}")

    chapters = []
    for path in sorted(ROOT.glob("chapter-*.md")):
        chapters.append(parse_chapter(path))
    if len(chapters) != 14:
        raise ValueError(f"expected 14 chapters, found {len(chapters)}")

    assignments = []
    for chapter in chapters:
        for activity in chapter["activities"]:
            section4_key = ACTIVITY_TYPE_TO_SECTION[activity["type"]]
            assignments.append(
                {
                    "title": f"{activity['number']} — {activity['type']}: {activity['subtitle']}",
                    "prompt": activity["prompt"],
                    "context": chapter["body"],
                    "published": False,
                    "criteria": criteria_for_activity_type(rubric_sections, section4_key),
                }
            )

    manifest = {
        "className": "MIS 340",
        "classLabel": "Relational Thinking: Intro to Databases",
        "assignments": assignments,
    }

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = [f"# MIS 340 import manifest — {len(assignments)} assignments\n"]
    for chapter in chapters:
        lines.append(f"## Chapter {chapter['number']}: {chapter['title']}")
        for activity in chapter["activities"]:
            n_criteria = len(criteria_for_activity_type(rubric_sections, ACTIVITY_TYPE_TO_SECTION[activity["type"]]))
            lines.append(f"- {activity['number']} — {activity['type']}: {activity['subtitle']} ({n_criteria} criteria)")
        lines.append("")
    (OUT_DIR / "manifest.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {len(assignments)} assignments across {len(chapters)} chapters to {OUT_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
