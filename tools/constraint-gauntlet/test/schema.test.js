const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const { getSQL, attempt } = require('./helpers.js');
const F = require('./fixtures.js');

// The chapter's first Ticket example, plus NOT NULL already on the key.
const bookTicket = {
  name: 'Ticket',
  columns: [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', notNull: true, fk: { table: 'Student', column: 'student_id', onDelete: 'RESTRICT' } },
    { name: 'concert_id', type: 'int', notNull: true, fk: { table: 'Concert', column: 'concert_id', onDelete: 'RESTRICT' } },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true, check: { expr: 'price_paid >= 0' } },
    { name: 'purchase_date', type: 'date', notNull: true },
  ],
};

test('the shown DDL is formatted the way the book prints it', () => {
  assert.equal(S.createTableSql(bookTicket, { hidden: false }), [
    'CREATE TABLE Ticket (',
    '    ticket_id     INT          NOT NULL PRIMARY KEY,',
    '    student_id    INT          NOT NULL REFERENCES Student(student_id) ON DELETE RESTRICT,',
    '    concert_id    INT          NOT NULL REFERENCES Concert(concert_id) ON DELETE RESTRICT,',
    '    price_paid    DECIMAL(8,2) NOT NULL CHECK (price_paid >= 0),',
    '    purchase_date DATE         NOT NULL',
    ');',
  ].join('\n'));
});

test('the hidden DDL adds named type checks; the shown DDL has none', () => {
  const hidden = S.createTableSql(bookTicket);
  assert.match(hidden, /CONSTRAINT cg_type_price_paid CHECK \(price_paid IS NULL OR \(typeof\(price_paid\) IN \('integer','real'\)\)\)/);
  assert.doesNotMatch(S.createTableSql(bookTicket, { hidden: false }), /cg_/);
});

test('hidden type checks block wrong types and still allow NULL in nullable columns', async () => {
  const SQL = await getSQL();
  const db = new SQL.Database();
  const t = {
    name: 'T', columns: [
      { name: 'id', type: 'int', pk: true },
      { name: 'price', type: 'decimal' }, { name: 'day', type: 'date' }, { name: 'at', type: 'time' },
      { name: 'ok', type: 'boolean' }, { name: 'n', type: 'int' },
    ],
  };
  db.run(S.createTableSql(t));
  assert.equal(attempt(db, 'INSERT INTO T VALUES (1, NULL, NULL, NULL, NULL, NULL)'), 'OK');
  assert.equal(attempt(db, "INSERT INTO T VALUES (2, 12.5, '2026-11-10', '19:30', 1, 4)"), 'OK');
  assert.equal(attempt(db, "INSERT INTO T VALUES (3, 'free', NULL, NULL, NULL, NULL)"), 'CHECK constraint failed: cg_type_price');
  assert.equal(attempt(db, "INSERT INTO T VALUES (4, NULL, '2026-13-45x', NULL, NULL, NULL)"), 'CHECK constraint failed: cg_type_day');
  assert.equal(attempt(db, "INSERT INTO T VALUES (5, NULL, NULL, '7pm', NULL, NULL)"), 'CHECK constraint failed: cg_type_at');
  assert.equal(attempt(db, 'INSERT INTO T VALUES (6, NULL, NULL, NULL, 2, NULL)'), 'CHECK constraint failed: cg_type_ok');
  assert.equal(attempt(db, 'INSERT INTO T VALUES (7, NULL, NULL, NULL, NULL, 2.5)'), 'CHECK constraint failed: cg_type_n');
  assert.equal(attempt(db, 'INSERT INTO T VALUES (8, NULL, NULL, NULL, true, NULL)'), 'OK');
});

test('a primary key always gets NOT NULL', async () => {
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(S.createTableSql({ name: 'A', columns: [{ name: 'id', type: 'int', pk: true }] }));
  assert.equal(attempt(db, 'INSERT INTO A VALUES (NULL)'), 'NOT NULL constraint failed: A.id');
});

test('table-level constraints appear after the columns, in both versions', async () => {
  const t = {
    name: 'Concert', columns: [
      { name: 'concert_id', type: 'int', pk: true }, { name: 'venue_id', type: 'int', notNull: true },
      { name: 'concert_date', type: 'date', notNull: true }, { name: 'start_time', type: 'time' }, { name: 'end_time', type: 'time' },
    ],
    constraints: [
      { kind: 'unique', columns: ['venue_id', 'concert_date'] },
      { kind: 'check', name: 'ends_after_start', expr: 'end_time > start_time' },
    ],
  };
  for (const hidden of [true, false]) {
    const sql = S.createTableSql(t, { hidden });
    assert.match(sql, /,\n {4}UNIQUE \(venue_id, concert_date\),\n {4}CONSTRAINT ends_after_start CHECK \(end_time > start_time\)\n\);$/);
  }
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(S.createTableSql(t));
  db.run("INSERT INTO Concert VALUES (1, 3, '2027-02-14', '19:00', '22:00')");
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (2, 3, '2027-02-14', '19:00', '22:00')"), 'UNIQUE constraint failed: Concert.venue_id, Concert.concert_date');
});

test('a composite primary key is written as a table constraint, with NOT NULL on its columns', async () => {
  const t = {
    name: 'ConcertPerformer', columns: [{ name: 'concert_id', type: 'int' }, { name: 'performer', type: 'varchar', size: 100 }],
    constraints: [{ kind: 'pk', columns: ['concert_id', 'performer'] }],
  };
  const sql = S.createTableSql(t, { hidden: false });
  assert.match(sql, /concert_id INT +NOT NULL,/);
  assert.match(sql, /PRIMARY KEY \(concert_id, performer\)\n\);$/);
  assert.deepEqual(S.pkColumns(t), ['concert_id', 'performer']);
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(S.createTableSql(t));
  db.run("INSERT INTO ConcertPerformer VALUES (4, 'Opener')");
  assert.equal(attempt(db, "INSERT INTO ConcertPerformer VALUES (4, 'Opener')"), 'UNIQUE constraint failed: ConcertPerformer.concert_id, ConcertPerformer.performer');
  assert.equal(attempt(db, "INSERT INTO ConcertPerformer VALUES (NULL, 'X')"), 'NOT NULL constraint failed: ConcertPerformer.concert_id');
});

test('defaults: booleans as true/false shown, 1/0 hidden; text quoted', () => {
  const t = { name: 'S', columns: [{ name: 'id', type: 'int', pk: true }, { name: 'a', type: 'boolean', notNull: true, default: true },
    { name: 'b', type: 'varchar', default: "O'Hara" }] };
  assert.match(S.createTableSql(t, { hidden: false }), /a  BOOLEAN +NOT NULL DEFAULT true/);
  assert.match(S.createTableSql(t), /DEFAULT 1/);
  assert.match(S.createTableSql(t), /DEFAULT 'O''Hara'/);
});

test('seedOrder puts parents first and survives a cycle', () => {
  const venue = { name: 'Venue', columns: [{ name: 'venue_id', type: 'int', pk: true }] };
  const concert = { name: 'Concert', columns: [{ name: 'concert_id', type: 'int', pk: true }, { name: 'venue_id', type: 'int', fk: { table: 'Venue', column: 'venue_id' } }] };
  const order = S.seedOrder([F.ticket, concert, F.student, venue]);
  assert.ok(order.indexOf('Venue') < order.indexOf('Concert'));
  assert.ok(order.indexOf('Concert') < order.indexOf('Ticket'));
  assert.ok(order.indexOf('Student') < order.indexOf('Ticket'));
  const team = { name: 'Team', columns: [{ name: 'team_id', type: 'int', pk: true }, { name: 'captain_id', type: 'int', fk: { table: 'Player', column: 'player_id' } }] };
  const player = { name: 'Player', columns: [{ name: 'player_id', type: 'int', pk: true }, { name: 'team_id', type: 'int', fk: { table: 'Team', column: 'team_id' } }] };
  assert.deepEqual(S.seedOrder([team, player]).sort(), ['Player', 'Team']);
});

test('probeTableSql keeps columns and defaults and drops every constraint', () => {
  const sql = S.probeTableSql(F.student, 'temp.Student');
  assert.equal(sql, "CREATE TABLE temp.Student (student_id INT, first_name VARCHAR(50), last_name VARCHAR(50), email VARCHAR(255), is_active BOOLEAN DEFAULT 1)");
  assert.doesNotMatch(sql, /NOT NULL|UNIQUE|CHECK|REFERENCES|PRIMARY/);
});

test('rows to values and back, with booleans and defaults', () => {
  assert.deepEqual(S.rowToValues(F.student, { student_id: 1, first_name: 'M', email: 'm@x.edu' }), [1, 'M', null, 'm@x.edu', 1]);
  assert.deepEqual(S.valuesToRow(F.student, [1, 'M', null, 'm@x.edu', 0]), { student_id: 1, first_name: 'M', last_name: null, email: 'm@x.edu', is_active: false });
});

test('describeConstraint labels', () => {
  const nc = { name: 'S', columns: [{ name: 'email', type: 'varchar', unique: true, collate: 'NOCASE' }] };
  assert.equal(S.describeConstraint(F.student, { kind: 'notnull', column: 'email' }), 'NOT NULL');
  assert.equal(S.describeConstraint(F.student, { kind: 'unique', column: 'email' }), 'UNIQUE (email)');
  assert.equal(S.describeConstraint(nc, { kind: 'unique', column: 'email' }), 'UNIQUE (email) COLLATE NOCASE');
  assert.equal(S.describeConstraint(F.student, { kind: 'pk' }), 'PRIMARY KEY (student_id)');
  assert.equal(S.describeConstraint(F.ticket, { kind: 'check', expr: 'price_paid >= 0' }), 'CHECK (price_paid >= 0)');
  assert.equal(S.describeConstraint(F.ticket, { kind: 'fk', column: 'student_id' }), 'REFERENCES Student(student_id)');
  assert.equal(S.describeConstraint(F.ticket, { kind: 'type', column: 'price_paid' }), 'must be a number');
});

test('toStudioSchema and nouns', () => {
  const s = S.toStudioSchema([F.student, F.ticket]);
  assert.deepEqual(s.tables[0], { name: 'Student', columns: ['student_id', 'first_name', 'last_name', 'email', 'is_active'].map(name => ({ name })) });
  assert.equal(s.relationships.length, 2);
  assert.equal(S.noun({ name: 'ConcertPerformer' }), 'concert performer');
  assert.equal(S.showValue(F.ticket.columns[3], 45), '45.00');
  assert.equal(S.showValue(F.student.columns[4], 1), 'true');
  assert.equal(S.showValue(F.student.columns[2], null), 'NULL');
});
