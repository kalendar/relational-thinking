const test = require('node:test');
const assert = require('node:assert/strict');
const RB = require('../src/rebuild.js');
const D = require('../src/db.js');
const S = require('../src/schema.js');
const { getSQL, attempt, one } = require('./helpers.js');
const F = require('./fixtures.js');

const ddl = (g, name) => one(g.db, `SELECT sql FROM sqlite_master WHERE name = '${name}'`);
const nocase = t => RB.applyOption(t, { id: 'nocase', change: x => { S.findColumn(x, 'email').collate = 'NOCASE'; return x; } });

test('a rebuild that adds COLLATE NOCASE keeps every row, and the new rule works', async () => {
  const g = D.openLevel(await getSQL(), F.level);
  const before = D.tableRows(g, 'Student');
  const r = RB.rebuildTable(g, nocase(F.student));
  assert.equal(r.ok, true);
  assert.deepEqual(D.tableRows(g, 'Student').map(x => x.email), before.map(x => x.email));
  assert.equal(attempt(g.db, "INSERT INTO Student (student_id, first_name, email) VALUES (5, 'J', 'JLEE@marshall.edu')"), 'UNIQUE constraint failed: Student.email');
  assert.equal(attempt(g.db, "INSERT INTO Ticket VALUES (9, 99, 1, 10, '2026-11-10')"), 'FOREIGN KEY constraint failed', 'children still enforce their FKs');
  assert.equal(attempt(g.db, 'DELETE FROM Student WHERE student_id = 1'), 'FOREIGN KEY constraint failed', 'and RESTRICT still protects the rebuilt parent');
  assert.equal(one(g.db, 'PRAGMA foreign_keys'), 1);
});

test('a rebuild over data that already breaks the new rule changes nothing (Review Focus 6)', async () => {
  const g = D.openLevel(await getSQL(), F.level);
  g.db.run("INSERT INTO Student (student_id, first_name, email) VALUES (3, 'Taylor', 'JLee@Marshall.edu')");
  const rows = D.tableRows(g, 'Student');
  const sql = ddl(g, 'Student');
  const r = RB.rebuildTable(g, nocase(F.student));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'rows');
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].row.student_id, 3);
  assert.equal(r.problems[0].explained.kind, 'unique');
  assert.equal(r.problems[0].explained.chips.table, 'Student');
  assert.match(r.problems[0].explained.headline, /^Another student already has the email `JLee@Marshall.edu`/);
  assert.deepEqual(D.tableRows(g, 'Student'), rows);
  assert.equal(ddl(g, 'Student'), sql);
  assert.equal(g.tables.find(t => t.name === 'Student').columns[3].collate, undefined);
  assert.equal(one(g.db, 'PRAGMA foreign_keys'), 1);
  assert.equal(one(g.db, "SELECT COUNT(*) FROM sqlite_master WHERE name LIKE 'cg_new_%'"), 0);
});

test('adding REFERENCES over an orphan reports the orphan and leaves the table unchanged', async () => {
  const g = D.openLevel(await getSQL(), F.level, { variant: 'nofk' });
  g.db.run("INSERT INTO Ticket VALUES (9, 99999, 1, 10, '2026-11-10')");
  const sql = ddl(g, 'Ticket');
  const r = RB.rebuildTable(g, F.ticket);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'orphans');
  assert.equal(r.problems[0].row.ticket_id, 9);
  assert.equal(r.problems[0].explained.headline, "This ticket points to student 99999, which doesn't exist. Fix or delete it first.");
  assert.equal(ddl(g, 'Ticket'), sql);
  assert.equal(D.countRows(g).Ticket, 3);
  assert.equal(one(g.db, 'PRAGMA foreign_keys'), 1);
  g.db.run('DELETE FROM Ticket WHERE ticket_id = 9');
  assert.equal(RB.rebuildTable(g, F.ticket).ok, true);
  assert.equal(attempt(g.db, "INSERT INTO Ticket VALUES (9, 99999, 1, 10, '2026-11-10')"), 'FOREIGN KEY constraint failed');
});

test('a fix option that changes columns throws, and foreign keys stay on after a failure inside the rebuild', async () => {
  assert.throws(() => RB.applyOption(F.student, { id: 'bad', change: t => Object.assign(t, { columns: t.columns.slice(1) }) }), /may only change rules/);
  const g = D.openLevel(await getSQL(), F.level);
  const broken = RB.cloneTable(F.student);
  broken.columns[1].check = { expr: 'no_such_column > 1' };
  assert.throws(() => RB.rebuildTable(g, broken));
  assert.equal(one(g.db, 'PRAGMA foreign_keys'), 1);
  assert.equal(D.countRows(g).Student, 2);
});

test('checkExpression and buildExpression', async () => {
  const g = D.openLevel(await getSQL(), F.level);
  assert.deepEqual(RB.checkExpression(g, 'price_paid > 0', F.ticket), { ok: true, expr: 'price_paid > 0' });
  assert.equal(RB.checkExpression(g, "lower(purchase_date) LIKE '2026-%' AND price_paid BETWEEN 1 AND 500", F.ticket).ok, true);
  assert.equal(RB.checkExpression(g, '1); DROP TABLE Ticket; --', F.ticket).ok, false);
  assert.equal(RB.checkExpression(g, '(SELECT 1)', F.ticket).ok, false);
  assert.match(RB.checkExpression(g, 'cost > 0', F.ticket).message, /no column called `cost`/);
  assert.equal(RB.checkExpression(g, 'price_paid >', F.ticket).ok, false);
  assert.deepEqual(RB.buildExpression(F.ticket, { column: 'price_paid', op: '>', value: '0' }), { ok: true, expr: 'price_paid > 0.00' });
  assert.deepEqual(RB.buildExpression(F.student, { column: 'email', op: 'LIKE', value: '_%@_%._%' }), { ok: true, expr: "email LIKE '_%@_%._%'" });
  assert.deepEqual(RB.buildExpression(F.ticket, { column: 'price_paid', op: 'BETWEEN', value: '1', value2: '500' }), { ok: true, expr: 'price_paid BETWEEN 1.00 AND 500.00' });
  assert.equal(RB.buildExpression(F.ticket, { column: 'price_paid', op: '>', value: 'abc' }).ok, false);
});

test('fixTest: right passes, too loose and too strict fail on named rows, and replay keeps context', async () => {
  const SQL = await getSQL();
  const level = Object.assign(F.clone(F.level), {
    rules: [{ id: 'one-person', table: 'Student', text: 'one person per email',
      check: (row, ctx) => !ctx.query('SELECT rowid AS _rowid FROM Student WHERE lower(email) = lower(?)', [row.email]).some(r => r._rowid !== ctx.self) }],
    legitRows: [{ table: 'Student', note: 'a new student', row: { student_id: 10, first_name: 'Chris', email: 'chris@x.edu', is_active: true } }],
    badRows: [{ table: 'Student', note: 'Jordan in capitals', row: { student_id: 11, first_name: 'J', email: 'JLEE@MARSHALL.EDU', is_active: true } }],
  });
  level.tables = [F.student, F.concert, F.ticket];
  const tablesWith = s => [s, F.concert, F.ticket];
  const right = RB.fixTest(SQL, level, tablesWith(nocase(F.student)), 'Student');
  assert.equal(right.passed, true, JSON.stringify(right.rows));
  const loose = RB.fixTest(SQL, level, tablesWith(F.student), 'Student');
  assert.equal(loose.passed, false);
  assert.deepEqual(loose.rows.filter(r => !r.ok).map(r => [r.label, r.verdict]), [['Jordan in capitals', 'bad row still gets in (too loose)']]);
  const strict = RB.applyOption(F.student, { id: 'strict', change: t => { S.findColumn(t, 'email').check = { expr: "email LIKE '%@marshall.edu'" }; S.findColumn(t, 'email').collate = 'NOCASE'; return t; } });
  const s = RB.fixTest(SQL, level, tablesWith(strict), 'Student');
  assert.deepEqual(s.rows.filter(r => !r.ok).map(r => r.verdict), ['real row now blocked (too strict)']);
  // Replay: a student added earlier keeps a later ticket legit; a slipped duplicate is now blocked.
  const log = [
    { kind: 'insert', table: 'Student', outcome: 'accepted', sql: "INSERT INTO Student (student_id, first_name, email) VALUES (5, 'Sam', 'sam@x.edu')" },
    { kind: 'insert', table: 'Ticket', outcome: 'accepted', sql: "INSERT INTO Ticket VALUES (5, 5, 1, 10, '2026-11-10')" },
    { kind: 'insert', table: 'Student', outcome: 'slipped', sql: "INSERT INTO Student (student_id, first_name, email) VALUES (6, 'Sam', 'SAM@x.edu')" },
  ];
  const r = RB.fixTest(SQL, level, tablesWith(nocase(F.student)), 'Student', log);
  assert.equal(r.passed, true, JSON.stringify(r.rows));
  assert.deepEqual(r.rows.filter(x => x.source === 'yours').map(x => x.verdict), ['real row still allowed', 'bad row now blocked']);
});
