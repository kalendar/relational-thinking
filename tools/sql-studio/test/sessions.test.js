const test = require('node:test');
const assert = require('node:assert/strict');
const Ss = require('../src/sessions.js');

const spotify = { tables: [{ name: 'Artists' }] };
const concert = { tables: [{ name: 'Venues' }] };

test('a data set starts with a starter query on its first table', () => {
  const s = Ss.createSessions();
  const st = s.enter('concert', concert);
  assert.equal(st.text, '-- Write a query, then press Run (or Ctrl+Enter).\nSELECT *\nFROM Venues;\n');
  assert.equal(st.cursor, null);
  assert.equal(st.exerciseIndex, 0);
});

test('switching away and back restores text, cursor, and exercise, and nothing else', () => {
  const s = Ss.createSessions();
  s.enter('spotify', spotify);
  s.leave('spotify', { text: 'SELECT 1', cursor: { line: 0, ch: 8 }, exerciseIndex: 3, result: { rows: [] }, error: 'x' });
  s.enter('concert', concert);
  const back = s.enter('spotify', spotify);
  assert.deepEqual(back, { text: 'SELECT 1', cursor: { line: 0, ch: 8 }, exerciseIndex: 3 });
  assert.equal('result' in back, false);
  assert.equal('error' in back, false);
});

test('forget drops the saved text', () => {
  const s = Ss.createSessions();
  s.leave('upload', { text: 'SELECT * FROM Old' });
  s.forget('upload');
  assert.match(s.enter('upload', { tables: [{ name: 'New' }] }).text, /FROM New;/);
});
