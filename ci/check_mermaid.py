#!/usr/bin/env python3
"""Renders every ```mermaid block in the chapters, so a diagram with a syntax
error fails the pull request instead of breaking at publish time.

Uses the mermaid-cli pinned in ci/package.json (run `npm ci --prefix ci` first).
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MMDC = os.path.join(HERE, "node_modules", ".bin", "mmdc")


def blocks(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    i = 0
    while i < len(lines):
        if lines[i].strip() == "```mermaid":
            start = i + 1
            j = start
            while j < len(lines) and lines[j].strip() != "```":
                j += 1
            yield start, "\n".join(lines[start:j])
            i = j
        i += 1


def main():
    if not os.path.exists(MMDC):
        print("::error::mermaid-cli isn't installed. Run: npm ci --prefix ci")
        return 1
    failures = total = 0
    with tempfile.TemporaryDirectory() as tmp:
        cfg = os.path.join(tmp, "puppeteer.json")
        with open(cfg, "w") as f:
            json.dump({"args": ["--no-sandbox"]}, f)
        for path in sorted(glob.glob("chapter-*.md")):
            for line, src in blocks(path):
                total += 1
                mmd = os.path.join(tmp, "d.mmd")
                with open(mmd, "w", encoding="utf-8") as f:
                    f.write(src)
                r = subprocess.run([MMDC, "-q", "-p", cfg, "-i", mmd, "-o", os.path.join(tmp, "d.svg")],
                                   capture_output=True, text=True)
                if r.returncode:
                    failures += 1
                    detail = (r.stderr or r.stdout).strip().splitlines()
                    msg = next((d for d in detail if "Error" in d or "error" in d), detail[0] if detail else "render failed")
                    print(f"::error file={path},line={line}::Mermaid diagram doesn't render: {msg}")
    print(f"Rendered {total - failures} of {total} Mermaid diagrams.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
