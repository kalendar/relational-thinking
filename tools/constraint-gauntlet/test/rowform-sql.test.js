const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/rowform-sql.js');
const D = require('../src/db.js');
const { getSQL } = require('./helpers.js');
const F = require('./fixtures.js');

test('parseForm: blanks are NULL, types are checked, text is kept as typed', () => {
  const ok = R.parseForm(F.student, { student_id: '3', first_name: "O'Brien", last_name: '  ', email: 'o@x.edu', is_active: 'true' });
  assert.deepEqual(ok, { ok: true, row: { student_id: 3, first_name: "O'Brien", last_name: null, email: 'o@x.edu', is_active: true } });
  const bad = R.parseForm(F.ticket, { ticket_id: '3', student_id: 'x', concert_id: '1', price_paid: '12abc', purchase_date: '11/10/2026' });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.problems).sort(), ['price_paid', 'purchase_date', 'student_id']);
  assert.match(bad.problems.price_paid, /needs a number/);
  assert.equal(R.parseForm(F.ticket, { ticket_id: '1', student_id: '1', concert_id: '1', price_paid: '1', purchase_date: '2026-02-30' }).ok, true);
});

test('literals and the generated SQL', () => {
  const row = { ticket_id: 6, student_id: 2, concert_id: 1, price_paid: 45, purchase_date: '2026-11-10' };
  assert.equal(R.insertSql(F.ticket, row),
    "INSERT INTO Ticket (ticket_id, student_id, concert_id, price_paid, purchase_date)\nVALUES (6, 2, 1, 45.00, '2026-11-10');");
  assert.equal(R.insertSql(F.concert, { concert_id: 3, artist: "Guns N' Roses" }), "INSERT INTO Concert (concert_id, artist) VALUES (3, 'Guns N'' Roses');");
  assert.equal(R.literal(F.student.columns[4], false), 'false');
  assert.equal(R.literal(F.student.columns[2], null), 'NULL');
  const key = { student_id: 2, first_name: 'Jordan', last_name: 'Lee', email: 'jlee@marshall.edu', is_active: true };
  assert.equal(R.updateSql(F.student, key, key), null, 'nothing changed');
  assert.equal(R.updateSql(F.student, Object.assign({}, key, { is_active: false }), key), 'UPDATE Student SET is_active = false WHERE student_id = 2;');
  assert.equal(R.updateSql(F.student, Object.assign({}, key, { student_id: 7 }), key), 'UPDATE Student SET student_id = 7 WHERE student_id = 2;');
  assert.equal(R.deleteSql(F.student, key), 'DELETE FROM Student WHERE student_id = 2;');
});

test('every generated statement runs in sql.js, and nextId follows the data', async () => {
  const g = D.openLevel(await getSQL(), F.level);
  assert.equal(R.nextId(g, 'Student'), 3);
  const s = { student_id: 3, first_name: "O'Brien", last_name: null, email: 'ob@x.edu', is_active: false };
  g.db.run(R.insertSql(F.student, s));
  assert.equal(R.nextId(g, 'Student'), 4);
  g.db.run(R.updateSql(F.student, Object.assign({}, s, { is_active: true, last_name: 'Kim' }), s));
  g.db.run(R.insertSql(F.ticket, { ticket_id: 3, student_id: 3, concert_id: 1, price_paid: 45, purchase_date: '2026-11-10' }));
  g.db.run(R.deleteSql(F.ticket, { ticket_id: 3 }));
  const row = D.tableRows(g, 'Student').find(r => r.student_id === 3);
  assert.equal(row.is_active, true);
  assert.equal(row.last_name, 'Kim');
  D.closeLevel(g);
});
