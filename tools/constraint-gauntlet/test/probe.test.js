const test = require('node:test');
const assert = require('node:assert/strict');
const { probe } = require('../src/probe.js');
const { classify } = require('../src/statement.js');
const D = require('../src/db.js');
const { getSQL, attempt, one } = require('./helpers.js');
const F = require('./fixtures.js');

async function game() { return D.openLevel(await getSQL(), F.level); }
const run = (g, sql) => probe(g, sql, classify(sql, g.tables.map(t => t.name)));
const noTemp = g => g.db.exec("SELECT name FROM sqlite_temp_master").length === 0;

test('an INSERT returns the attempted row and leaves the real table alone, even when it would break UNIQUE', async () => {
  const g = await game();
  const p = run(g, "INSERT INTO Student (student_id, first_name, email) VALUES (3, 'Taylor', 'jlee@marshall.edu')");
  assert.equal(p.ok, true);
  assert.equal(p.added.length, 1);
  assert.equal(p.added[0].email, 'jlee@marshall.edu');
  assert.equal(p.added[0].is_active, true, 'the DEFAULT applies in the copy');
  assert.equal(D.countRows(g).Student, 2);
  assert.ok(noTemp(g));
});

test('an UPDATE with a qualified name returns before/after pairs', async () => {
  const g = await game();
  const p = run(g, "UPDATE Student SET email = 'z@x.edu' WHERE Student.student_id = 2");
  assert.equal(p.changed.length, 1);
  assert.equal(p.changed[0].before.email, 'jlee@marshall.edu');
  assert.equal(p.changed[0].after.email, 'z@x.edu');
  assert.equal(one(g.db, 'SELECT email FROM Student WHERE student_id = 2'), 'jlee@marshall.edu');
});

test('a DELETE returns the removed rows and removes nothing for real', async () => {
  const g = await game();
  const p = run(g, 'DELETE FROM Student WHERE student_id IN (1, 2)');
  assert.deepEqual(p.removed.map(r => r.student_id).sort(), [1, 2]);
  assert.equal(D.countRows(g).Student, 2);
});

test('INSERT … SELECT reads other tables from the real database', async () => {
  const g = await game();
  const p = run(g, "INSERT INTO Ticket SELECT 9, student_id, 1, 10, '2026-11-10' FROM Student WHERE student_id = 2");
  assert.equal(p.added.length, 1);
  assert.equal(p.added[0].student_id, 2);
});

test('a typo comes back as an error, with no temp table left and foreign keys still on', async () => {
  const g = await game();
  const p = run(g, "INSERT INTO Student (emial) VALUES ('x')");
  assert.equal(p.ok, false);
  assert.match(p.message, /no column named emial|no such column/);
  assert.ok(noTemp(g));
  assert.equal(one(g.db, 'PRAGMA foreign_keys'), 1);
  assert.equal(attempt(g.db, "INSERT INTO Ticket VALUES (9, 99, 1, 10, '2026-11-10')"), 'FOREIGN KEY constraint failed');
});
