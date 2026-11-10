const test = require('node:test');
const assert = require('node:assert/strict');
const { classify } = require('../src/statement.js');
const N = ['Student', 'Ticket'];

test('allowed statements and their target tables', () => {
  assert.deepEqual(classify("INSERT INTO Student VALUES (1, 'a')", N), { ok: true, kind: 'insert', table: 'Student' });
  assert.deepEqual(classify("update ticket set price_paid = 5 where ticket_id = 1;", N), { ok: true, kind: 'update', table: 'Ticket' });
  assert.deepEqual(classify('-- remove one\nDELETE FROM "Student" WHERE student_id = 1', N), { ok: true, kind: 'delete', table: 'Student' });
  assert.deepEqual(classify('SELECT * FROM Student', N), { ok: true, kind: 'select', table: null });
  assert.deepEqual(classify('WITH x AS (SELECT 1) SELECT * FROM x', N), { ok: true, kind: 'select', table: null });
  assert.deepEqual(classify('INSERT INTO main.Student VALUES (1)', N), { ok: true, kind: 'insert', table: 'Student' });
});

test('conflict clauses are blocked (Review Focus 2)', () => {
  for (const s of ["insert or replace into Student values (1,'a')", "REPLACE INTO Student VALUES (1)", "INSERT OR IGNORE INTO Student VALUES (1)",
    "UPDATE OR IGNORE Student SET email = 'x'", "INSERT INTO Student (email) VALUES ('x') ON CONFLICT(email) DO NOTHING"]) {
    assert.equal(classify(s, N).reason, 'conflict', s);
  }
  assert.equal(classify("INSERT INTO Student (note) VALUES ('ON CONFLICT is just text here')", N).ok, true, 'inside a string is fine');
});

test('other refusals', () => {
  assert.equal(classify('', N).reason, 'empty');
  assert.equal(classify('-- just a comment', N).reason, 'empty');
  assert.equal(classify('SELECT 1; SELECT 2', N).reason, 'many');
  assert.equal(classify('SELECT 1;', N).ok, true, 'a trailing semicolon is one statement');
  assert.equal(classify('INSERT INTO Venue VALUES (1)', N).reason, 'table');
  assert.match(classify('INSERT INTO Venue VALUES (1)', N).message, /Student and Ticket/);
  assert.equal(classify('INSERT INTO temp.Student VALUES (1)', N).reason, 'table');
  assert.equal(classify('SELECT * FROM sqlite_master', N).reason, 'internal');
  assert.equal(classify('BEGIN', N).reason, 'transaction');
  assert.equal(classify('rollback', N).reason, 'transaction');
  assert.equal(classify('DROP TABLE Student', N).reason, 'rules');
  assert.equal(classify('PRAGMA foreign_keys = OFF', N).reason, 'other');
  assert.equal(classify('WITH x AS (SELECT 1) DELETE FROM Student', N).reason, 'other');
});
