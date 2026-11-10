const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/blast.js');
const D = require('../src/db.js');
const { probe } = require('../src/probe.js');
const { classify } = require('../src/statement.js');
const { getSQL, attempt } = require('./helpers.js');

// The Level 8 shape: Student <- Ticket <- Scan. Jordan (2) has 3 tickets with 2 scans each.
function level8(ticketPolicy, scanPolicy, { ticketNotNull = false } = {}) {
  return {
    id: 98, tables: [
      { name: 'Student', columns: [{ name: 'student_id', type: 'int', pk: true }, { name: 'first_name', type: 'varchar' }] },
      { name: 'Ticket', columns: [{ name: 'ticket_id', type: 'int', pk: true },
        { name: 'student_id', type: 'int', notNull: ticketNotNull, fk: { table: 'Student', column: 'student_id', onDelete: ticketPolicy } }] },
      { name: 'Scan', columns: [{ name: 'scan_id', type: 'int', pk: true },
        { name: 'ticket_id', type: 'int', notNull: true, fk: { table: 'Ticket', column: 'ticket_id', onDelete: scanPolicy } }] },
    ],
    seed: {
      Student: [{ student_id: 1, first_name: 'Maya' }, { student_id: 2, first_name: 'Jordan' }, { student_id: 3, first_name: 'Taylor' }],
      Ticket: [{ ticket_id: 1, student_id: 2 }, { ticket_id: 2, student_id: 2 }, { ticket_id: 3, student_id: 2 }, { ticket_id: 4, student_id: 1 }, { ticket_id: 5, student_id: 3 }],
      Scan: [1, 2, 3, 4, 5, 6].map(i => ({ scan_id: i, ticket_id: Math.ceil(i / 2) })).concat([{ scan_id: 7, ticket_id: 4 }]),
    },
  };
}

test('the simulation agrees with SQLite for every Level 8 policy combination (Review Focus 5)', async () => {
  const SQL = await getSQL();
  const sql = 'DELETE FROM Student WHERE student_id = 2';
  for (const tp of ['RESTRICT', 'CASCADE', 'SET NULL']) {
    for (const sp of ['RESTRICT', 'CASCADE']) {
      const g = D.openLevel(SQL, level8(tp, sp));
      const p = probe(g, sql, classify(sql, ['Student', 'Ticket', 'Scan']));
      const sim = B.simulateDelete(g, 'Student', p.removed);
      const before = B.snapshotCounts(g);
      const real = attempt(g.db, sql);
      const label = `${tp} / ${sp}`;
      if (sim.blocked) {
        assert.notEqual(real, 'OK', `${label}: simulated blocked, SQLite allowed it`);
        assert.deepEqual(B.snapshotCounts(g), before, `${label}: a blocked delete changes nothing`);
      } else {
        assert.equal(real, 'OK', `${label}: simulated allowed, SQLite said ${real}`);
        const blast = B.blastBetween(before, B.snapshotCounts(g));
        assert.deepEqual(blast.removed, sim.removed, `${label}: removed`);
        assert.deepEqual(blast.nulled, sim.nulled, `${label}: nulled`);
      }
      D.closeLevel(g);
    }
  }
});

test('CASCADE all the way removes 1 + 3 + 6 = 10 rows; CASCADE then RESTRICT is blocked by the scans', async () => {
  const SQL = await getSQL();
  let g = D.openLevel(SQL, level8('CASCADE', 'CASCADE'));
  const jordan = D.tableRows(g, 'Student').filter(r => r.student_id === 2);
  const sim = B.simulateDelete(g, 'Student', jordan);
  assert.deepEqual(sim.removed, { Student: 1, Ticket: 3, Scan: 6 });
  g = D.openLevel(SQL, level8('CASCADE', 'RESTRICT'));
  const b = B.simulateDelete(g, 'Student', jordan).blocked;
  assert.equal(b.kind, 'restrict');
  assert.equal(b.parentTable, 'Ticket');
  assert.equal(b.child, 'Scan');
  assert.equal(b.count, 2);
});

test('SET NULL on a column that can’t be blank is reported as a NOT NULL block', async () => {
  const g = D.openLevel(await getSQL(), level8('SET NULL', 'RESTRICT', { ticketNotNull: true }));
  const b = B.simulateDelete(g, 'Student', D.tableRows(g, 'Student').filter(r => r.student_id === 2)).blocked;
  assert.equal(b.kind, 'notnull');
  assert.equal(attempt(g.db, 'DELETE FROM Student WHERE student_id = 2'), 'NOT NULL constraint failed: Ticket.student_id');
});

test('deleting two parents counts both, and SET NULL lines are counted', async () => {
  const g = D.openLevel(await getSQL(), level8('SET NULL', 'CASCADE'));
  const sim = B.simulateDelete(g, 'Student', D.tableRows(g, 'Student').filter(r => r.student_id !== 2));
  assert.deepEqual(sim.removed, { Student: 2 });
  assert.deepEqual(sim.nulled, { 'Ticket.student_id': 2 });
});
