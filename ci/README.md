# CI checks

Everything here is run by `.github/workflows/ci.yml` on every pull request and
every merge to `master`. A merge to `master` also deploys the practice tools to
GitHub Pages. **Don't commit to `gh-pages` by hand any more** — the pipeline owns it.

| Job | Check | Blocks merge? |
|---|---|---|
| Chapters | `lint_chapters.py`: H1 matches the file, learning-outcomes list in the exact form the publish script styles, every activity prompt is a blockquote, code fences balanced, local images exist, links to practice tools point at a page the build produces | Yes (a missing learning-outcomes list only warns, for WIP chapters) |
| Chapters | `check_mermaid.py`: every Mermaid diagram renders | Yes |
| Tools | Unit tests in `tools/*/test` | Yes |
| Tools | Committed `tools/*/dist/*.html` match a fresh build from `src/` | Yes |
| Tools | `smoke_test.js`: every page of the site opens in Chromium with no uncaught or console errors | Yes |
| External links | `check_external_links.py`: warns about dead links (404s, DNS failures); sites that refuse robots are skipped | No |

## Running the checks locally

```sh
npm ci --prefix ci                         # once: mermaid-cli + Playwright
ci/assemble_site.sh                        # builds every tool into _site/
python3 ci/lint_chapters.py --site _site
python3 ci/check_mermaid.py
for t in tools/*/test; do node --test "$t"/*.test.js; done
npx --prefix ci playwright install chromium  # once
node ci/smoke_test.js _site
python3 ci/check_external_links.py
```

## Adding a new tool

- A tool with a build step: `tools/<name>/build.js` must write
  `tools/<name>/dist/<name>.html`. It's picked up automatically.
- A single-file tool: put it in `tools/splitters/` (or add a line to
  `assemble_site.sh` for a new folder).
- Add it to `tools/index.html`, and link to it from the chapter as
  `https://kalendar.github.io/relational-thinking/<name>.html`.
