#!/usr/bin/env python3
"""Advisory check: tries every external link in the chapters and warns about
ones that look broken. Never fails the build, because many sites refuse
automated requests even when the link is fine.
"""
import concurrent.futures
import glob
import re
import urllib.error
import urllib.request

URL = re.compile(r"https?://[^\s)\"'<>\]]+")
SKIP = ("https://kalendar.github.io/relational-thinking/",)  # checked strictly by lint_chapters.py
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def collect():
    found = {}
    for path in sorted(glob.glob("chapter-*.md")):
        with open(path, encoding="utf-8") as f:
            for n, line in enumerate(f, 1):
                for u in URL.findall(line):
                    u = u.rstrip(".,;:")
                    if not u.startswith(SKIP):
                        found.setdefault(u, (path, n))
    return found


def probe(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:  # DNS failure, timeout, TLS error
        return type(e).__name__


def main():
    links = collect()
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        results = dict(zip(links, ex.map(probe, links)))
    # 401/403/429 mean the site refused a robot, not that the page is gone.
    REFUSED = {401, 403, 429, 999}
    bad = refused = 0
    for url, status in results.items():
        if status in REFUSED:
            refused += 1
        elif not (isinstance(status, int) and status < 400):
            bad += 1
            path, line = links[url]
            print(f"::warning file={path},line={line}::Link may be broken ({status}): {url}")
    print(f"Checked {len(links)} external links: {bad} look broken, {refused} couldn't be checked (site refuses robots).")


if __name__ == "__main__":
    main()
