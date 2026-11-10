const test = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../src/session.js');
const { getSQL } = require('./helpers.js');
const F = require('./fixtures.js');

function level() {
  const l = Object.assign({}, F.level, {
    rules: [
      { id: 'one-person', table: 'Student', text: 'one person per email',
        check: (row, ctx) => !ctx.query('SELECT rowid AS _rowid FROM Student WHERE lower(email) = lower(?)', [row.email]).some(r => r._rowid !== ctx.self) },
      { id: 'has-student', table: 'Ticket', text: 'a ticket belongs to a real student',
        check: (row, ctx) => ctx.query('SELECT 1 AS x FROM Student WHERE student_id = ?', [row.student_id]).length > 0 },
    ],
    predict: [{ id: 'p', question: '?', choices: [{ id: 'yes' }, { id: 'no' }], answer: 'no', why: 'because' }],
    goals: [{ id: 'g', kind: 'slipped', rule: 'one-person' }],
  });
  return l;
}
async function session() { return createSession(await getSQL(), level()); }

test('each run result type, and only attempts are logged', async () => {
  const s = await session();
  assert.equal(s.run('DROP TABLE Student').type, 'blocked');
  assert.equal(s.run("INSERT INTO Student (emial) VALUES ('x')").type, 'syntax');
  assert.equal(s.run("INSERT INTO Student (emial) VALUES ('x')").explained.headline, "There's no column called `emial` in the Student table. Did you mean `email`?");
  assert.match(s.run("INSERT INTO Student VALUES (3, 'x')").explained.headline, /^The Student table has 5 columns, but you gave 2 values/);
  assert.match(s.run("INSERT INTO Student (student_id, email) VALUES (3)").explained.headline, /^You gave 1 value for 2 columns/);
  assert.match(s.run("INSERT INTO Student (student_id) VALUES (3) WHERE x").explained.headline, /WHERE|confused|near/);
  const sel = s.run('SELECT COUNT(*) AS n FROM Student');
  assert.deepEqual([sel.type, sel.rows], ['select', [{ n: 2 }]]);
  const ok = s.run("INSERT INTO Student (student_id, first_name, email) VALUES (3, 'Chris', 'chris@x.edu')");
  assert.equal(ok.attempt.outcome, 'accepted');
  const rej = s.run("INSERT INTO Student (student_id, first_name, email) VALUES (4, 'C', 'chris@x.edu')");
  assert.equal(rej.attempt.outcome, 'rejected');
  assert.equal(rej.attempt.error.kind, 'unique');
  assert.deepEqual(rej.attempt.broken, ['one-person'], 'rules are judged before the run, so a rejected attempt has them too');
  assert.equal(s.state().log.length, 2);
});

test('rules are judged before the run: the first row is fine, the second slips through', async () => {
  const s = await session();
  const a = s.run("INSERT INTO Student (student_id, first_name, email) VALUES (3, 'Sam', 'sam@x.edu')").attempt;
  const b = s.run("INSERT INTO Student (student_id, first_name, email) VALUES (4, 'Sam', 'SAM@x.edu')").attempt;
  assert.deepEqual([a.outcome, b.outcome], ['accepted', 'slipped']);
  assert.deepEqual(b.broken, ['one-person']);
  assert.equal(s.complete(), true);
  const up = s.run("UPDATE Student SET first_name = 'Jordy' WHERE student_id = 2").attempt;
  assert.equal(up.outcome, 'accepted', 'an UPDATE does not collide with its own row');
});

test('runForm: type problems are not logged; edits and deletes go through run', async () => {
  const s = await session();
  const bad = s.runForm('Ticket', 'add', { ticket_id: '3', student_id: 'x', concert_id: '1', price_paid: '1', purchase_date: '2026-11-10' });
  assert.equal(bad.type, 'form');
  assert.ok(bad.problems.student_id);
  const jordan = s.state().rows.Student.find(r => r.student_id === 2);
  assert.equal(s.runForm('Student', 'edit', { student_id: '2', first_name: 'Jordan', last_name: 'Lee', email: 'jlee@marshall.edu', is_active: 'true' }, jordan).message, 'Nothing changed. Edit a field first.');
  const del = s.runForm('Student', 'delete', null, jordan).attempt;
  assert.equal(del.outcome, 'rejected');
  assert.equal(del.error.kind, 'fk-child');
  assert.equal(del.blast.blocked, true);
  assert.equal(s.state().log.length, 1);
});

test('runAll keeps going after a bounce; switchVariant keeps the log; reset clears everything', async () => {
  const s = await session();
  const r = s.runAll("INSERT INTO Ticket VALUES (5, 99, 1, 10, '2026-11-10'); INSERT INTO Ticket VALUES (6, 1, 1, 10, '2026-11-10');");
  assert.deepEqual(r.map(x => x.attempt.outcome), ['rejected', 'accepted']);
  s.switchVariant('nofk');
  const orphan = s.run("INSERT INTO Ticket VALUES (7, 99, 1, 10, '2026-11-10')").attempt;
  assert.deepEqual([orphan.outcome, orphan.variant, orphan.broken], ['slipped', 'nofk', ['has-student']]);
  assert.equal(s.state().log.length, 3);
  assert.deepEqual(s.predict('p', 'yes'), { correct: false, answer: 'no', why: 'because' });
  s.reset();
  const st = s.state();
  assert.deepEqual([st.log.length, Object.keys(st.predictions).length, st.variant], [0, 0, null]);
});

test('a delete records its blast radius', async () => {
  const s = await session();
  const r = s.run('DELETE FROM Ticket WHERE ticket_id IN (1, 2)').attempt;
  assert.deepEqual(r.blast.removed, { Ticket: 2 });
  assert.equal(r.blast.total, 2);
});
