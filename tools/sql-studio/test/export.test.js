const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../src/export.js');

const result = { ok: true, columns: ['name', 'total'], rows: [['Bad Bunny', 5950000], ['Say "hi", ok', 2.5], ['two\nlines', null]] };

test('TSV: tabs and newlines in cells become spaces, NULL is empty', () => {
  assert.equal(X.toTSV({ columns: ['a', 'b'], rows: [['x\ty', null], ['p\nq', 3]] }), 'a\tb\nx y\t\np q\t3\n');
});

test('CSV: quotes, commas, and newlines are quoted; CRLF line ends', () => {
  assert.equal(X.toCSV(result).slice(1), 'name,total\r\nBad Bunny,5950000\r\n"Say ""hi"", ok",2.5\r\n"two\nlines",\r\n');
});

test('formula-looking text is made safe; negative numbers are not changed', () => {
  const r = { columns: ['v'], rows: [['=HYPERLINK("x")'], ['+1'], ['-dash'], ['@me'], [-5]] };
  assert.equal(X.toTSV(r), "v\n'=HYPERLINK(\"x\")\n'+1\n'-dash\n'@me\n-5\n");
  assert.equal(X.toCSV(r).split('\r\n')[1], '"\'=HYPERLINK(""x"")"');
  assert.equal(X.toCSV(r).split('\r\n')[5], '-5');
});

test('textTable pads columns and right-aligns numbers', () => {
  assert.equal(X.textTable(['artist_name', 'total'], [['Bad Bunny', 5950000], ['SZA', 1120000], ['X', null]]), [
    'artist_name | total',
    '------------+--------',
    'Bad Bunny   | 5950000',
    'SZA         | 1120000',
    'X           |    NULL',
  ].join('\n'));
});

test('homeworkText: header, SQL, result, and the 20-row cap', () => {
  const rows = Array.from({ length: 31 }, (_, i) => [`r${i}`, i]);
  const text = X.homeworkText({
    datasetLabel: '1. Spotify Streams', exerciseLabel: '1.1',
    question: 'How many [total]\nstreams?', sql: 'SELECT a, b\nFROM t;  ', result: { ok: true, columns: ['a', 'b'], rows },
  });
  const lines = text.split('\n');
  assert.equal(lines[0], 'SQL Studio — Exercise 1.1');
  assert.equal(lines[1], 'How many \\[total\\] streams?');
  assert.equal(lines[2], 'Data set: 1. Spotify Streams');
  assert.equal(lines[4], 'SQL:');
  assert.equal(lines[5], 'SELECT a, b');
  assert.equal(lines[6], 'FROM t;');
  assert.equal(lines[8], 'Result (31 rows × 2 columns):');
  assert.ok(text.includes('(showing 20 of 31 rows)'));
  assert.ok(text.includes('r19'));
  assert.ok(!text.includes('r20 '));
  assert.ok(text.trimEnd().endsWith(X.PUBLIC_URL));
});

test('homeworkText when the query did not run or had an error or no rows', () => {
  const base = { datasetLabel: 'd', exerciseLabel: '1.2', question: 'q', sql: 'SELECT 1' };
  assert.ok(X.homeworkText({ ...base, result: null }).includes('(this query did not run)'));
  assert.ok(X.homeworkText({ ...base, result: { ok: false, error: {} } }).includes('it has an error'));
  assert.ok(X.homeworkText({ ...base, result: { ok: true, columns: ['a'], rows: [] } }).includes('(no rows)'));
});

test('homeworkFilename', () => {
  assert.equal(X.homeworkFilename('1.3'), 'sql-studio-1.3.txt');
  assert.equal(X.homeworkFilename('my question?'), 'sql-studio-my-question-.txt');
});

test('CSV starts with a UTF-8 byte order mark so Excel shows accents correctly', () => {
  const csv = X.toCSV({ columns: ['song_title'], rows: [['Tití Me Preguntó']] });
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.equal(csv.slice(1), 'song_title\r\nTití Me Preguntó\r\n');
});
