# publish-state

This branch holds only `publish-state.json`: what the last Pressbooks publish
left on the server for each chapter (timestamp, content hash, fingerprint of
what was sent, and the commit it came from).

The CI workflow on `master` reads and updates it on every publish. It lives on
its own branch because `master` only accepts changes through pull requests.

**Don't edit it by hand.** To adopt the live Pressbooks version of a chapter,
run the CI workflow manually with mode `accept-current` (see `ci/README.md`).
