const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const E = require('../src/errors.js');
const { getSQL, loadDatasets } = require('./helpers.js');

let st;
async function explain(sql) {
  if (!st) {
    const d = loadDatasets().find(x => x.id === 'basketball');
    st = D.openStudio(await getSQL(), S.buildSchema(d));
  }
  const r = D.runQuery(st, sql);
  assert.equal(r.ok, false, `expected an error for: ${sql}`);
  return E.explainError(r.error, sql, st.schema);
}
const at = (sql, ex) => sql.slice(ex.offset, ex.offset + ex.length);

test('qualified unknown column names the table behind the alias', async () => {
  const sql = 'SELECT p.player_name, p.address\nFROM Players p';
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's no column called `address` in the `Players` table.");
  assert.equal(at(sql, ex), 'p.address');
  assert.match(ex.raw, /no such column: p\.address/);
});

test('unqualified unknown column, with a did-you-mean', async () => {
  const sql = 'SELECT player_nme FROM Players';
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's no column called `player_nme` in the tables this query uses. Did you mean `player_name`?");
  assert.equal(at(sql, ex), 'player_nme');
});

test('unknown table suggests the closest table', async () => {
  const sql = 'SELECT * FROM Player';
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's no table called `Player`. Did you mean `Players`?");
  assert.equal(at(sql, ex), 'Player');
});

test('misspelled keyword', async () => {
  const sql = 'SELECT *\nFORM Players';
  const ex = await explain(sql);
  assert.equal(ex.headline, "SQL didn't understand the word `FORM`. Did you mean `FROM`?");
  assert.equal(at(sql, ex), 'FORM');
});

test('a query that ends too early', async () => {
  const sql = 'SELECT player_name position FROM Players WHERE';
  const ex = await explain(sql);
  assert.match(ex.headline, /^The query stops too early\./);
});

test('missing comma reads as a confusing token', async () => {
  const sql = 'SELECT player_name, FROM Players';
  const ex = await explain(sql);
  assert.equal(ex.headline, "SQL got confused at `FROM`. Check the word just before it: a missing comma, quote, or keyword is common.");
  assert.equal(at(sql, ex), 'FROM');
});

test('unclosed quote', async () => {
  const sql = "SELECT * FROM Players WHERE position = 'Guard";
  const ex = await explain(sql);
  assert.equal(ex.headline, "There's a text value with no closing quote. Text values need a `'` on both sides.");
  assert.equal(at(sql, ex), "'Guard");
});

test('ambiguous column', async () => {
  const sql = 'SELECT player_id FROM BoxScores JOIN Players ON Players.player_id = BoxScores.player_id';
  const ex = await explain(sql);
  assert.equal(ex.headline, 'More than one table has a column called `player_id`. Say which one you mean, like `BoxScores.player_id`.');
  assert.equal(at(sql, ex), 'player_id');
});

test('aggregate in WHERE', async () => {
  const sql = 'SELECT player_id FROM BoxScores WHERE SUM(points) > 10';
  const ex = await explain(sql);
  assert.equal(ex.headline, "You can't use `SUM` in `WHERE`. To filter on a total, use `HAVING` after `GROUP BY`.");
  assert.equal(at(sql, ex), 'SUM');
});

test('HAVING without GROUP BY, when this SQLite rejects it', async () => {
  const d = loadDatasets().find(x => x.id === 'basketball');
  const st2 = D.openStudio(await getSQL(), S.buildSchema(d));
  const sql = 'SELECT player_id FROM BoxScores HAVING points > 1';
  const r = D.runQuery(st2, sql);
  // SQLite 3.39+ allows HAVING without GROUP BY, so only check the wording when it errors.
  if (!r.ok) assert.match(E.explainError(r.error, sql, st2.schema).headline, /HAVING/);
  D.closeStudio(st2);
});

test('unknown function and wrong argument count', async () => {
  const ex1 = await explain('SELECT AVERAGE(points) FROM BoxScores');
  assert.equal(ex1.headline, "SQLite doesn't have a function called `AVERAGE`. Did you mean `AVG`?");
  const ex2 = await explain('SELECT ROUND() FROM BoxScores');
  assert.equal(ex2.headline, '`ROUND` was given the wrong number of values inside its parentheses.');
});

test('ORDER BY number out of range', async () => {
  const ex = await explain('SELECT player_name FROM Players ORDER BY 3');
  assert.equal(ex.headline, '`ORDER BY 3` means "sort by column 3," but your result only has 1 column.');
});

test('incomplete input points at the end', async () => {
  const sql = 'SELECT * FROM Players WHERE (points > 2';
  const ex = await explain(sql);
  assert.match(ex.headline, /^The query stops too early\. Is something missing at the end/);
  assert.equal(ex.offset, sql.length);
});

test('readonly and unknown errors', () => {
  const ro = E.explainError({ kind: 'readonly', message: '' }, 'DELETE FROM Players', null);
  assert.equal(ro.headline, 'SQL Studio only runs queries that read data (SELECT). Changing data comes later in the course.');
  const other = E.explainError({ kind: 'sqlite', message: 'disk I/O error' }, 'SELECT 1', null);
  assert.equal(other.headline, 'Something went wrong running this query.');
  assert.equal(other.offset, null);
});

test('closest ignores case and respects the distance limit', () => {
  assert.equal(E.closest('artist', ['Artists', 'Songs']), 'Artists');
  assert.equal(E.closest('zzz', ['Artists', 'Songs']), null);
});

async function explainProbed(sql) {
  const d = loadDatasets().find(x => x.id === 'spotify');
  const st2 = D.openStudio(await getSQL(), S.buildSchema(d));
  const r = D.runQuery(st2, sql);
  assert.equal(r.ok, false);
  const ex = E.explainError(r.error, sql, st2.schema, { probe: s => D.probeError(st2, s) });
  D.closeStudio(st2);
  return ex;
}

test('probeError: null when SQLite can compile the text, the message when it cannot', async () => {
  const st2 = D.openStudio(await getSQL(), S.buildSchema(loadDatasets()[0]));
  assert.equal(D.probeError(st2, 'SELECT * FROM Songs'), null);
  assert.match(D.probeError(st2, 'SELECT * FROM'), /incomplete input/);
  D.closeStudio(st2);
});

test('a missing ; between two queries points at the second SELECT and says so', async () => {
  const sql = 'SELECT * FROM Songs\n-- my first query\nSELECT * FROM Artists';
  const ex = await explainProbed(sql);
  assert.equal(ex.offset, sql.lastIndexOf('SELECT'));
  assert.equal(ex.headline, 'SQL got confused at `SELECT`. Did you forget a `;` between two queries?');
});

test('a repeated word is marked where it actually breaks, not at its first use', async () => {
  const sql = 'SELECT * FROM Songs WHERE duration_sec BETWEEN 100 AND 200 AND AND song_id > 1';
  const ex = await explainProbed(sql);
  assert.equal(ex.offset, sql.indexOf('AND AND') + 4);
});
