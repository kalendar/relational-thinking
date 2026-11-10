// Constraint Gauntlet: Level 1, Required Fields (11.1, NOT NULL).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const blank = v => (isNode ? require('../rules.js') : root.CG).isBlank(v);

  const cols = dateNotNull => [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', notNull: true },
    { name: 'concert_id', type: 'int', notNull: true },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true },
    { name: 'purchase_date', type: 'date', notNull: dateNotNull },
  ];
  const ticket = { name: 'Ticket', columns: cols(true) };
  const loose = { name: 'Ticket', columns: cols(false) };

  const level = {
    id: 1, title: 'Required Fields', section: '11.1',
    mission: 'Every ticket needs a student, a concert, a price, and a date. See what NOT NULL does.',
    tables: [ticket],
    variants: { loose: { tables: [loose], label: 'Loose version: purchase_date can be blank' } },
    variantToggle: { name: 'loose', label: 'Try the loose version', back: 'Back to the strict version', unlockAfter: 'blanks' },
    seed: { Ticket: [
      { ticket_id: 1, student_id: 1, concert_id: 1, price_paid: 89.5, purchase_date: '2026-11-01' },
      { ticket_id: 2, student_id: 2, concert_id: 1, price_paid: 89.5, purchase_date: '2026-11-02' },
      { ticket_id: 3, student_id: 2, concert_id: 2, price_paid: 62, purchase_date: '2026-11-03' },
      { ticket_id: 4, student_id: 3, concert_id: 3, price_paid: 120, purchase_date: '2026-11-04' },
    ] },
    reports: [
      { id: 'nov', title: 'Tickets sold in November', sql: "SELECT COUNT(*) AS tickets, SUM(price_paid) AS revenue FROM Ticket WHERE purchase_date BETWEEN '2026-11-01' AND '2026-11-30'" },
      { id: 'all', title: 'Tickets in the table', sql: 'SELECT COUNT(*) AS tickets, SUM(price_paid) AS revenue FROM Ticket' },
    ],
    rules: [
      { id: 'has-student', table: 'Ticket', text: 'a ticket says who bought it', check: r => !blank(r.student_id) },
      { id: 'has-concert', table: 'Ticket', text: 'a ticket says which concert it is for', check: r => !blank(r.concert_id) },
      { id: 'has-price', table: 'Ticket', text: 'a ticket records the price paid', check: r => !blank(r.price_paid) },
      { id: 'has-date', table: 'Ticket', text: 'a ticket needs a purchase date, or it disappears from date reports', check: r => !blank(r.purchase_date) },
    ],
    predict: [
      { id: 'blank-price', when: 'start', question: 'Will the database take a ticket with no price?',
        choices: [{ id: 'yes', text: 'Yes, it will save it' }, { id: 'no', text: 'No, it will refuse' }], answer: 'no',
        why: 'price_paid is NOT NULL, so a ticket without a price is refused.',
        then: "INSERT INTO Ticket (ticket_id, student_id, concert_id, price_paid, purchase_date)\nVALUES (5, 1, 2, NULL, '2026-11-05');" },
    ],
    goals: [
      { id: 'add', text: 'Add a complete ticket', kind: 'accepted', table: 'Ticket', match: r => r.ticket_id > 4 },
      { id: 'predict', text: 'Predict: will a ticket with no price be saved?', kind: 'predicted', predict: 'blank-price' },
      { id: 'blanks', text: 'Get a NOT NULL error on three different columns', kind: 'rejected-by', errorKind: 'notnull', distinct: 3 },
      { id: 'missing', text: 'In the loose version, make a ticket disappear from the November report', kind: 'state',
        check: st => st.game.variant === 'loose' && st.log.some(a => a.variant === 'loose' && a.outcome === 'slipped' && a.broken.includes('has-date'))
          && st.report('nov').tickets !== st.report('all').tickets },
    ],
    sqlStart: "-- Try adding a ticket. Press Run (or Ctrl+Enter).\nINSERT INTO Ticket (ticket_id, student_id, concert_id, price_paid, purchase_date)\nVALUES (5, 1, 2, 45.00, '2026-11-10');",
    done: "The loose table didn't give you an error. It gave you a wrong report. That's worse.",
    solution: [
      { sql: "INSERT INTO Ticket VALUES (5, 1, 2, 45.00, '2026-11-10')", expect: 'accepted' },
      { predict: ['blank-price', 'no'], expect: 'correct' },
      { sql: "INSERT INTO Ticket VALUES (6, 1, 2, NULL, '2026-11-10')", expect: 'rejected' },
      { sql: 'INSERT INTO Ticket VALUES (6, 1, 2, 45.00, NULL)', expect: 'rejected' },
      { sql: "INSERT INTO Ticket VALUES (6, 1, NULL, 45.00, '2026-11-10')", expect: 'rejected' },
      { variant: 'loose' },
      { sql: 'INSERT INTO Ticket VALUES (6, 1, 2, 45.00, NULL)', expect: 'slipped' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
