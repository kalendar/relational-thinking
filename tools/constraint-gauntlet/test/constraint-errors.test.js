const test = require('node:test');
const assert = require('node:assert/strict');
const { explainConstraint } = require('../src/constraint-errors.js');
const { probe } = require('../src/probe.js');
const { classify } = require('../src/statement.js');
const D = require('../src/db.js');
const { getSQL } = require('./helpers.js');

function lvl({ ticketPolicy = 'RESTRICT' } = {}) {
  return {
    id: 97,
    tables: [
      { name: 'Student', columns: [
        { name: 'student_id', type: 'int', pk: true },
        { name: 'first_name', type: 'varchar', notNull: true }, { name: 'last_name', type: 'varchar', notNull: true },
        { name: 'email', type: 'varchar', notNull: true, unique: true, collate: 'NOCASE' },
        { name: 'is_active', type: 'boolean', notNull: true, default: true }] },
      { name: 'Venue', columns: [{ name: 'venue_id', type: 'int', pk: true }, { name: 'name', type: 'varchar', notNull: true }] },
      { name: 'Concert', columns: [
        { name: 'concert_id', type: 'int', pk: true }, { name: 'venue_id', type: 'int', notNull: true },
        { name: 'concert_date', type: 'date', notNull: true }, { name: 'start_time', type: 'time' }, { name: 'end_time', type: 'time' }],
      constraints: [
        { kind: 'unique', columns: ['venue_id', 'concert_date'], text: 'One show per venue per night.',
          describe: (row, game) => { const v = D.readQuery(game, 'SELECT name FROM Venue WHERE venue_id = ?', [row.venue_id]).rows[0]; return v ? `(That's ${v.name}.)` : ''; } },
        { kind: 'check', name: 'ends_after_start', expr: 'end_time > start_time', columns: ['start_time', 'end_time'], text: 'The concert has to end after it starts.' }] },
      { name: 'Ticket', columns: [
        { name: 'ticket_id', type: 'int', pk: true },
        { name: 'student_id', type: 'int', notNull: true, fk: { table: 'Student', column: 'student_id', onDelete: ticketPolicy } },
        { name: 'concert_id', type: 'int', notNull: true, fk: { table: 'Concert', column: 'concert_id', onDelete: 'RESTRICT' } },
        { name: 'price_paid', type: 'decimal', notNull: true, check: { expr: 'price_paid >= 0', text: '`price_paid` must be 0 or more.' } },
        { name: 'note', type: 'varchar', check: { expr: "note <> 'x'" } }] },
      { name: 'Scan', columns: [{ name: 'scan_id', type: 'int', pk: true },
        { name: 'ticket_id', type: 'int', notNull: true, fk: { table: 'Ticket', column: 'ticket_id', onDelete: 'RESTRICT' } }] },
    ],
    seed: {
      Student: [{ student_id: 1, first_name: 'Maya', last_name: 'Patel', email: 'maya.patel@marshall.edu' },
        { student_id: 2, first_name: 'Jordan', last_name: 'Lee', email: 'jlee@marshall.edu' }],
      Venue: [{ venue_id: 3, name: 'Keith-Albee' }],
      Concert: [{ concert_id: 1, venue_id: 3, concert_date: '2027-02-14', start_time: '19:00', end_time: '22:00' }],
      Ticket: [{ ticket_id: 1, student_id: 2, concert_id: 1, price_paid: 10 }, { ticket_id: 2, student_id: 2, concert_id: 1, price_paid: 10 },
        { ticket_id: 3, student_id: 2, concert_id: 1, price_paid: 10 }],
      Scan: [{ scan_id: 1, ticket_id: 1 }, { scan_id: 2, ticket_id: 1 }],
    },
  };
}

// Runs the statement for real and explains the real error (never a hand-typed message).
async function why(sql, opts) {
  const g = D.openLevel(await getSQL(), lvl(opts));
  const cls = classify(sql, g.tables.map(t => t.name));
  const p = probe(g, sql, cls);
  try { g.db.run(sql); } catch (e) { return explainConstraint(g, { kind: cls.kind, table: cls.table, probe: p }, e.message); }
  throw new Error(`expected an error from: ${sql}`);
}

test('NOT NULL', async () => {
  const e = await why("INSERT INTO Student (student_id, first_name, email) VALUES (3, 'Sam', 'sam@x.edu')");
  assert.equal(e.kind, 'notnull');
  assert.equal(e.headline, 'Every student needs a `last_name`. You left it blank.');
  assert.deepEqual(e.chips, { table: 'Student', rule: 'NOT NULL', value: 'NULL' });
  assert.deepEqual(e.columns, ['last_name']);
});

test('UNIQUE with NOCASE says how the existing value is saved', async () => {
  const e = await why("INSERT INTO Student (student_id, first_name, last_name, email) VALUES (3, 'J', 'Lee', 'JLee@Marshall.edu')");
  assert.equal(e.kind, 'unique');
  assert.match(e.headline, /^Another student already has the email `JLee@Marshall.edu`\. Each email can belong to only one student\. \(It's saved as `jlee@marshall.edu`\.\)$/);
  assert.deepEqual(e.chips, { table: 'Student', rule: 'UNIQUE (email) COLLATE NOCASE', value: 'JLee@Marshall.edu' });
});

test('composite UNIQUE uses the constraint text and describe()', async () => {
  const e = await why("INSERT INTO Concert VALUES (2, 3, '2027-02-14', '20:00', '23:00')");
  assert.equal(e.headline, "One show per venue per night. There's already a concert with venue_id 3 and concert_date 2027-02-14. (That's Keith-Albee.)");
  assert.equal(e.chips.rule, 'UNIQUE (venue_id, concert_date)');
});

test('a duplicate primary key suggests the next free ID', async () => {
  const e = await why("INSERT INTO Ticket VALUES (1, 1, 1, 5, NULL)");
  assert.equal(e.kind, 'pk');
  assert.equal(e.headline, "There's already a ticket with `ticket_id` 1. Each ticket needs its own ID. Try 4.");
});

test('column CHECK, named table CHECK, and an unexplained CHECK', async () => {
  let e = await why('INSERT INTO Ticket VALUES (9, 1, 1, -5, NULL)');
  assert.equal(e.headline, '`price_paid` must be 0 or more. You entered `-5.00`.');
  assert.equal(e.chips.rule, 'CHECK (price_paid >= 0)');
  e = await why("INSERT INTO Concert VALUES (3, 3, '2027-02-15', '19:00', '18:00')");
  assert.equal(e.headline, 'The concert has to end after it starts. You entered start_time `19:00` and end_time `18:00`.');
  assert.equal(e.chips.rule, 'CHECK ends_after_start (end_time > start_time)');
  e = await why("INSERT INTO Ticket VALUES (9, 1, 1, 5, 'x')");
  assert.equal(e.headline, "This row breaks the rule `note <> 'x'`. You entered `x`.");
});

test("the hidden type check: 'free' in a number column", async () => {
  const e = await why("INSERT INTO Ticket VALUES (9, 1, 1, 'free', NULL)");
  assert.equal(e.kind, 'type');
  assert.equal(e.headline, "`price_paid` needs a number. `free` won't work.");
});

test('FK: one missing parent, and two in one insert', async () => {
  let e = await why('INSERT INTO Ticket VALUES (9, 99999, 1, 5, NULL)');
  assert.equal(e.kind, 'fk-parent');
  assert.equal(e.headline, "There's no student with `student_id` 99999. Add the student first, or check the ID.");
  assert.deepEqual(e.chips, { table: 'Ticket', rule: 'REFERENCES Student(student_id)', value: '99999' });
  e = await why('INSERT INTO Ticket VALUES (9, 99999, 42, 5, NULL)');
  assert.match(e.headline, /no student with `student_id` 99999.*no concert with `concert_id` 42/);
  assert.deepEqual(e.columns, ['student_id', 'concert_id']);
  e = await why('UPDATE Ticket SET student_id = 42 WHERE ticket_id = 1');
  assert.equal(e.kind, 'fk-parent');
});

test('FK: delete blocked by a direct child, and by a grandchild through CASCADE', async () => {
  let e = await why('DELETE FROM Student WHERE student_id = 2');
  assert.equal(e.kind, 'fk-child');
  assert.equal(e.headline, 'Student 2 (Jordan Lee) still has 3 tickets. The rule `ON DELETE RESTRICT` on Ticket.student_id blocks the delete. Delete or move those tickets first, or mark it inactive instead.');
  assert.deepEqual(e.chips, { table: 'Ticket', rule: 'ON DELETE RESTRICT', value: '2' });
  e = await why('DELETE FROM Student WHERE student_id = 2', { ticketPolicy: 'CASCADE' });
  assert.equal(e.headline, 'Deleting Student 2 (Jordan Lee) would also delete its tickets (ON DELETE CASCADE). But ticket 1 still has 2 scans, and the rule `ON DELETE RESTRICT` on Scan.ticket_id blocks that.');
});

test('FK: changing a parent key that children point to', async () => {
  const e = await why('UPDATE Student SET student_id = 7 WHERE student_id = 2');
  assert.equal(e.kind, 'fk-child');
  assert.equal(e.headline, '3 tickets still point to student 2. Changing its `student_id` would leave them pointing at nothing.');
});

test('SET NULL on a column that can’t be blank', async () => {
  const e = await why('DELETE FROM Student WHERE student_id = 2', { ticketPolicy: 'SET NULL' });
  assert.equal(e.kind, 'notnull');
  assert.match(e.headline, /^Deleting this student would make `Ticket.student_id` blank \(ON DELETE SET NULL\), but that column can't be blank\./);
});
