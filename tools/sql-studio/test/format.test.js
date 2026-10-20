const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/format.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { EXERCISES } = require('../src/exercises.js');
const { getSQL, loadDatasets } = require('./helpers.js');

test('book style: clauses on new lines, conditions indented, keywords upper case', () => {
  const input = "select song_title, duration_sec from Songs where genre = 'Pop' and release_date between '2024-01-01' and '2024-12-31' and duration_sec < 180";
  assert.equal(F.formatSql(input), [
    'SELECT song_title, duration_sec',
    'FROM Songs',
    "WHERE genre = 'Pop'",
    "  AND release_date BETWEEN '2024-01-01' AND '2024-12-31'",
    '  AND duration_sec < 180',
  ].join('\n'));
});

test('joins, group by, having, order by, limit', () => {
  const input = 'select a.artist_name,sum(st.stream_count) as total from Streams st join Songs so on so.song_id=st.song_id join Artists a on a.artist_id=so.artist_id group by a.artist_name having sum(st.stream_count)>5000000 order by total desc limit 3;';
  assert.equal(F.formatSql(input), [
    'SELECT a.artist_name, SUM(st.stream_count) AS total',
    'FROM Streams st',
    'JOIN Songs so ON so.song_id = st.song_id',
    'JOIN Artists a ON a.artist_id = so.artist_id',
    'GROUP BY a.artist_name',
    'HAVING SUM(st.stream_count) > 5000000',
    'ORDER BY total DESC',
    'LIMIT 3;',
  ].join('\n'));
});

test('long select lists go one per line', () => {
  const out = F.formatSql('SELECT player_name, position, class_year, jersey_number, player_id, player_name AS again FROM Players');
  assert.equal(out.split('\n')[0], 'SELECT');
  assert.equal(out.split('\n')[1], '  player_name,');
  assert.equal(out.split('\n')[6], '  player_name AS again');
  assert.equal(out.split('\n')[7], 'FROM Players');
});

test('strings, quoted names, comments, and semicolons in strings are kept exactly', () => {
  const input = "-- top songs\nselect \"song title\" , 'a;b''c' from Songs -- end\nwhere x = -5";
  const out = F.formatSql(input);
  assert.ok(out.includes('"song title"'));
  assert.ok(out.includes("'a;b''c'"));
  assert.ok(out.includes('-- top songs\n'));
  assert.ok(out.includes('-- end\n'));
  assert.ok(out.includes('x = -5'));
});

test('OR mixed with parentheses keeps the parentheses on one line', () => {
  const out = F.formatSql("select * from Games where (home_away = 'Home' and result = 'W') or opponent = 'App State'");
  assert.equal(out, "SELECT *\nFROM Games\nWHERE (home_away = 'Home' AND result = 'W')\n  OR opponent = 'App State'");
});

test('COUNT(*), COUNT(DISTINCT x), IN lists, and subqueries', () => {
  const out = F.formatSql('select count(*), count(distinct hall_id) from MealSwipes where hall_id in (1,2) and student_id in (select student_id from Students where meal_plan = \'Unlimited\')');
  assert.ok(out.includes('SELECT COUNT(*), COUNT(DISTINCT hall_id)'));
  assert.ok(out.includes('hall_id IN (1, 2)'));
  assert.ok(out.includes('student_id IN (\n    SELECT student_id\n    FROM Students\n    WHERE meal_plan = \'Unlimited\')'));
});

test('several statements are each formatted', () => {
  assert.equal(F.formatSql('select 1; select 2'), 'SELECT 1;\n\nSELECT 2');
});

test('formatting is idempotent on every exercise answer', () => {
  for (const list of Object.values(EXERCISES)) for (const ex of list) {
    const once = F.formatSql(ex.answer);
    assert.equal(F.formatSql(once), once, ex.text);
  }
});

test('formatting never changes the result of any exercise answer', async () => {
  const SQL = await getSQL();
  for (const d of loadDatasets()) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    for (const ex of EXERCISES[d.id]) {
      const before = D.runQuery(st, ex.answer.replace(/;\s*$/, ''));
      const after = D.runQuery(st, F.formatSql(ex.answer).replace(/;\s*$/, ''));
      assert.deepEqual(after, before, ex.text);
    }
    D.closeStudio(st);
  }
});

const T = require('../src/sql-text.js');
const realStatements = sql => T.splitStatements(sql).filter(p => !p.empty).length;

test('a comment after a ; stays after that statement, and the ; is kept', () => {
  assert.equal(F.formatSql('SELECT * FROM Songs; -- my first query'), 'SELECT *\nFROM Songs; -- my first query');
  assert.equal(F.formatSql('SELECT 1; -- a\nSELECT 2; -- b'), 'SELECT 1; -- a\n\nSELECT 2; -- b');
});

test('a statement ending in a -- comment gets its ; on the next line, not inside the comment', () => {
  const out = F.formatSql('SELECT 1 -- one\n;\nSELECT 2;');
  assert.equal(out, 'SELECT 1 -- one\n;\n\nSELECT 2;');
});

test('comments never change how many statements there are, and formatting twice changes nothing', () => {
  const inputs = [
    'SELECT * FROM Songs; -- my first query',
    'SELECT * FROM Songs; -- my first query\nSELECT * FROM Artists;',
    'SELECT 1 -- one\n;\nSELECT 2;',
    '-- top\nSELECT 1; /* mid */ SELECT 2; -- end',
    'SELECT 1;\n-- just a note\n\nSELECT 2',
    'select a -- why\nfrom t; select b from u -- last',
  ];
  for (const sql of inputs) {
    const once = F.formatSql(sql);
    assert.equal(realStatements(once), realStatements(sql), `statement count changed:\n${sql}\n→\n${once}`);
    assert.equal(F.formatSql(once), once, `not idempotent:\n${once}`);
  }
});

test('comment lines above a query stay exactly as they are, right above it', () => {
  const head = '-- Question: For each genre, show the total.\n-- This query has 1 mistake. Fix it.';
  assert.equal(F.formatStatement(`${head}\nselect a.genre from A a`), `${head}\nSELECT a.genre\nFROM A a`);
  assert.equal(F.formatSql(`${head}\nselect 1;`), `${head}\nSELECT 1;`);
  const once = F.formatSql(`${head}\nselect 1;`);
  assert.equal(F.formatSql(once), once);
});
