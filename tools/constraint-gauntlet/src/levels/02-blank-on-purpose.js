// Constraint Gauntlet: Level 2, Blank on Purpose (11.1, NULL: unknown vs. not applicable).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const blank = v => (isNode ? require('../rules.js') : root.CG).isBlank(v);

  const student = { name: 'Student', columns: [
    { name: 'student_id', type: 'int', pk: true },
    { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'middle_name', type: 'varchar', size: 50, notNull: true },
    { name: 'last_name', type: 'varchar', size: 50, notNull: true },
    { name: 'email', type: 'varchar', size: 255, notNull: true },
    { name: 'gpa', type: 'decimal', precision: [3, 2], notNull: true },
    { name: 'secondary_email', type: 'varchar', size: 255, notNull: true },
    { name: 'has_secondary_email', type: 'boolean', notNull: true, default: false },
  ] };
  const ticket = { name: 'Ticket', columns: [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', notNull: true },
    { name: 'concert_id', type: 'int', notNull: true },
    { name: 'seat_section', type: 'varchar', size: 10, notNull: true },
    { name: 'seat_number', type: 'varchar', size: 5, notNull: true },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true },
    { name: 'purchase_date', type: 'date', notNull: true },
    { name: 'refund_date', type: 'date', notNull: true },
  ] };

  const st = (id, first, middle, last, email, gpa, second) => ({ table: 'Student', row: { student_id: id, first_name: first, middle_name: middle, last_name: last,
    email, gpa, secondary_email: second, has_secondary_email: !!second } });
  const tk = (id, sid, section, seat, price, bought, refund) => ({ table: 'Ticket', row: { ticket_id: id, student_id: sid, concert_id: 1, seat_section: section,
    seat_number: seat, price_paid: price, purchase_date: bought, refund_date: refund } });

  const level = {
    id: 2, title: 'Blank on Purpose', section: '11.1',
    mission: 'Decide which columns may be blank, and what a blank means. Then load a batch of real rows.',
    tables: [student, ticket],
    seed: {},
    decisions: [
      { table: 'Student', column: 'middle_name', key: { required: false, tag: 'either' },
        why: 'Some people have no middle name, and sometimes we just don’t know it. The chapter allows both readings.' },
      { table: 'Student', column: 'last_name', key: { required: true }, why: 'A student record without a last name is incomplete.' },
      { table: 'Student', column: 'gpa', key: { required: false, tag: 'unknown' },
        why: 'A first-semester student will have a GPA. We just don’t have the number yet.' },
      { table: 'Student', column: 'secondary_email', key: { required: false, tag: 'either' },
        why: 'This is the chapter’s tricky one. The has_secondary_email column says which meaning applies.' },
      { table: 'Ticket', column: 'seat_number', key: { required: false, tag: 'na' }, why: 'Lawn tickets are general admission. There is no seat.' },
      { table: 'Ticket', column: 'purchase_date', key: { required: true }, why: 'Without it, the ticket vanishes from date reports, as in Level 1.' },
      { table: 'Ticket', column: 'refund_date', key: { required: false, tag: 'na' },
        why: 'A ticket that was never refunded has no refund date. That’s not missing data.' },
    ],
    batch: [
      Object.assign(st(1, 'Ana', null, 'Ruiz', 'ana.ruiz@marshall.edu', 3.4, null), { note: 'Ana Ruiz has no middle name' }),
      Object.assign(st(2, 'Chris', 'Kofi', 'Osei', 'chris.osei@marshall.edu', null, null), { note: 'Chris Osei is in his first semester, so no GPA yet' }),
      Object.assign(st(3, 'Priya', 'Anand', 'Shah', 'priya.shah@marshall.edu', 3.8, null), { note: 'Priya Shah has no secondary email' }),
      Object.assign(st(4, 'Devon', 'James', 'Price', 'devon.price@marshall.edu', 3.1, 'devonp@gmail.com'), { note: 'Devon Price has every field filled in' }),
      Object.assign(st(5, 'Sam', 'Lee', null, 'sam@marshall.edu', 2.9, null), { note: 'Sam has no last name' }),
      Object.assign(tk(1, 1, 'Lawn', null, 49, '2026-11-01', null), { note: 'A Lawn ticket has no seat number' }),
      Object.assign(tk(2, 2, 'Floor', 'A12', 129, '2026-11-02', null), { note: 'A Floor ticket that was never refunded' }),
      Object.assign(tk(3, 3, 'Upper', 'U3', 59, '2026-11-02', '2026-11-08'), { note: 'A ticket that was refunded on Nov 8' }),
      Object.assign(tk(4, 4, 'Lower', '214', 89, '2026-11-03', null), { note: 'A Lower-bowl ticket in seat 214' }),
      Object.assign(tk(5, 1, 'Floor', 'B7', 129, '2026-11-04', null), { note: 'A second Floor ticket' }),
      Object.assign(tk(6, 2, 'Lawn', null, 49, '2026-11-05', null), { note: 'Another Lawn ticket' }),
      Object.assign(tk(7, 3, 'Upper', 'U9', 59, null, null), { note: 'A ticket with no purchase date' }),
    ],
    rules: [
      { id: 'has-last-name', table: 'Student', text: 'a student has a last name', check: r => !blank(r.last_name) },
      { id: 'has-date', table: 'Ticket', text: 'a ticket has a purchase date', check: r => !blank(r.purchase_date) },
    ],
    goals: [
      { id: 'batch', text: 'Load the batch with no real rows refused and no bad rows let in, and tag each blank correctly', kind: 'flag', flag: 'batchClean' },
    ],
    sqlStart: '-- This level is a decision board. Make your choices, then press Run the batch.\nSELECT * FROM Student;',
    done: 'NULL can mean "we don’t know yet" or "this doesn’t apply." When it matters which, add a column that says so.',
    solution: [
      { decide: {
        'Student.middle_name': { required: false, tag: 'na' }, 'Student.last_name': { required: true },
        'Student.gpa': { required: false, tag: 'unknown' }, 'Student.secondary_email': { required: false, tag: 'unknown' },
        'Ticket.seat_number': { required: false, tag: 'na' }, 'Ticket.purchase_date': { required: true },
        'Ticket.refund_date': { required: false, tag: 'na' } }, expect: 'clean' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
