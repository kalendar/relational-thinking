const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/mistakes.js');
const Q = require('../src/randomq.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const C = require('../src/check.js');
const { getSQL, loadAllDatasets } = require('./helpers.js');

const sample = S.buildSchema(loadAllDatasets()[0]);
const GROUPED = [
  'SELECT a.genre, SUM(st.seconds_listened) AS total_seconds',
  'FROM Stream st',
  'JOIN Song s ON s.song_id = st.song_id',
  'JOIN Artist a ON a.artist_id = s.artist_id',
  "WHERE st.stream_date BETWEEN '2026-03-01' AND '2026-03-31'",
  "  AND a.genre <> 'Pop'",
  'GROUP BY a.genre',
  'HAVING SUM(st.seconds_listened) >= 300',
  'ORDER BY total_seconds DESC',
  'LIMIT 5',
].join('\n');

// Applies one mistake (by id) and returns every result it can produce over many seeds.
function outcomes(id, sql) {
  const out = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const got = M.applyMistake(id, sql, sample, seed);
    if (got !== null) out.add(got);
  }
  return [...out];
}
const swap = (sql, a, b) => sql.replace(a, b);

test('every mistake has an id, a kind, and a label', () => {
  assert.ok(M.MISTAKES.length >= 15);
  for (const m of M.MISTAKES) {
    assert.match(m.id, /^[a-z-]+$/);
    assert.ok(['error', 'wrong-rows'].includes(m.kind), m.id);
    assert.ok(m.label.length > 5, m.id);
  }
});

test('text without quotes leaves dates and LIKE patterns alone', () => {
  assert.deepEqual(outcomes('quotes', GROUPED), [swap(GROUPED, "<> 'Pop'", '<> Pop')]);
});

test('a date without quotes', () => {
  assert.deepEqual(outcomes('date-quotes', GROUPED).sort(), [
    swap(GROUPED, "BETWEEN '2026-03-01'", 'BETWEEN 2026-03-01'),
    swap(GROUPED, "AND '2026-03-31'", 'AND 2026-03-31'),
  ].sort());
});

test('an aggregate moved from HAVING into WHERE', () => {
  assert.deepEqual(outcomes('where-aggregate', GROUPED), [GROUPED
    .replace("  AND a.genre <> 'Pop'\n", "  AND a.genre <> 'Pop'\n  AND SUM(st.seconds_listened) >= 300\n")
    .replace('HAVING SUM(st.seconds_listened) >= 300\n', '')]);
});

test('a missing GROUP BY, AND/OR swapped (not the AND in BETWEEN), and a flipped sort', () => {
  assert.deepEqual(outcomes('missing-group-by', GROUPED), [swap(GROUPED, 'GROUP BY a.genre\n', '')]);
  assert.deepEqual(outcomes('and-or', GROUPED), [swap(GROUPED, "  AND a.genre", "  OR a.genre")]);
  assert.deepEqual(outcomes('sort-direction', GROUPED), [swap(GROUPED, 'ORDER BY total_seconds DESC', 'ORDER BY total_seconds')]);
  const asc = swap(GROUPED, 'ORDER BY total_seconds DESC', 'ORDER BY total_seconds');
  assert.deepEqual(outcomes('sort-direction', asc), [GROUPED]);
});

test('commas and parentheses in the SELECT list', () => {
  assert.deepEqual(outcomes('missing-comma', GROUPED), [swap(GROUPED, 'a.genre, SUM', 'a.genre SUM')]);
  assert.deepEqual(outcomes('extra-comma', GROUPED), [swap(GROUPED, 'AS total_seconds\nFROM', 'AS total_seconds,\nFROM')]);
  assert.deepEqual(outcomes('missing-paren', GROUPED), [swap(GROUPED, 'SUM(st.seconds_listened) AS', 'SUM(st.seconds_listened AS')]);
});

test('a misspelled keyword or column name', () => {
  const kw = outcomes('keyword', GROUPED);
  assert.ok(kw.length >= 3);
  for (const k of kw) assert.ok(/SELCT|FORM|WHRE|GRUOP|ODER|JION|HAVIGN|BETWEN/.test(k), k);
  const cols = outcomes('column-typo', GROUPED);
  assert.ok(cols.length >= 1);
  for (const c of cols) {
    assert.ok(!c.startsWith('SELECT a.genre, SUM(st.seconds_listened)'), c);
    assert.equal(c.length, GROUPED.length, 'two letters swapped');
  }
});

test('= NULL instead of IS NULL, and LIKE without %', () => {
  const sql = "SELECT artist_name\nFROM Artist\nWHERE hometown IS NULL\n  OR artist_name LIKE '%Swift%'";
  assert.deepEqual(outcomes('null-equals', sql), [swap(sql, 'IS NULL', '= NULL')]);
  assert.deepEqual(outcomes('null-equals', swap(sql, 'IS NULL', 'IS NOT NULL')), [swap(sql, 'IS NULL', '<> NULL')]);
  assert.deepEqual(outcomes('like-no-wildcard', sql), [swap(sql, "'%Swift%'", "'Swift'")]);
});

test('a join on the wrong key, and the wrong attribute', () => {
  const joins = outcomes('wrong-join', GROUPED).sort();
  assert.deepEqual(joins, [
    swap(GROUPED, 'ON s.song_id = st.song_id', 'ON s.song_id = st.stream_id'),
    swap(GROUPED, 'ON a.artist_id = s.artist_id', 'ON a.artist_id = s.song_id'),
  ].sort());
  const plain = "SELECT artist_name, hometown\nFROM Artist\nWHERE genre = 'Pop'";
  const got = outcomes('wrong-column', plain).sort();
  assert.deepEqual(got, [swap(plain, 'artist_name,', 'genre,'), swap(plain, ', hometown', ', genre')].sort());
  assert.equal(M.applyMistake('wrong-column', 'SELECT COUNT(*) FROM Artist', sample, 1), null, 'nothing to swap');
});

test('mistakeHeader wraps the question as SQL comments and says how many mistakes', () => {
  const h = M.mistakeHeader('For each row of Stream (with its matching Song and Artist rows), show song_title, artist_name, and stream_date. Only include rows where genre is Pop.', 2);
  const lines = h.split('\n');
  assert.ok(lines.every(l => l.startsWith('-- ') && l.length <= 80), h);
  assert.match(lines[0], /^-- Question: For each row/);
  assert.equal(lines[lines.length - 1], '-- This query has 2 mistakes. Fix them and check the result.');
  assert.match(M.mistakeHeader('Q.', 1), /This query has 1 mistake\. Fix it and check the result\.$/);
});

test('broken queries on every data set: 1–2 real mistakes, and the fix gives the right result', async () => {
  const SQL = await getSQL();
  const used = new Set();
  for (const d of loadAllDatasets()) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    const run = sql => D.runQuery(st, sql);
    for (let i = 0; i < 80; i++) {
      const rnd = Q.mulberry32(i * 13 + d.number);
      const options = Object.fromEntries(Q.FEATURES.map(f => [f, rnd() < 0.6]));
      const b = M.makeBrokenQuery({ schema: st.schema, run, options, seed: 4000 + i });
      const label = `${d.id} #${i} [${b.mistakes.map(m => m.id)}]\n${b.text}\n--- original ---\n${b.original}`;
      assert.ok(b.mistakes.length === 1 || b.mistakes.length === 2, label);
      b.mistakes.forEach(m => used.add(m.id));
      assert.ok(b.text.startsWith('-- Question: '), label);
      assert.ok(b.text.includes(b.broken), label);
      const orig = run(b.original);
      assert.equal(orig.ok, true, label);
      const broken = run(b.broken);
      const differs = !broken.ok || !C.compareResults(broken, orig, { orderMatters: /ORDER BY/i.test(b.original) }).ok;
      assert.ok(differs, `broken query gives the right answer anyway:\n${label}`);
    }
    D.closeStudio(st);
  }
  for (const m of M.MISTAKES) assert.ok(used.has(m.id), `mistake never used: ${m.id}`);
});
