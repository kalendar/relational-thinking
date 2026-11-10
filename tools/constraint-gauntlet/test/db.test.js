const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/db.js');
const { getSQL, attempt } = require('./helpers.js');
const F = require('./fixtures.js');

async function game(opts) { return D.openLevel(await getSQL(), F.level, opts); }

test('foreign keys are on after opening, and actually enforced', async () => {
  const g = await game();
  assert.equal(D.fkOn(g.db), true);
  assert.equal(attempt(g.db, "INSERT INTO Ticket VALUES (9, 99, 1, 10, '2026-11-10')"), 'FOREIGN KEY constraint failed');
  assert.equal(attempt(g.db, 'DELETE FROM Student WHERE student_id = 1'), 'FOREIGN KEY constraint failed');
  D.closeLevel(g);
});

test('seed rows load, booleans come back as booleans, rowids are numbers', async () => {
  const g = await game();
  const rows = D.tableRows(g, 'Student');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].is_active, true, 'missing seed value takes the default');
  assert.equal(typeof rows[0]._rowid, 'number');
  assert.deepEqual(D.countRows(g), { Student: 2, Concert: 2, Ticket: 2 });
  assert.deepEqual(D.readQuery(g, 'SELECT artist FROM Concert WHERE concert_id = ?', [2]).rows, [{ artist: 'Noah Kahan' }]);
  D.closeLevel(g);
});

test('a seed row that breaks a rule throws with the level id', async () => {
  const SQL = await getSQL();
  const bad = Object.assign(F.clone(F.level), { seed: { Student: [{ student_id: 1, first_name: null, email: 'x@y.edu' }] } });
  assert.throws(() => D.openLevel(SQL, bad), /Level 99: a seed row for Student breaks a rule/);
});

test('a variant opens its own tables', async () => {
  const g = await game({ variant: 'nofk' });
  assert.equal(g.variant, 'nofk');
  assert.equal(attempt(g.db, "INSERT INTO Ticket VALUES (9, 99, 1, 10, '2026-11-10')"), 'OK');
  D.closeLevel(g);
});
