// Constraint Gauntlet: Level 8, Delete Policies (11.2, RESTRICT / CASCADE / SET NULL / soft delete).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const CGx = () => (isNode ? Object.assign({}, require('../blast.js'), require('../db.js')) : root.CG);

  const fk = (table, column, onDelete = 'RESTRICT') => ({ table, column, onDelete });
  const student = { name: 'Student', columns: [
    { name: 'student_id', type: 'int', pk: true },
    { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'last_name', type: 'varchar', size: 50, notNull: true },
    { name: 'is_active', type: 'boolean', notNull: true, default: true }] };
  const venue = { name: 'Venue', columns: [{ name: 'venue_id', type: 'int', pk: true }, { name: 'name', type: 'varchar', size: 100, notNull: true }] };
  const concert = { name: 'Concert', columns: [
    { name: 'concert_id', type: 'int', pk: true }, { name: 'artist', type: 'varchar', size: 100, notNull: true },
    { name: 'venue_id', type: 'int', notNull: true, fk: fk('Venue', 'venue_id') }] };
  const performer = { name: 'ConcertPerformer', noun: 'performer listing', columns: [
    { name: 'concert_id', type: 'int', fk: fk('Concert', 'concert_id') }, { name: 'performer', type: 'varchar', size: 100 }],
  constraints: [{ kind: 'pk', columns: ['concert_id', 'performer'] }] };
  // student_id can be blank here, so ON DELETE SET NULL can work. (Most ticket tables would make it NOT NULL.)
  const ticket = { name: 'Ticket', columns: [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', fk: fk('Student', 'student_id') },
    { name: 'concert_id', type: 'int', notNull: true, fk: fk('Concert', 'concert_id') },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true }] };
  const scan = { name: 'Scan', columns: [
    { name: 'scan_id', type: 'int', pk: true },
    { name: 'ticket_id', type: 'int', notNull: true, fk: fk('Ticket', 'ticket_id') },
    { name: 'scanned_at', type: 'time' }] };

  const SEED_REVENUE = 450.5;
  const jordanBlast = s => {
    const C = CGx();
    const rows = C.tableRows(s.game, 'Student').filter(r => r.student_id === 2);
    if (!rows.length) return 'gone';
    const sim = C.simulateDelete(s.game, 'Student', rows);
    if (sim.blocked) return 'blocked';
    const total = Object.values(sim.removed).reduce((a, b) => a + b, 0);
    return String(total);
  };
  const deletedUnder = (st, policy) => st.log.some(a => a.kind === 'delete' && a.table === 'Student' && a.policies && a.policies['Ticket.student_id'] === policy);

  const level = {
    id: 8, title: 'Delete Policies', section: '11.2',
    mission: 'Jordan is leaving school. Decide what deleting Jordan should do to Jordan’s tickets and gate scans.',
    tables: [student, venue, concert, performer, ticket, scan],
    policyLinks: ['Ticket.student_id', 'Scan.ticket_id'],
    policyChoices: { 'Ticket.student_id': ['RESTRICT', 'CASCADE', 'SET NULL'], 'Scan.ticket_id': ['RESTRICT', 'CASCADE'] },
    seed: {
      Student: [{ student_id: 1, first_name: 'Maya', last_name: 'Patel' }, { student_id: 2, first_name: 'Jordan', last_name: 'Lee' },
        { student_id: 3, first_name: 'Taylor', last_name: 'Brooks' }],
      Venue: [{ venue_id: 1, name: 'Mountain Health Arena' }, { venue_id: 2, name: 'Joan C. Edwards Stadium' }, { venue_id: 3, name: 'Keith-Albee' }],
      Concert: [{ concert_id: 1, artist: 'Zach Bryan', venue_id: 1 }, { concert_id: 2, artist: 'Noah Kahan', venue_id: 3 },
        { concert_id: 3, artist: 'Morgan Wallen', venue_id: 2 }, { concert_id: 4, artist: 'TEST EVENT (created by mistake)', venue_id: 1 }],
      ConcertPerformer: [{ concert_id: 1, performer: 'Zach Bryan' }, { concert_id: 4, performer: 'Opener TBD' }, { concert_id: 4, performer: 'Headliner TBD' }],
      Ticket: [{ ticket_id: 1, student_id: 2, concert_id: 1, price_paid: 89.5 }, { ticket_id: 2, student_id: 2, concert_id: 1, price_paid: 89.5 },
        { ticket_id: 3, student_id: 2, concert_id: 2, price_paid: 62 }, { ticket_id: 4, student_id: 1, concert_id: 1, price_paid: 89.5 },
        { ticket_id: 5, student_id: 3, concert_id: 3, price_paid: 120 }],
      Scan: [[1, 1, '18:41'], [2, 1, '21:05'], [3, 2, '18:43'], [4, 2, '21:06'], [5, 3, '19:52'], [6, 3, '20:30'], [7, 4, '18:50']]
        .map(([scan_id, ticket_id, scanned_at]) => ({ scan_id, ticket_id, scanned_at })),
    },
    reports: [{ id: 'revenue', title: 'Concert revenue', sql: 'SELECT SUM(price_paid) AS total FROM Ticket' }],
    rules: [],
    predict: [
      { id: 'blast', when: 'before-delete', question: 'Under the rules you picked, how many rows will deleting Jordan remove?',
        choices: [{ id: 'blocked', text: 'None. It will be blocked' }, { id: '1', text: '1 (just Jordan)' }, { id: '4', text: '4 (Jordan and 3 tickets)' },
          { id: '10', text: '10 (Jordan, 3 tickets, 6 scans)' }],
        answer: jordanBlast,
        why: (s, answer) => (answer === 'blocked' ? 'A RESTRICT somewhere in the chain stops the whole delete. Nothing changes.'
          : answer === '1' ? 'SET NULL keeps the tickets and just blanks their student_id. Only Jordan’s row goes.'
            : 'CASCADE all the way down removes Jordan, the tickets, and every scan of those tickets.') },
    ],
    policyKey: [
      { link: 'Ticket.student_id', label: 'Ticket → Student (a student leaves school)', accept: ['RESTRICT', 'SET NULL'], best: 'RESTRICT',
        notes: { RESTRICT: 'Good. The delete is blocked, so you mark the student inactive instead.',
          'SET NULL': 'This works. The money stays in your reports, but you lose who bought each ticket.',
          CASCADE: 'Risky. It erases sales history along with the student.' } },
      { link: 'Scan.ticket_id', label: 'Scan → Ticket (gate scans of a ticket)', accept: ['RESTRICT', 'CASCADE'], best: 'either',
        notes: { CASCADE: 'Fine. A scan means nothing without its ticket.', RESTRICT: 'Fine too. This is the careful choice.' } },
      { link: 'Concert.venue_id', label: 'Concert → Venue (a venue closes)', accept: ['RESTRICT'], best: 'RESTRICT',
        notes: { RESTRICT: 'Right. A closed venue shouldn’t erase the concerts it hosted.',
          CASCADE: 'Risky. Closing a venue would delete every concert it ever hosted, and their tickets would block it or vanish too.' } },
      { link: 'ConcertPerformer.concert_id', label: 'Performer listing → Concert (a concert made by mistake)', accept: ['CASCADE', 'RESTRICT'], best: 'CASCADE',
        notes: { CASCADE: 'Right. This is the chapter’s own example of a safe CASCADE.', RESTRICT: 'This works, but you must delete the performer rows by hand first.' } },
    ],
    policyOptions: { 'Ticket.student_id': ['RESTRICT', 'CASCADE', 'SET NULL'], 'Scan.ticket_id': ['RESTRICT', 'CASCADE'],
      'Concert.venue_id': ['RESTRICT', 'CASCADE'], 'ConcertPerformer.concert_id': ['RESTRICT', 'CASCADE'] },
    policyTests: [
      { label: 'Delete Jordan Lee', sql: 'DELETE FROM Student WHERE student_id = 2' },
      { label: 'Delete ticket 1', sql: 'DELETE FROM Ticket WHERE ticket_id = 1' },
      { label: 'Delete Mountain Health Arena', sql: 'DELETE FROM Venue WHERE venue_id = 1' },
      { label: 'Delete the concert made by mistake', sql: 'DELETE FROM Concert WHERE concert_id = 4' },
    ],
    goals: [
      { id: 'restrict', text: 'Try deleting Jordan with RESTRICT', kind: 'state', check: st => deletedUnder(st, 'RESTRICT') },
      { id: 'cascade', text: 'Try deleting Jordan with CASCADE', kind: 'state', check: st => deletedUnder(st, 'CASCADE') },
      { id: 'setnull', text: 'Try deleting Jordan with SET NULL', kind: 'state', check: st => deletedUnder(st, 'SET NULL') },
      { id: 'predict', text: 'Predict how many rows a delete will remove', kind: 'predicted', predict: 'blast' },
      { id: 'soft', text: 'Mark Jordan inactive instead, and keep the revenue report whole', kind: 'state',
        check: st => !!st.flags.softDeleted && Math.abs(st.report('revenue').total - SEED_REVENUE) < 0.001 },
      { id: 'choose', text: 'Choose a delete rule for each relationship', kind: 'flag', flag: 'policiesPassed' },
    ],
    sqlStart: '-- Pick the rules on the board, then try:\nDELETE FROM Student WHERE student_id = 2;',
    done: 'Deleting is forever. When a record has history, mark it inactive instead.',
    solution: [
      { predict: ['blast', 'blocked'], expect: 'correct' },
      { sql: 'DELETE FROM Student WHERE student_id = 2', expect: 'rejected' },
      { policies: { 'Ticket.student_id': 'CASCADE', 'Scan.ticket_id': 'CASCADE' } },
      { predict: ['blast', '10'], expect: 'correct' },
      { sql: 'DELETE FROM Student WHERE student_id = 2', expect: 'accepted' },
      { resetData: true },
      { policies: { 'Ticket.student_id': 'SET NULL', 'Scan.ticket_id': 'RESTRICT' } },
      { predict: ['blast', '1'], expect: 'correct' },
      { sql: 'DELETE FROM Student WHERE student_id = 2', expect: 'accepted' },
      { resetData: true },
      { policies: { 'Ticket.student_id': 'RESTRICT' } },
      { soft: ['Student', { student_id: 2 }] },
      { judge: { 'Ticket.student_id': 'CASCADE', 'Scan.ticket_id': 'CASCADE', 'Concert.venue_id': 'RESTRICT', 'ConcertPerformer.concert_id': 'CASCADE' }, expect: 'failed' },
      { judge: { 'Ticket.student_id': 'RESTRICT', 'Scan.ticket_id': 'CASCADE', 'Concert.venue_id': 'RESTRICT', 'ConcertPerformer.concert_id': 'CASCADE' }, expect: 'passed' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
