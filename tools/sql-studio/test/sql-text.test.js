const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/sql-text.js');

const kinds = sql => T.tokenize(sql).filter(t => t.type !== 'ws').map(t => `${t.type}:${t.text}`);

test('tokenize: words, strings with doubled quotes, numbers, operators, comments', () => {
  assert.deepEqual(kinds("SELECT x FROM t WHERE n >= 2.5 AND s = 'God''s Plan' -- hi\n;"), [
    'word:SELECT', 'word:x', 'word:FROM', 'word:t', 'word:WHERE', 'word:n', 'op:>=', 'number:2.5',
    'word:AND', 'word:s', 'op:=', "string:'God''s Plan'", 'comment:-- hi', 'punct:;',
  ]);
});

test('tokenize: quoted identifiers, block comments, and offsets', () => {
  const toks = T.tokenize('SELECT "my col" /* a;b */ FROM [T]');
  const q = toks.find(t => t.type === 'qident');
  assert.equal(q.text, '"my col"');
  assert.equal(q.start, 7);
  assert.equal(q.end, 15);
  assert.ok(toks.some(t => t.type === 'comment' && t.text === '/* a;b */'));
  assert.ok(toks.some(t => t.type === 'qident' && t.text === '[T]'));
});

test('tokenize: an unterminated string runs to the end and is marked open', () => {
  const s = T.tokenize("SELECT 'Pop").find(t => t.type === 'string');
  assert.equal(s.text, "'Pop");
  assert.equal(s.open, true);
});

test('splitStatements ignores ; inside strings, quoted names, and comments', () => {
  const sql = "SELECT ';' AS a; -- x;y\nSELECT \"b;c\" FROM t;\n\n  ";
  const parts = T.splitStatements(sql);
  assert.equal(parts.length, 3);
  assert.equal(parts[0].text, "SELECT ';' AS a");
  assert.equal(parts[1].text.trim(), '-- x;y\nSELECT "b;c" FROM t');
  assert.equal(parts[2].empty, true);
  assert.equal(sql.slice(parts[1].start, parts[1].end).trim().endsWith(';'), true);
});

test('statementAt picks the statement the cursor is in', () => {
  const sql = 'SELECT 1;\nSELECT 2;\nSELECT 3';
  assert.equal(T.statementAt(sql, 3).text.trim(), 'SELECT 1');
  assert.equal(T.statementAt(sql, sql.indexOf('2')).text.trim(), 'SELECT 2');
  assert.equal(T.statementAt(sql, sql.length).text.trim(), 'SELECT 3');
});

test('statementAt after the last ; uses the statement before it', () => {
  const sql = 'SELECT 1;\nSELECT 2;\n   -- done\n';
  assert.equal(T.statementAt(sql, sql.length).text.trim(), 'SELECT 2');
});

test('statementAt returns null when there is no query at all', () => {
  assert.equal(T.statementAt('  -- only a comment\n', 5), null);
  assert.equal(T.statementAt('', 0), null);
});

test('aliasMap reads FROM and JOIN aliases, with or without AS', () => {
  const m = T.aliasMap('SELECT * FROM Streams s JOIN Songs AS so ON so.song_id = s.song_id JOIN artists ON 1', ['Streams', 'Songs', 'Artists']);
  assert.equal(m.get('s'), 'Streams');
  assert.equal(m.get('so'), 'Songs');
  assert.equal(m.get('streams'), 'Streams');
  assert.equal(m.get('artists'), 'Artists');
  assert.equal(m.has('on'), false);
});

test('lineCol and offsetOf are inverses', () => {
  const text = 'SELECT a\nFROM t\nWHERE x';
  assert.deepEqual(T.lineCol(text, text.indexOf('WHERE')), { line: 3, col: 1 });
  assert.deepEqual(T.lineCol(text, text.indexOf('t\n')), { line: 2, col: 6 });
  assert.equal(T.offsetOf(text, 2, 6), text.indexOf('t\n'));
});
