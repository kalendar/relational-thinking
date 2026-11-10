// Constraint Gauntlet: Level 7, Load Day (11.2, parent before child).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const fk = (table, column) => ({ table, column, onDelete: 'RESTRICT' });
  const venue = { name: 'Venue', columns: [
    { name: 'venue_id', type: 'int', pk: true }, { name: 'name', type: 'varchar', size: 100, notNull: true }, { name: 'city', type: 'varchar', size: 50 }] };
  const concert = { name: 'Concert', columns: [
    { name: 'concert_id', type: 'int', pk: true }, { name: 'artist', type: 'varchar', size: 100, notNull: true },
    { name: 'venue_id', type: 'int', notNull: true, fk: fk('Venue', 'venue_id') }, { name: 'concert_date', type: 'date', notNull: true }] };
  const student = { name: 'Student', columns: [
    { name: 'student_id', type: 'int', pk: true }, { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'last_name', type: 'varchar', size: 50, notNull: true }] };
  const ticket = { name: 'Ticket', columns: [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', notNull: true, fk: fk('Student', 'student_id') },
    { name: 'concert_id', type: 'int', notNull: true, fk: fk('Concert', 'concert_id') },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true }] };
  const team = { name: 'Team', columns: [
    { name: 'team_id', type: 'int', pk: true }, { name: 'name', type: 'varchar', size: 50, notNull: true },
    { name: 'captain_id', type: 'int', notNull: true, fk: fk('Player', 'player_id') }] };
  const player = { name: 'Player', columns: [
    { name: 'player_id', type: 'int', pk: true }, { name: 'name', type: 'varchar', size: 50, notNull: true },
    { name: 'team_id', type: 'int', notNull: true, fk: fk('Team', 'team_id') }] };

  const cards = [
    { id: 'v1', label: 'Venue: Mountain Health Arena', sql: "INSERT INTO Venue VALUES (1, 'Mountain Health Arena', 'Huntington');" },
    { id: 'v2', label: 'Venue: Joan C. Edwards Stadium', sql: "INSERT INTO Venue VALUES (2, 'Joan C. Edwards Stadium', 'Huntington');" },
    { id: 'c1', label: 'Concert: Zach Bryan at the arena', sql: "INSERT INTO Concert VALUES (1, 'Zach Bryan', 1, '2027-02-14');" },
    { id: 'c2', label: 'Concert: Morgan Wallen at the stadium', sql: "INSERT INTO Concert VALUES (2, 'Morgan Wallen', 2, '2027-04-17');" },
    { id: 'c3', label: 'Concert: Noah Kahan at the arena', sql: "INSERT INTO Concert VALUES (3, 'Noah Kahan', 1, '2027-03-05');" },
    { id: 's1', label: 'Student: Maya Patel', sql: "INSERT INTO Student VALUES (1, 'Maya', 'Patel');" },
    { id: 's2', label: 'Student: Jordan Lee', sql: "INSERT INTO Student VALUES (2, 'Jordan', 'Lee');" },
    { id: 's3', label: 'Student: Taylor Brooks', sql: "INSERT INTO Student VALUES (3, 'Taylor', 'Brooks');" },
    { id: 't1', label: 'Ticket: Maya to Zach Bryan', sql: 'INSERT INTO Ticket VALUES (1, 1, 1, 89.50);' },
    { id: 't2', label: 'Ticket: Jordan to Zach Bryan', sql: 'INSERT INTO Ticket VALUES (2, 2, 1, 89.50);' },
    { id: 't3', label: 'Ticket: Jordan to Noah Kahan', sql: 'INSERT INTO Ticket VALUES (3, 2, 3, 62.00);' },
    { id: 't4', label: 'Ticket: Taylor to Morgan Wallen', sql: 'INSERT INTO Ticket VALUES (4, 3, 2, 120.00);' },
  ];
  const bonusCards = [
    { id: 'tm', label: 'Team: Thundering Herd intramural (captain: Maya)', sql: "INSERT INTO Team VALUES (1, 'Herd Intramural', 1);" },
    { id: 'p1', label: 'Player: Maya', sql: "INSERT INTO Player VALUES (1, 'Maya', 1);" },
    { id: 'p2', label: 'Player: Jordan', sql: "INSERT INTO Player VALUES (2, 'Jordan', 1);" },
    { id: 'p3', label: 'Player: Taylor', sql: "INSERT INTO Player VALUES (3, 'Taylor', 1);" },
  ];

  // A seeded shuffle, so a whole class sees the same order.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, seed = 1102) {
    const r = mulberry32(seed);
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  const count = (st, t) => st.report(`count-${t}`).n;

  const level = {
    id: 7, title: 'Load Day', section: '11.2',
    mission: 'Load a whole day’s data into empty tables. The database decides what order works.',
    tables: [venue, concert, student, ticket, team, player],
    mainTables: ['Venue', 'Concert', 'Student', 'Ticket'],
    bonusTables: ['Team', 'Player'],
    seed: {},
    cards, bonusCards, shuffled,
    reports: ['Venue', 'Concert', 'Student', 'Ticket', 'Team', 'Player'].map(t => ({ id: `count-${t}`, title: `${t} rows`, sql: `SELECT COUNT(*) AS n FROM ${t}`, hidden: true })),
    rules: [],
    predict: [
      { id: 'order', when: 'start', question: 'Which load order always works?',
        choices: [{ id: 'alpha', text: 'Alphabetical by table name' }, { id: 'tickets', text: 'Tickets first, since they’re the point' },
          { id: 'parents', text: 'Parents before children' }], answer: 'parents',
        why: 'A row can only point at something that already exists. Load Venue, then Concert, then Student, then Ticket.' },
    ],
    goals: [
      { id: 'predict', text: 'Predict: which load order always works?', kind: 'predicted', predict: 'order' },
      { id: 'loaded', text: 'Load all 12 cards', kind: 'state',
        check: st => count(st, 'Venue') === 2 && count(st, 'Concert') === 3 && count(st, 'Student') === 3 && count(st, 'Ticket') === 4 },
      { id: 'bonus', text: 'Bonus: load a team whose captain is one of its own players', kind: 'state', optional: true,
        check: st => count(st, 'Team') === 1 && count(st, 'Player') === 3 &&
          st.game.db.exec('SELECT COUNT(*) FROM Team WHERE captain_id IS NOT NULL')[0].values[0][0] === 1 &&
          st.game.db.exec('SELECT COUNT(*) FROM Player WHERE team_id IS NOT NULL')[0].values[0][0] === 3 },
    ],
    fix: [
      { table: 'Team', unlock: 'bounced', watch: ['Team', 'Player'], test: false, options: [
        { id: 'captain', label: 'Team.captain_id can be blank for now', correct: true,
          why: 'Add the team with no captain, add the players, then UPDATE the team’s captain.',
          change: t => { t.columns.find(c => c.name === 'captain_id').notNull = false; return t; } }] },
      { table: 'Player', unlock: 'bounced', watch: ['Team', 'Player'], test: false, options: [
        { id: 'team', label: 'Player.team_id can be blank for now', correct: true,
          why: 'Add the players with no team, add the team, then UPDATE each player’s team.',
          change: t => { t.columns.find(c => c.name === 'team_id').notNull = false; return t; } }] },
    ],
    sqlStart: cards.map(c => c.sql).join('\n'),
    done: 'The database won’t let a row point at something that isn’t there yet. Load parents first, children last.',
    solution: [
      { predict: ['order', 'parents'], expect: 'correct' },
      { runAll: ['t1', 'c1'].map(id => cards.find(c => c.id === id).sql), expect: ['rejected', 'rejected'] },
      ...['v1', 'v2', 'c1', 'c2', 'c3', 's1', 's2', 's3', 't1', 't2', 't3', 't4'].map(id => ({ sql: cards.find(c => c.id === id).sql, expect: 'accepted' })),
      { sql: bonusCards[0].sql, expect: 'rejected' },
      { applyFix: { table: 'Team', optionId: 'captain' } },
      { sql: "INSERT INTO Team VALUES (1, 'Herd Intramural', NULL);", expect: 'accepted' },
      ...bonusCards.slice(1).map(c => ({ sql: c.sql, expect: 'accepted' })),
      { sql: 'UPDATE Team SET captain_id = 1 WHERE team_id = 1;', expect: 'accepted' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
