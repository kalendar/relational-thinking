// The Gauntlet uses SQL Studio's vendored files in place. Their hashes must match SQL Studio's VERSIONS.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { VENDOR } = require('./helpers.js');

// Every vendored file the Gauntlet loads (build.js, Task 15, uses this same list).
const USED = ['sql.js/sql-wasm.js', 'sql.js/sql-wasm.wasm',
  'codemirror/codemirror.js', 'codemirror/mode-sql.js', 'codemirror/show-hint.js', 'codemirror/sql-hint.js',
  'codemirror/active-line.js', 'codemirror/matchbrackets.js', 'codemirror/codemirror.css', 'codemirror/show-hint.css'];

function readHashes() {
  const md = fs.readFileSync(path.join(VENDOR, 'VERSIONS.md'), 'utf8');
  const out = {};
  for (const m of md.matchAll(/^\| ([^|]+?) \| [^|]+ \| [^|]+ \| [^|]+ \| ([0-9a-f]{64}) \|$/gm)) out[m[1].trim()] = m[2];
  return out;
}

test('every vendored file the Gauntlet uses is listed in SQL Studio VERSIONS.md and matches its hash', () => {
  const hashes = readHashes();
  for (const f of USED) {
    assert.ok(hashes[f], `${f} is not listed in tools/sql-studio/vendor/VERSIONS.md`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(VENDOR, f))).digest('hex');
    assert.equal(actual, hashes[f], `${f} hash does not match VERSIONS.md`);
  }
});

module.exports = { USED, readHashes };
