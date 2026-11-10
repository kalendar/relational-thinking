// Constraint Gauntlet: Level 5, Price and Quantity Rules (11.1, CHECK).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const SECTIONS = ['Floor', 'Lower', 'Upper', 'Lawn'];
  const ticket = { name: 'Ticket', columns: [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', notNull: true },
    { name: 'concert_id', type: 'int', notNull: true },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true, check: { expr: 'price_paid >= 0', text: '`price_paid` must be 0 or more.' } },
    { name: 'quantity', type: 'int', notNull: true, check: { expr: 'quantity BETWEEN 1 AND 10', text: 'One purchase can be 1 to 10 tickets.' } },
    { name: 'seat_section', type: 'varchar', size: 10, notNull: true,
      check: { expr: "seat_section IN ('Floor','Lower','Upper','Lawn')", text: 'The section must be Floor, Lower, Upper, or Lawn.' } },
    { name: 'purchase_date', type: 'date', notNull: true },
  ] };
  const concert = { name: 'Concert', columns: [
    { name: 'concert_id', type: 'int', pk: true },
    { name: 'artist', type: 'varchar', size: 100, notNull: true },
    { name: 'concert_date', type: 'date', notNull: true },
    { name: 'start_time', type: 'time', notNull: true },
    { name: 'end_time', type: 'time', notNull: true },
  ], constraints: [{ kind: 'check', name: 'ends_after_start', expr: 'end_time > start_time', columns: ['start_time', 'end_time'], text: 'The concert has to end after it starts.' }] };
  const student = { name: 'Student', columns: [
    { name: 'student_id', type: 'int', pk: true },
    { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'email', type: 'varchar', size: 255, notNull: true, unique: true, check: { expr: "email LIKE '%@%'", text: 'An email needs an @.' } },
  ] };
  const tk = (id, price, qty = 2, section = 'Floor') => ({ ticket_id: id, student_id: 1, concert_id: 1, price_paid: price, quantity: qty, seat_section: section, purchase_date: '2026-11-10' });

  const level = {
    id: 5, title: 'Price and Quantity Rules', section: '11.1',
    mission: 'CHECK rules test every row. Trip each one, then find the rows they still let through.',
    tables: [ticket, concert, student],
    seed: {
      Ticket: [tk(1, 89.5), tk(2, 62, 4, 'Upper'), tk(3, 120, 1, 'Lower')],
      Concert: [{ concert_id: 1, artist: 'Zach Bryan', concert_date: '2027-02-14', start_time: '19:00', end_time: '22:30' }],
      Student: [{ student_id: 1, first_name: 'Maya', email: 'maya.patel@marshall.edu' }, { student_id: 2, first_name: 'Jordan', email: 'jlee@marshall.edu' }],
    },
    rules: [
      { id: 'more-than-zero', table: 'Ticket', text: 'tickets sold here cost more than $0. Free comps are handled by the box office', check: r => r.price_paid > 0 },
      { id: 'quantity', table: 'Ticket', text: 'one purchase is 1 to 10 tickets', check: r => r.quantity >= 1 && r.quantity <= 10 },
      { id: 'section', table: 'Ticket', text: 'the section is Floor, Lower, Upper, or Lawn', check: r => SECTIONS.includes(r.seat_section) },
      { id: 'real-email', table: 'Student', text: 'an email has text before the @, and a domain with a dot after it', check: r => /^.+@.+\..+$/.test(String(r.email || '')) },
      { id: 'ends-after', table: 'Concert', text: 'a concert ends after it starts', check: r => String(r.end_time) > String(r.start_time) },
    ],
    legitRows: [
      { table: 'Ticket', note: 'A $45 ticket', row: tk(10, 45) },
      { table: 'Student', note: 'A real email address', row: { student_id: 10, first_name: 'Chris', email: 'chris.osei@marshall.edu' } },
      { table: 'Student', note: 'A real email that isn\u2019t a Marshall address', row: { student_id: 13, first_name: 'Devon', email: 'devonp@gmail.com' } },
    ],
    badRows: [
      { table: 'Ticket', note: 'A $0 ticket', row: tk(11, 0) },
      { table: 'Student', note: 'An email that is just @', row: { student_id: 11, first_name: 'X', email: '@' } },
      { table: 'Student', note: 'An email with no domain', row: { student_id: 12, first_name: 'Y', email: 'a@b' } },
    ],
    predict: [
      { id: 'floor', when: 'after:checks', question: 'Will the database take a seat section of `floor`, in lower case?',
        choices: [{ id: 'yes', text: 'Yes, it matches Floor' }, { id: 'no', text: 'No, it will refuse' }], answer: 'no',
        why: 'IN compares text exactly, capital letters included. So floor is not Floor.',
        then: "INSERT INTO Ticket VALUES (8, 1, 1, 50.00, 2, 'floor', '2026-11-10');" },
    ],
    goals: [
      { id: 'checks', text: 'Trip all four CHECK rules (price, quantity, section, and the concert times)', kind: 'rejected-by', errorKind: 'check', distinct: 4, distinctBy: 'rule' },
      { id: 'free', text: 'Get a free ticket past the rules', kind: 'slipped', rule: 'more-than-zero' },
      { id: 'at', text: 'Get a fake email past the rules', kind: 'slipped', rule: 'real-email' },
      { id: 'predict', text: 'Predict: is floor the same as Floor?', kind: 'predicted', predict: 'floor' },
      { id: 'fix-price', text: 'Fix the price rule', kind: 'fixed', table: 'Ticket' },
      { id: 'fix-email', text: 'Fix the email rule', kind: 'fixed', table: 'Student' },
    ],
    fix: [
      { table: 'Ticket', column: 'price_paid', unlock: 'slipped', builder: true, reference: 'price_paid > 0', wrong: ['price_paid >= 0', 'price_paid > 100'] },
      { table: 'Student', column: 'email', unlock: 'slipped', builder: true, reference: "email LIKE '_%@_%._%'", wrong: ["email LIKE '%@%'", "email LIKE '%@marshall.edu'"] },
    ],
    sqlStart: "-- Columns: ticket_id, student_id, concert_id, price_paid, quantity, seat_section, purchase_date\nINSERT INTO Ticket VALUES (4, 1, 1, -5.00, 2, 'Floor', '2026-11-10');",
    done: "The chapter's rule allows free tickets. This box office doesn't. Rules depend on the business.",
    solution: [
      { sql: "INSERT INTO Ticket VALUES (4, 1, 1, -5.00, 2, 'Floor', '2026-11-10')", expect: 'rejected' },
      { sql: "INSERT INTO Ticket VALUES (4, 1, 1, 50.00, 11, 'Floor', '2026-11-10')", expect: 'rejected' },
      { sql: "INSERT INTO Ticket VALUES (4, 1, 1, 50.00, 2, 'VIP', '2026-11-10')", expect: 'rejected' },
      { sql: "INSERT INTO Concert VALUES (2, 'Noah Kahan', '2027-03-05', '20:00', '18:00')", expect: 'rejected' },
      { sql: "INSERT INTO Ticket VALUES (4, 1, 1, 0.00, 2, 'Floor', '2026-11-10')", expect: 'slipped' },
      { sql: "INSERT INTO Student VALUES (3, 'Sam', '@')", expect: 'slipped' },
      { predict: ['floor', 'no'], expect: 'correct' },
      { sql: "INSERT INTO Ticket VALUES (8, 1, 1, 50.00, 2, 'floor', '2026-11-10')", expect: 'rejected' },
      { tryFix: { table: 'Ticket', builder: { op: '>', value: '100' } }, expect: 'failed' },
      { tryFix: { table: 'Ticket', builder: { op: '>', value: '0' } }, expect: 'passed' },
      { tryFix: { table: 'Student', expr: "email LIKE '_%@_%._%'" }, expect: 'passed' },
      { applyFix: { table: 'Ticket', builder: { op: '>', value: '0' } }, cleanup: 'delete', expect: 'rows-then-ok' },
      { sql: "INSERT INTO Ticket VALUES (9, 1, 1, 0.00, 2, 'Floor', '2026-11-10')", expect: 'rejected' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
