// Constraint Gauntlet: Level 6, Ghost Ticket (11.2, foreign keys).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const student = { name: 'Student', columns: [
    { name: 'student_id', type: 'int', pk: true },
    { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'last_name', type: 'varchar', size: 50, notNull: true },
  ] };
  const concert = { name: 'Concert', columns: [
    { name: 'concert_id', type: 'int', pk: true },
    { name: 'artist', type: 'varchar', size: 100, notNull: true },
  ] };
  const ticketCols = withFk => [
    { name: 'ticket_id', type: 'int', pk: true },
    Object.assign({ name: 'student_id', type: 'int', notNull: true }, withFk ? { fk: { table: 'Student', column: 'student_id', onDelete: 'RESTRICT' } } : {}),
    Object.assign({ name: 'concert_id', type: 'int', notNull: true }, withFk ? { fk: { table: 'Concert', column: 'concert_id', onDelete: 'RESTRICT' } } : {}),
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true },
    { name: 'purchase_date', type: 'date', notNull: true },
  ];
  const ticket = { name: 'Ticket', columns: ticketCols(true) };
  const ticketNoFk = { name: 'Ticket', columns: ticketCols(false) };
  const tk = (id, sid, cid, price) => ({ ticket_id: id, student_id: sid, concert_id: cid, price_paid: price, purchase_date: '2026-11-01' });
  const exists = (ctx, table, col, v) => ctx.query(`SELECT 1 AS x FROM ${table} WHERE ${col} = ?`, [v]).length > 0;

  const level = {
    id: 6, title: 'Ghost Ticket', section: '11.2',
    mission: 'Every ticket should belong to a real student. Right now, nothing makes sure of that.',
    tables: [student, concert, ticket],
    variants: { nofk: { tables: [student, concert, ticketNoFk], label: 'No foreign keys yet' } },
    startVariant: 'nofk',
    seed: {
      Student: [{ student_id: 1, first_name: 'Maya', last_name: 'Patel' }, { student_id: 2, first_name: 'Jordan', last_name: 'Lee' }, { student_id: 3, first_name: 'Taylor', last_name: 'Brooks' }],
      Concert: [{ concert_id: 1, artist: 'Zach Bryan' }, { concert_id: 2, artist: 'Noah Kahan' }, { concert_id: 3, artist: 'Morgan Wallen' }],
      Ticket: [tk(1, 1, 1, 89.5), tk(2, 2, 1, 89.5), tk(3, 2, 2, 62), tk(4, 3, 3, 120)],
    },
    reports: [
      { id: 'join', title: 'Tickets by student (a JOIN)', sql: 'SELECT COUNT(*) AS tickets FROM Ticket JOIN Student ON Student.student_id = Ticket.student_id' },
      { id: 'all', title: 'Tickets in the table', sql: 'SELECT COUNT(*) AS tickets FROM Ticket' },
    ],
    rules: [
      { id: 'has-student', table: 'Ticket', text: 'every ticket belongs to a real student', check: (r, ctx) => exists(ctx, 'Student', 'student_id', r.student_id) },
      { id: 'has-concert', table: 'Ticket', text: 'every ticket is for a real concert', check: (r, ctx) => exists(ctx, 'Concert', 'concert_id', r.concert_id) },
    ],
    legitRows: [{ table: 'Ticket', note: 'A ticket for Jordan to see Zach Bryan', row: tk(10, 2, 1, 89.5) }],
    badRows: [
      { table: 'Ticket', note: 'A ticket for student 99999, who doesn’t exist', row: tk(11, 99999, 1, 89.5) },
      { table: 'Ticket', note: 'A ticket for concert 42, which doesn’t exist', row: tk(12, 1, 42, 50) },
    ],
    readError: { question: 'Read your last foreign key error.' },
    goals: [
      { id: 'ghost', text: 'Buy a ticket for a student who doesn’t exist', kind: 'slipped', rule: 'has-student' },
      { id: 'fix', text: 'Choose the rule that keeps tickets pointing at real students', kind: 'fixed', table: 'Ticket' },
      { id: 'applied', text: 'Add the rule to your table (clean up the ghost first)', kind: 'flag', flag: 'applied:Ticket' },
      { id: 'insert', text: 'Get a foreign key error on an INSERT', kind: 'rejected-by', errorKind: 'fk-parent', attemptKind: 'insert' },
      { id: 'update', text: 'Get a foreign key error on an UPDATE', kind: 'rejected-by', errorKind: 'fk-parent', attemptKind: 'update' },
      { id: 'read', text: 'Read the error: which table, which column, which value?', kind: 'flag', flag: 'readError' },
    ],
    fix: { table: 'Ticket', base: 'nofk', unlock: 'slipped', options: [
      { id: 'nn', label: 'student_id INT NOT NULL', correct: false,
        why: 'It’s already NOT NULL. That only stops blanks. It doesn’t check that the student exists.',
        change: t => t },
      { id: 'unique', label: 'UNIQUE (student_id)', correct: false,
        why: 'That means a student can only ever buy one ticket. Jordan already has two.',
        change: t => Object.assign(t, { constraints: [{ kind: 'unique', columns: ['student_id'] }] }) },
      { id: 'fk', label: 'student_id REFERENCES Student(student_id), concert_id REFERENCES Concert(concert_id)', correct: true,
        why: 'A foreign key makes the database check that the student and the concert really exist.',
        change: t => {
          t.columns.find(c => c.name === 'student_id').fk = { table: 'Student', column: 'student_id', onDelete: 'RESTRICT' };
          t.columns.find(c => c.name === 'concert_id').fk = { table: 'Concert', column: 'concert_id', onDelete: 'RESTRICT' };
          return t;
        } },
    ] },
    sqlStart: "-- Buy a ticket for student 99999. Nobody has that ID.\nINSERT INTO Ticket VALUES (5, 99999, 1, 89.50, '2026-11-10');",
    done: 'A foreign key is a promise that every ticket points to a real student. The database keeps the promise for you.',
    solution: [
      { sql: "INSERT INTO Ticket VALUES (5, 99999, 1, 89.50, '2026-11-10')", expect: 'slipped' },
      { tryFix: { optionId: 'unique' }, expect: 'failed' },
      { tryFix: { optionId: 'fk' }, expect: 'passed' },
      { applyFix: { optionId: 'fk' }, cleanup: 'delete', expect: 'orphans-then-ok' },
      { sql: "INSERT INTO Ticket VALUES (5, 99999, 1, 89.50, '2026-11-10')", expect: 'rejected' },
      { sql: 'UPDATE Ticket SET student_id = 42 WHERE ticket_id = 1', expect: 'rejected' },
      { flag: 'readError' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
