# CI/CD

Everything here is run by `.github/workflows/ci.yml`.

- **Every pull request** runs the checks below, plus a read-only dry run against
  Pressbooks that reports which chapters the PR would change and attaches an
  HTML preview of each one (the run's **chapter-previews** artifact).
- **Every merge to `master`** runs the same checks, deploys the practice tools
  to GitHub Pages, then publishes every chapter whose content, title or place
  in the book changed. Each publish is tagged `pub-YYYY-MM-DD-runN`.

**Don't commit to `gh-pages` or `publish-state` by hand, and don't edit chapters
in the Pressbooks web editor.** The pipeline owns all three.

## Checks

| Job | Check | Blocks merge? |
|---|---|---|
| Chapters | `lint_chapters.py`: H1 matches the file; every chapter is listed in `CHAPTERS`; learning-outcomes list in the exact form the publish script styles (required once a chapter's `wip` flag is `False`); every activity prompt is a blockquote; code fences balanced; local images exist; links to practice tools point at a page the build produces | Yes |
| Chapters | `check_mermaid.py`: every Mermaid diagram renders | Yes |
| Chapters | `test_publish.py`: the publish script's decisions, against a fake Pressbooks | Yes |
| Tools | Unit tests in `tools/*/test` | Yes |
| Tools | Committed `tools/*/dist/*.html` match a fresh build from `src/` | Yes |
| Tools | `smoke_test.js`: every page of the site opens in Chromium with no errors | Yes |
| Pressbooks preview | Dry run: fails if a chapter the PR touches was edited on Pressbooks (BLOCKED) | Not yet required |
| External links | `check_external_links.py`: warns about dead links | No |

## How publishing decides what to do

For each chapter, `publish_to_pressbooks.py`:

1. Reads the live chapter from Pressbooks.
2. **Drift guard.** If the live page changed since the last publish, it stops
   and reports the chapter as **BLOCKED**, unless the stored content is
   byte-identical to what was published (Pressbooks sometimes bumps the
   timestamp on its own about a second after a publish; that case is safe).
3. **Change check.** It renders the `.md` without uploading anything and
   compares a fingerprint (title, part, position, HTML with image URLs masked)
   with what it last sent. Unchanged chapters are skipped, so diagrams aren't
   re-uploaded on every merge.
4. Publishes changed chapters, uploading their diagrams and images, and
   records the result on the `publish-state` branch.

A diagram or image that can't be rendered or uploaded fails the chapter, and
nothing is written for it. Any BLOCKED or failed chapter fails the run and opens
a GitHub issue that includes a plain-text diff of what changed on Pressbooks.

## Manual runs (Actions → CI → Run workflow, on `master`)

| Mode | Chapters | What it does |
|---|---|---|
| `publish` | empty | A normal publish run |
| `publish` | `chapter-04.md` | Writes the listed chapters even if unchanged (e.g. after replacing an image file, which the change check can't see) |
| `accept-current` | `chapter-02.md` | Adopts the live Pressbooks version as the baseline after a BLOCKED chapter has been reviewed. Writes nothing to Pressbooks |

## Running the checks locally

```sh
npm ci --prefix ci                         # once: mermaid-cli + Playwright
pip install -r ci/requirements-publish.txt # once: exactly what CI renders with
ci/assemble_site.sh                        # builds every tool into _site/
python3 ci/lint_chapters.py --site _site
python3 ci/check_mermaid.py
python3 -m unittest ci/test_publish.py
for t in tools/*/test; do node --test "$t"/*.test.js; done
npx --prefix ci playwright install chromium  # once
node ci/smoke_test.js _site
python3 ci/check_external_links.py
```

`python3 publish_to_pressbooks.py --dry-run` also works locally (with
credentials in `.env`) and never writes anything. A real publish from a laptop
is refused unless you add `--local`. That's for emergencies only, because the
next CI run will report the chapter as BLOCKED until it's reconciled with
`accept-current`.

## Adding a new tool

- A tool with a build step: `tools/<name>/build.js` must write
  `tools/<name>/dist/<name>.html`. It's picked up automatically.
- A single-file tool: put it in `tools/splitters/` (or add a line to
  `assemble_site.sh` for a new folder).
- Add it to `tools/index.html`, and link to it from the chapter as
  `https://kalendar.github.io/relational-thinking/<name>.html`.
