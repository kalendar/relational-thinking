// Constraint Gauntlet: Level 4, Double-Booked Venue (11.1, composite UNIQUE).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const readQuery = (g, sql, p) => (isNode ? require('../db.js') : root.CG).readQuery(g, sql, p);

  const venue = { name: 'Venue', columns: [
    { name: 'venue_id', type: 'int', pk: true },
    { name: 'name', type: 'varchar', size: 100, notNull: true },
    { name: 'city', type: 'varchar', size: 50, notNull: true },
  ] };
  const venueName = (row, game) => {
    const v = readQuery(game, 'SELECT name FROM Venue WHERE venue_id = ?', [row.venue_id]).rows[0];
    return v ? `(Venue ${row.venue_id} is ${v.name}.)` : '';
  };
  const concert = { name: 'Concert', columns: [
    { name: 'concert_id', type: 'int', pk: true },
    { name: 'artist', type: 'varchar', size: 100, notNull: true },
    { name: 'venue_id', type: 'int', notNull: true },
    { name: 'concert_date', type: 'date', notNull: true },
    { name: 'start_time', type: 'time' },
    { name: 'end_time', type: 'time' },
  ], constraints: [{ kind: 'unique', columns: ['venue_id'] }] };
  const setUnique = (...sets) => t => Object.assign(t, { constraints: sets.map(columns => ({ kind: 'unique', columns,
    text: columns.length === 2 ? 'One show per venue per night.' : undefined, describe: venueName })) });
  const show = (id, artist, venueId, date) => ({ concert_id: id, artist, venue_id: venueId, concert_date: date, start_time: '19:00', end_time: '22:00' });

  const level = {
    id: 4, title: 'Double-Booked Venue', section: '11.1',
    mission: 'A venue can host one show per night. Find out what the current rule really says.',
    tables: [venue, concert],
    seed: {
      Venue: [{ venue_id: 1, name: 'Mountain Health Arena', city: 'Huntington' }, { venue_id: 2, name: 'Joan C. Edwards Stadium', city: 'Huntington' },
        { venue_id: 3, name: 'Keith-Albee Performing Arts Center', city: 'Huntington' }],
      Concert: [Object.assign(show(1, 'Zach Bryan', 1, '2027-02-14'), { end_time: '22:30' }), Object.assign(show(2, 'Noah Kahan', 3, '2027-03-05'), { start_time: '20:00' }),
        Object.assign(show(3, 'Morgan Wallen', 2, '2027-04-17'), { start_time: '18:30', end_time: '23:00' })],
    },
    rules: [
      { id: 'one-show-per-night', table: 'Concert', text: 'a venue hosts at most one show per night',
        check: (r, ctx) => !ctx.query('SELECT rowid AS _rowid FROM Concert WHERE venue_id = ? AND concert_date = ?', [r.venue_id, r.concert_date]).some(x => x._rowid !== ctx.self) },
    ],
    legitRows: [
      { table: 'Concert', note: 'A second show at Mountain Health Arena, a week later', row: show(10, 'Chappell Roan', 1, '2027-02-21') },
      { table: 'Concert', note: 'A show at the stadium on the same night as Zach Bryan', row: show(11, 'Luke Combs', 2, '2027-02-14') },
    ],
    badRows: [
      { table: 'Concert', note: 'A second show at Mountain Health Arena on Zach Bryan’s night', row: show(12, 'Sabrina Carpenter', 1, '2027-02-14') },
    ],
    predict: [
      { id: 'diff-date', when: 'after:fix', question: 'Mountain Health Arena again, on 2027-02-28. Accepted or rejected?',
        choices: [{ id: 'accepted', text: 'Accepted' }, { id: 'rejected', text: 'Rejected' }], answer: 'accepted',
        why: 'Same venue, different night. The combination is new, so it’s allowed.',
        then: "INSERT INTO Concert VALUES (20, 'Hozier', 1, '2027-02-28', '19:00', '22:00');" },
      { id: 'diff-venue', when: 'after:fix', question: 'The Keith-Albee on 2027-02-14, the night of Zach Bryan’s show. Accepted or rejected?',
        choices: [{ id: 'accepted', text: 'Accepted' }, { id: 'rejected', text: 'Rejected' }], answer: 'accepted',
        why: 'Same night, different venue. Each column can repeat on its own.',
        then: "INSERT INTO Concert VALUES (21, 'Tyler Childers', 3, '2027-02-14', '20:00', '22:30');" },
      { id: 'same-both', when: 'after:fix', question: 'Mountain Health Arena on 2027-02-14 again. Accepted or rejected?',
        choices: [{ id: 'accepted', text: 'Accepted' }, { id: 'rejected', text: 'Rejected' }], answer: 'rejected',
        why: 'That exact venue and night is already taken, so the composite UNIQUE refuses it.',
        then: "INSERT INTO Concert VALUES (22, 'Sabrina Carpenter', 1, '2027-02-14', '19:00', '22:00');" },
    ],
    goals: [
      { id: 'strict', text: 'Try a second show at the same venue on a different night', kind: 'flag', flag: 'tooStrict' },
      { id: 'fix', text: 'Fix the rule so it means "one show per venue per night"', kind: 'fixed', table: 'Concert' },
      { id: 'p1', text: 'Predict: same venue, different night', kind: 'predicted', predict: 'diff-date' },
      { id: 'p2', text: 'Predict: same night, different venue', kind: 'predicted', predict: 'diff-venue' },
      { id: 'p3', text: 'Predict: same venue, same night', kind: 'predicted', predict: 'same-both' },
    ],
    fix: { table: 'Concert', unlock: 'too-strict', options: [
      { id: 'date', label: 'UNIQUE (concert_date)', correct: false,
        why: 'Now two different venues can’t have shows on the same night. That’s a different rule, and also too strict.',
        change: setUnique(['concert_date']) },
      { id: 'pair', label: 'UNIQUE (venue_id, concert_date)', correct: true,
        why: 'The combination must be unique. Each column on its own can repeat.', change: setUnique(['venue_id', 'concert_date']) },
      { id: 'both', label: 'UNIQUE (venue_id), UNIQUE (concert_date)', correct: false,
        why: 'Two separate rules are stricter still: one show per venue ever, and one show per night anywhere.',
        change: setUnique(['venue_id'], ['concert_date']) },
    ] },
    sqlStart: "-- Book another show at Mountain Health Arena (venue 1), a week after Zach Bryan.\nINSERT INTO Concert VALUES (4, 'Chappell Roan', 1, '2027-02-21', '19:00', '22:00');",
    done: 'A composite UNIQUE checks the combination. Each column on its own can repeat.',
    solution: [
      { sql: "INSERT INTO Concert VALUES (4, 'Chappell Roan', 1, '2027-02-21', '19:00', '22:00')", expect: 'rejected' },
      { tryFix: { optionId: 'date' }, expect: 'failed' },
      { tryFix: { optionId: 'pair' }, expect: 'passed' },
      { applyFix: { optionId: 'pair' } },
      { predict: ['diff-date', 'accepted'], expect: 'correct' },
      { sql: "INSERT INTO Concert VALUES (20, 'Hozier', 1, '2027-02-28', '19:00', '22:00')", expect: 'accepted' },
      { predict: ['diff-venue', 'accepted'], expect: 'correct' },
      { sql: "INSERT INTO Concert VALUES (21, 'Tyler Childers', 3, '2027-02-14', '20:00', '22:30')", expect: 'accepted' },
      { predict: ['same-both', 'rejected'], expect: 'correct' },
      { sql: "INSERT INTO Concert VALUES (22, 'Sabrina Carpenter', 1, '2027-02-14', '19:00', '22:00')", expect: 'rejected' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
