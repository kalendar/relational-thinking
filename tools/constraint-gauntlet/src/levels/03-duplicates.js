// Constraint Gauntlet: Level 3, Duplicate Accounts (11.1, UNIQUE).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const blank = v => (isNode ? require('../rules.js') : root.CG).isBlank(v);

  const student = { name: 'Student', columns: [
    { name: 'student_id', type: 'int', pk: true },
    { name: 'mu_id', type: 'varchar', size: 9, notNull: true, unique: true },
    { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'last_name', type: 'varchar', size: 50, notNull: true },
    { name: 'email', type: 'varchar', size: 255, notNull: true, unique: true },
    { name: 'secondary_email', type: 'varchar', size: 255, unique: true },
  ] };
  const withCol = (t, name, change) => { const c = t.columns.find(x => x.name === name); Object.assign(c, change); return t; };
  const others = (ctx, sql, args) => ctx.query(sql, args).some(r => r._rowid !== ctx.self);
  const row = (id, mu, first, last, email) => ({ student_id: id, mu_id: mu, first_name: first, last_name: last, email, secondary_email: null });

  const level = {
    id: 3, title: 'Duplicate Accounts', section: '11.1',
    mission: 'Make each email belong to just one student.',
    tables: [student],
    seed: { Student: [
      Object.assign(row(1, '901234561', 'Maya', 'Patel', 'maya.patel@marshall.edu'), { secondary_email: 'mayap@gmail.com' }),
      row(2, '901234562', 'Jordan', 'Lee', 'jlee@marshall.edu'),
      row(3, '901234563', 'Taylor', 'Brooks', 'taylor@marshall.edu'),
    ] },
    rules: [
      { id: 'one-person', table: 'Student', text: 'an email address belongs to one person, whatever the capital letters',
        check: (r, ctx) => !others(ctx, 'SELECT rowid AS _rowid FROM Student WHERE lower(email) = lower(?)', [r.email]) },
      { id: 'one-mu-id', table: 'Student', text: 'each MU ID belongs to one student',
        check: (r, ctx) => !others(ctx, 'SELECT rowid AS _rowid FROM Student WHERE mu_id = ?', [r.mu_id]) },
      { id: 'names', table: 'Student', text: 'a student has a first and last name', check: r => !blank(r.first_name) && !blank(r.last_name) },
    ],
    legitRows: [
      { table: 'Student', note: 'A new student, Chris Osei', row: row(10, '901234570', 'Chris', 'Osei', 'chris.osei@marshall.edu') },
      { table: 'Student', note: 'A different Taylor with a similar address', row: row(11, '901234571', 'Taylor', 'Reed', 'taylor@mail.marshall.edu') },
      { table: 'Student', note: 'Another student with no secondary email', row: row(12, '901234572', 'Priya', 'Shah', 'priya.shah@marshall.edu') },
    ],
    badRows: [
      { table: 'Student', note: 'Taylor again, in capitals', row: row(20, '901234580', 'Taylor', 'Brooks', 'TAYLOR@MARSHALL.EDU') },
      { table: 'Student', note: 'The exact same email as Maya', row: row(21, '901234581', 'M', 'Patel', 'maya.patel@marshall.edu') },
      { table: 'Student', note: 'Maya with a capital M', row: row(22, '901234582', 'Maya', 'Patel', 'Maya.Patel@marshall.edu') },
      { table: 'Student', note: 'Jordan’s MU ID again', row: row(23, '901234562', 'Jo', 'Lee', 'jo.lee@marshall.edu') },
    ],
    predict: [
      { id: 'null-unique', when: 'after:email', question: 'Two students already have no secondary email. Will UNIQUE stop a third one with no secondary email?',
        choices: [{ id: 'yes', text: 'Yes, that would be a duplicate' }, { id: 'no', text: 'No, it will be accepted' }], answer: 'no',
        why: 'Blank (NULL) means "no value," and one NULL is never equal to another. So UNIQUE has nothing to compare.',
        then: "INSERT INTO Student (student_id, mu_id, first_name, last_name, email, secondary_email)\nVALUES (5, '901234565', 'Sam', 'Ng', 'sam.ng@marshall.edu', NULL);" },
    ],
    goals: [
      { id: 'add', text: 'Register a new student', kind: 'accepted', table: 'Student', match: r => r.student_id > 3 },
      { id: 'mu', text: 'Get a UNIQUE error on mu_id', kind: 'rejected-by', errorKind: 'unique', column: 'mu_id' },
      { id: 'email', text: 'Get a UNIQUE error on email', kind: 'rejected-by', errorKind: 'unique', column: 'email' },
      { id: 'predict', text: 'Predict: does UNIQUE stop blanks?', kind: 'predicted', predict: 'null-unique' },
      { id: 'sneak', text: 'Sneak the same person in twice', kind: 'slipped', rule: 'one-person' },
      { id: 'fix', text: 'Fix the rule so it can’t happen again', kind: 'fixed', table: 'Student' },
    ],
    fix: { table: 'Student', unlock: 'slipped', options: [
      { id: 'pair', label: 'UNIQUE (email, first_name)', correct: false,
        why: 'Now the same email is allowed again if the first name differs. Capital letters still get through too.',
        change: t => Object.assign(withCol(t, 'email', { unique: false }), { constraints: [{ kind: 'unique', columns: ['email', 'first_name'] }] }) },
      { id: 'nocase', label: 'email VARCHAR(255) NOT NULL UNIQUE COLLATE NOCASE', correct: true,
        why: 'NOCASE tells the database to ignore capital letters when it compares emails.',
        change: t => withCol(t, 'email', { collate: 'NOCASE' }) },
      { id: 'none', label: 'Remove UNIQUE and check emails in the app instead', correct: false,
        why: 'Then nothing stops a script, an import, or a second app from adding duplicates. Section 11.4 has more on this.',
        change: t => withCol(t, 'email', { unique: false }) },
    ] },
    sqlStart: "-- Try registering a student. Press Run (or Ctrl+Enter).\nINSERT INTO Student (student_id, mu_id, first_name, last_name, email, secondary_email)\nVALUES (4, '901234564', 'Chris', 'Osei', 'chris.osei@marshall.edu', NULL);",
    done: 'UNIQUE only blocks exact matches. Deciding what counts as "the same" is a business decision you write into the rule.',
    solution: [
      { sql: "INSERT INTO Student VALUES (4, '901234564', 'Chris', 'Osei', 'chris.osei@marshall.edu', NULL)", expect: 'accepted' },
      { sql: "INSERT INTO Student VALUES (5, '901234561', 'Sam', 'Ng', 'sam.ng@marshall.edu', NULL)", expect: 'rejected' },
      { sql: "INSERT INTO Student VALUES (5, '901234565', 'Sam', 'Ng', 'jlee@marshall.edu', NULL)", expect: 'rejected' },
      { predict: ['null-unique', 'no'], expect: 'correct' },
      { sql: "INSERT INTO Student VALUES (5, '901234565', 'Sam', 'Ng', 'sam.ng@marshall.edu', NULL)", expect: 'accepted' },
      { sql: "INSERT INTO Student VALUES (6, '901234566', 'Taylor', 'Brooks', 'Taylor@marshall.edu', NULL)", expect: 'slipped' },
      { tryFix: { optionId: 'pair' }, expect: 'failed' },
      { tryFix: { optionId: 'nocase' }, expect: 'passed' },
      { applyFix: { optionId: 'nocase' }, cleanup: 'delete', expect: 'rows-then-ok' },
      { sql: "INSERT INTO Student VALUES (7, '901234567', 'Taylor', 'Brooks', 'TAYLOR@marshall.edu', NULL)", expect: 'rejected' },
    ],
  };

  if (isNode) module.exports = { level };
  else (root.CG = root.CG || {}, root.CG.LEVELS = root.CG.LEVELS || []).push(level);
})(this);
