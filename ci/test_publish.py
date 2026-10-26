#!/usr/bin/env python3
"""Offline tests for publish_to_pressbooks.py's decisions: what to publish,
what to skip, and when to refuse. A fake Pressbooks server stands in for the
REST API, so these never touch the real book.

Run: python3 -m unittest ci/test_publish.py
"""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import publish_to_pressbooks as P  # noqa: E402

PARTS = {"How We Think About Data": 10, "Relational Thinking": 11}
CH1 = next(c for c in P.CHAPTERS if c[0] == "chapter-01.md")
CH6 = next(c for c in P.CHAPTERS if c[0] == "chapter-06.md")  # has Mermaid diagrams


class FakeServer:
    """Holds chapters the way the REST API returns them with context=edit."""

    def __init__(self):
        self.chapters, self.updates, self.uploads, self.clock = {}, [], [], 0
        self.fail_uploads = False

    def tick(self):
        self.clock += 1
        return f"2026-10-26T12:00:{self.clock:02d}"

    def put(self, cid, title, part, order, raw):
        self.chapters[cid] = {"id": cid, "slug": f"ch-{cid}", "modified_gmt": self.tick(),
                              "title": {"raw": title}, "part": part, "menu_order": order,
                              "content": {"raw": raw}}

    def fetch(self, session, endpoint, cid):
        return json.loads(json.dumps(self.chapters.get(cid, {})))

    def update(self, session, endpoint, cid, title, html_text, order, part):
        self.updates.append(cid)
        self.put(cid, title, part, order, html_text)
        return self.chapters[cid]

    def upload(self, session, data, filename, content_type="image/png"):
        if self.fail_uploads:
            raise RuntimeError("media upload refused")
        self.uploads.append(filename)
        return f"https://pressbooks.example/media/{filename}-{len(self.uploads)}"


def rendered(chapter):
    filename, _cid, title, part, order, wip = chapter
    with open(os.path.join(ROOT, filename), encoding="utf-8") as f:
        return P.markdown_to_html(f.read(), None, filename[:-3])


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.server = FakeServer()
        self.tmp = tempfile.TemporaryDirectory()
        self.state = os.path.join(self.tmp.name, "state.json")
        patches = [
            mock.patch.object(P, "get_credentials", return_value=("u", "p")),
            mock.patch.object(P, "verify_credentials", return_value={"name": "Test"}),
            mock.patch.object(P, "discover_chapter_endpoint", return_value="https://x/chapters"),
            mock.patch.object(P, "discover_parts_by_title", return_value=PARTS),
            mock.patch.object(P, "fetch_chapter", side_effect=self.server.fetch),
            mock.patch.object(P, "update_chapter", side_effect=self.server.update),
            mock.patch.object(P, "upload_media", side_effect=self.server.upload),
            mock.patch.object(P, "render_mermaid_png", return_value=b"png"),
            mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_SHA": "a" * 40}),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)

    # helpers ---------------------------------------------------------------
    def live_as_published(self, chapter, raw=None):
        """Put a chapter on the fake server exactly as an earlier publish left it,
        with an old-style state record (timestamp only, no fingerprints)."""
        filename, cid, title, part, order, wip = chapter
        html_text = raw if raw is not None else rendered(chapter).replace(
            'src="https://mermaid.ink', 'src="https://pressbooks.example/media/old')
        self.server.put(cid, P.published_title(title, wip), PARTS[part], order, html_text)
        state = self.read_state()
        state[str(cid)] = {"file": filename, "slug": f"ch-{cid}",
                           "modified_gmt": self.server.chapters[cid]["modified_gmt"]}
        self.write_state(state)

    def read_state(self):
        try:
            with open(self.state) as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def write_state(self, state):
        with open(self.state, "w") as f:
            json.dump(state, f)

    def run_script(self, *args):
        argv = ["publish_to_pressbooks.py", "--state", self.state, *args]
        out = io.StringIO()
        with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(out):
            try:
                P.main()
                code = 0
            except SystemExit as e:
                code = e.code
        return code, out.getvalue()

    # tests -----------------------------------------------------------------
    def test_first_run_adopts_chapters_that_already_match_live(self):
        self.live_as_published(CH1)
        self.live_as_published(CH6)
        code, out = self.run_script("--only", "chapter-01.md", "chapter-06.md")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.server.updates, [])
        self.assertEqual(self.server.uploads, [], "nothing re-uploaded when nothing changed")
        for cid in (CH1[1], CH6[1]):
            self.assertIn("sent_sha256", self.read_state()[str(cid)])

    def test_changed_markdown_is_published_and_state_recorded(self):
        self.live_as_published(CH1, raw="<p>an older version of chapter 1</p>")
        code, out = self.run_script("--only", "chapter-01.md")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.server.updates, [CH1[1]])
        rec = self.read_state()[str(CH1[1])]
        self.assertEqual(rec["commit"], "a" * 40)
        self.assertEqual(rec["modified_gmt"], self.server.chapters[CH1[1]]["modified_gmt"])
        # A second run with no changes publishes nothing.
        code, out = self.run_script("--only", "chapter-01.md")
        self.assertEqual((code, self.server.updates), (0, [CH1[1]]), out)

    def test_diagrams_are_uploaded_when_a_chapter_with_diagrams_changes(self):
        self.live_as_published(CH6, raw="<p>old</p>")
        code, out = self.run_script("--only", "chapter-06.md")
        self.assertEqual(code, 0, out)
        self.assertEqual(len(self.server.uploads), 3)
        self.assertNotIn("mermaid.ink", self.server.chapters[CH6[1]]["content"]["raw"])

    def test_timestamp_only_drift_is_safe(self):
        self.live_as_published(CH1, raw="<p>old</p>")
        self.run_script("--only", "chapter-01.md")
        self.server.chapters[CH1[1]]["modified_gmt"] = self.server.tick()  # Pressbooks' 1-second tick
        code, out = self.run_script("--only", "chapter-01.md")
        self.assertEqual(code, 0, out)
        self.assertIn("content is identical", out)
        self.assertEqual(self.server.updates, [CH1[1]], "no second write")

    def test_edit_made_in_pressbooks_blocks_and_is_reported(self):
        self.live_as_published(CH1, raw="<p>old</p>")
        self.run_script("--only", "chapter-01.md")
        ch = self.server.chapters[CH1[1]]
        ch["content"]["raw"] += "<p>A paragraph someone typed into the web editor.</p>"
        ch["modified_gmt"] = self.server.tick()
        report = os.path.join(self.tmp.name, "report.md")
        with mock.patch.object(P, "markdown_at_commit", return_value=""):
            code, out = self.run_script("--only", "chapter-01.md", "--always", "--report", report)
        self.assertEqual(code, 1, out)
        self.assertIn("BLOCKED", out)
        self.assertEqual(self.server.updates, [CH1[1]], "the edit was not overwritten")
        with open(report) as f:
            self.assertIn("+A paragraph someone typed into the web editor.", f.read())

    def test_accept_current_then_publish_resolves_a_block(self):
        self.live_as_published(CH1, raw="<p>old</p>")
        self.run_script("--only", "chapter-01.md")
        self.server.chapters[CH1[1]]["modified_gmt"] = self.server.tick()
        self.server.chapters[CH1[1]]["content"]["raw"] += "<p>edit</p>"
        self.assertEqual(self.run_script("--only", "chapter-01.md")[0], 1)
        self.assertEqual(self.run_script("--only", "chapter-01.md", "--accept-current")[0], 0)
        code, out = self.run_script("--only", "chapter-01.md")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.server.updates, [CH1[1], CH1[1]])

    def test_chapter_with_no_state_record_is_blocked(self):
        filename, cid, title, part, order, wip = CH1
        self.server.put(cid, title, PARTS[part], order, "<p>x</p>")
        code, out = self.run_script("--only", filename)
        self.assertEqual(code, 1, out)
        self.assertEqual(self.server.updates, [])

    def test_failed_diagram_upload_fails_without_writing(self):
        self.live_as_published(CH6, raw="<p>old</p>")
        self.server.fail_uploads = True
        code, out = self.run_script("--only", "chapter-06.md")
        self.assertEqual(code, 1, out)
        self.assertEqual(self.server.updates, [])
        self.assertIn("nothing was written", out)

    def test_wip_flag_flip_republishes_with_new_title(self):
        self.live_as_published(CH1)
        self.run_script("--only", "chapter-01.md")
        renamed = [(c[0], c[1], c[2], c[3], c[4], True) if c is CH1 else c for c in P.CHAPTERS]
        with mock.patch.object(P, "CHAPTERS", renamed):
            code, out = self.run_script("--only", "chapter-01.md")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.server.chapters[CH1[1]]["title"]["raw"], "WIP: " + CH1[2])

    def test_dry_run_writes_nothing_and_renders_preview(self):
        self.live_as_published(CH6, raw="<p>old</p>")
        before = self.read_state()
        preview = os.path.join(self.tmp.name, "preview")
        code, out = self.run_script("--only", "chapter-06.md", "--dry-run", "--render-to", preview)
        self.assertEqual(code, 0, out)
        self.assertEqual((self.server.updates, self.server.uploads), ([], []))
        self.assertEqual(self.read_state(), before)
        with open(os.path.join(preview, "chapter-06.html")) as f:
            self.assertIn("mermaid.ink", f.read())

    def test_real_publish_refused_outside_ci_without_local(self):
        with mock.patch.dict(os.environ, {"GITHUB_ACTIONS": ""}):
            code, out = self.run_script("--only", "chapter-01.md")
        self.assertEqual(code, 2)
        self.assertEqual(self.server.updates, [])


if __name__ == "__main__":
    unittest.main()
