const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, getSQL } = require('./helpers.js');

test('every vendored file matches the hash in VERSIONS.md', () => {
  const md = fs.readFileSync(path.join(ROOT, 'vendor', 'VERSIONS.md'), 'utf8');
  const rows = md.split('\n').filter(l => /^\| [a-z]/.test(l) && !l.startsWith('| File'));
  assert.ok(rows.length >= 11, 'expected at least 11 vendored files');
  for (const row of rows) {
    const cells = row.split('|').map(s => s.trim());
    const file = cells[1];
    const hash = cells[5];
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'vendor', file))).digest('hex');
    assert.equal(actual, hash, file);
  }
});

test('sql.js runs a query in Node from the vendored wasm', async () => {
  const SQL = await getSQL();
  const db = new SQL.Database();
  const res = db.exec("SELECT 1 + 1 AS two, sqlite_version() AS v");
  assert.equal(res[0].values[0][0], 2);
  assert.match(res[0].values[0][1], /^3\./);
  db.close();
});
