// Pins down the SQLite behaviors the Gauntlet is built on (spec §4). If an sql.js upgrade changes
// one of these, this file fails before students see a wrong lesson.
const test = require('node:test');
const assert = require('node:assert/strict');
const { getSQL, attempt, one } = require('./helpers.js');

async function fresh() { const SQL = await getSQL(); return new SQL.Database(); }

test('foreign keys are off until turned on, and the pragma is ignored inside a transaction', async () => {
  const db = await fresh();
  assert.equal(one(db, 'PRAGMA foreign_keys'), 0);
  db.run('BEGIN'); db.run('PRAGMA foreign_keys = ON');
  assert.equal(one(db, 'PRAGMA foreign_keys'), 0, 'ignored inside a transaction');
  db.run('ROLLBACK'); db.run('PRAGMA foreign_keys = ON');
  assert.equal(one(db, 'PRAGMA foreign_keys'), 1);
});

test('the foreign key error names nothing', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE P(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE C(id INT NOT NULL PRIMARY KEY, p INT REFERENCES P(id))');
  assert.equal(attempt(db, 'INSERT INTO C VALUES (1, 99)'), 'FOREIGN KEY constraint failed');
});

test('text goes into DECIMAL and passes CHECK (x >= 0); the hidden type check stops it but allows NULL', async () => {
  const db = await fresh();
  db.run('CREATE TABLE A(p DECIMAL(8,2) CHECK (p >= 0))');
  assert.equal(attempt(db, "INSERT INTO A VALUES ('free')"), 'OK');
  db.run("CREATE TABLE B(p DECIMAL(8,2) CONSTRAINT cg_type_p CHECK (p IS NULL OR typeof(p) IN ('integer','real')))");
  assert.equal(attempt(db, "INSERT INTO B VALUES ('free')"), 'CHECK constraint failed: cg_type_p');
  assert.equal(attempt(db, 'INSERT INTO B VALUES (NULL)'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO B VALUES (12.5)'), 'OK');
});

test('a hidden type check without IS NULL OR would wrongly block NULL', async () => {
  const db = await fresh();
  db.run("CREATE TABLE C(p DECIMAL(8,2) CONSTRAINT cg_type_p CHECK (typeof(p) IN ('integer','real')))");
  assert.equal(attempt(db, 'INSERT INTO C VALUES (NULL)'), 'CHECK constraint failed: cg_type_p');
});

test('changes() counts only the parent row of a cascade', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE P(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE C(id INT NOT NULL PRIMARY KEY, p INT REFERENCES P(id) ON DELETE CASCADE)');
  db.run('INSERT INTO P VALUES (1)'); db.run('INSERT INTO C VALUES (1,1),(2,1),(3,1)');
  db.run('DELETE FROM P WHERE id = 1');
  assert.equal(db.getRowsModified(), 1);
  assert.equal(one(db, 'SELECT COUNT(*) FROM C'), 0);
});

test('a CASCADE that runs into a RESTRICT further down is blocked as a whole', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE S(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE T(id INT NOT NULL PRIMARY KEY, s INT REFERENCES S(id) ON DELETE CASCADE)');
  db.run('CREATE TABLE X(id INT NOT NULL PRIMARY KEY, t INT NOT NULL REFERENCES T(id) ON DELETE RESTRICT)');
  db.run('INSERT INTO S VALUES (1)'); db.run('INSERT INTO T VALUES (1,1),(2,1)'); db.run('INSERT INTO X VALUES (1,1)');
  assert.equal(attempt(db, 'DELETE FROM S WHERE id = 1'), 'FOREIGN KEY constraint failed');
  assert.equal(one(db, 'SELECT COUNT(*) FROM S'), 1);
  assert.equal(one(db, 'SELECT COUNT(*) FROM T'), 2);
});

test('SET NULL on a NOT NULL column fails with a NOT NULL error, not an FK error', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE S(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE T(id INT NOT NULL PRIMARY KEY, s INT NOT NULL REFERENCES S(id) ON DELETE SET NULL)');
  db.run('INSERT INTO S VALUES (1)'); db.run('INSERT INTO T VALUES (1,1)');
  assert.equal(attempt(db, 'DELETE FROM S WHERE id = 1'), 'NOT NULL constraint failed: T.s');
});

test('UNIQUE allows many NULLs, is case-sensitive, and COLLATE NOCASE fixes that', async () => {
  const db = await fresh();
  db.run('CREATE TABLE S(e TEXT UNIQUE)');
  assert.equal(attempt(db, 'INSERT INTO S VALUES (NULL)'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO S VALUES (NULL)'), 'OK');
  db.run("INSERT INTO S VALUES ('taylor@marshall.edu')");
  assert.equal(attempt(db, "INSERT INTO S VALUES ('Taylor@marshall.edu')"), 'OK');
  db.run('CREATE TABLE N(e TEXT UNIQUE COLLATE NOCASE)');
  db.run("INSERT INTO N VALUES ('taylor@marshall.edu')");
  assert.equal(attempt(db, "INSERT INTO N VALUES ('Taylor@marshall.edu')"), 'UNIQUE constraint failed: N.e');
});

test("LIKE '%@%' accepts a lone @; '_%@_%._%' does not", async () => {
  const db = await fresh();
  assert.equal(one(db, "SELECT '@' LIKE '%@%'"), 1);
  assert.equal(one(db, "SELECT '@' LIKE '_%@_%._%'"), 0);
  assert.equal(one(db, "SELECT 'a@b' LIKE '_%@_%._%'"), 0);
  assert.equal(one(db, "SELECT 'jlee@marshall.edu' LIKE '_%@_%._%'"), 1);
});

test('IN is case-sensitive', async () => {
  const db = await fresh();
  db.run("CREATE TABLE T(s TEXT CHECK (s IN ('Floor','Lawn')))");
  assert.match(attempt(db, "INSERT INTO T VALUES ('floor')"), /^CHECK constraint failed/);
});

test('INT PRIMARY KEY accepts NULL twice unless NOT NULL is written', async () => {
  const db = await fresh();
  db.run('CREATE TABLE A(id INT PRIMARY KEY)');
  assert.equal(attempt(db, 'INSERT INTO A VALUES (NULL)'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO A VALUES (NULL)'), 'OK');
  db.run('CREATE TABLE B(id INT NOT NULL PRIMARY KEY)');
  assert.equal(attempt(db, 'INSERT INTO B VALUES (NULL)'), 'NOT NULL constraint failed: B.id');
});

test('error message formats the tool relies on', async () => {
  const db = await fresh();
  db.run(`CREATE TABLE Concert(concert_id INT NOT NULL PRIMARY KEY, venue_id INT, concert_date TEXT,
    start_time TEXT, end_time TEXT, UNIQUE (venue_id, concert_date),
    CONSTRAINT ends_after_start CHECK (end_time > start_time))`);
  db.run("INSERT INTO Concert VALUES (1, 3, '2027-02-14', '19:00', '22:00')");
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (1, 4, '2027-02-15', '19:00', '22:00')"), 'UNIQUE constraint failed: Concert.concert_id');
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (2, 3, '2027-02-14', '19:00', '22:00')"), 'UNIQUE constraint failed: Concert.venue_id, Concert.concert_date');
  assert.equal(attempt(db, "INSERT INTO Concert VALUES (3, 3, '2027-02-15', '19:00', '18:00')"), 'CHECK constraint failed: ends_after_start');
  db.run('CREATE TABLE P(price DECIMAL(8,2) NOT NULL CHECK (price >= 0))');
  assert.equal(attempt(db, 'INSERT INTO P VALUES (-5)'), 'CHECK constraint failed: price >= 0');
  assert.equal(attempt(db, 'INSERT INTO P VALUES (NULL)'), 'NOT NULL constraint failed: P.price');
});

test('a TEMP table with the same name hides the main table, even in qualified references', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE Student(student_id INT NOT NULL PRIMARY KEY, email TEXT NOT NULL UNIQUE)');
  db.run("INSERT INTO Student VALUES (1, 'a@x.edu'), (2, 'b@x.edu')");
  db.run('CREATE TEMP TABLE Student(student_id INT, email TEXT)');
  db.run('INSERT INTO temp.Student (rowid, student_id, email) SELECT rowid, student_id, email FROM main.Student');
  assert.equal(attempt(db, "INSERT INTO Student VALUES (3, 'a@x.edu')"), 'OK', 'the copy has no UNIQUE');
  assert.equal(attempt(db, "UPDATE Student SET email = 'z' WHERE Student.student_id = 2"), 'OK');
  assert.equal(one(db, 'SELECT COUNT(*) FROM main.Student'), 2);
  assert.equal(one(db, "SELECT email FROM main.Student WHERE student_id = 2"), 'b@x.edu');
  db.run('DROP TABLE temp.Student');
  assert.equal(one(db, 'SELECT COUNT(*) FROM Student'), 2, 'the name points at the real table again');
  assert.equal(one(db, 'PRAGMA foreign_keys'), 1);
});

test('the rebuild procedure keeps rows, and foreign_key_check finds orphans before commit', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  db.run('CREATE TABLE P(id INT NOT NULL PRIMARY KEY)');
  db.run('CREATE TABLE C(id INT NOT NULL PRIMARY KEY, p INT NOT NULL)');
  db.run('INSERT INTO P VALUES (1)'); db.run('INSERT INTO C VALUES (1, 1), (2, 99)');
  db.run('PRAGMA foreign_keys = OFF'); db.run('BEGIN');
  db.run('CREATE TABLE cg_new_C(id INT NOT NULL PRIMARY KEY, p INT NOT NULL REFERENCES P(id))');
  db.run('INSERT INTO cg_new_C SELECT * FROM C'); db.run('DROP TABLE C'); db.run('ALTER TABLE cg_new_C RENAME TO C');
  const bad = db.exec('PRAGMA foreign_key_check')[0].values;
  assert.deepEqual(bad.map(r => [r[0], r[2]]), [['C', 'P']]);
  db.run('ROLLBACK'); db.run('PRAGMA foreign_keys = ON');
  assert.equal(one(db, 'SELECT COUNT(*) FROM C'), 2);
  assert.doesNotMatch(one(db, "SELECT sql FROM sqlite_master WHERE name = 'C'"), /REFERENCES/);
});

test('a REFERENCES to a table created later is allowed (Level 7 bonus: Team and Player)', async () => {
  const db = await fresh(); db.run('PRAGMA foreign_keys = ON');
  assert.equal(attempt(db, 'CREATE TABLE Team(team_id INT NOT NULL PRIMARY KEY, captain_id INT NOT NULL REFERENCES Player(player_id))'), 'OK');
  assert.equal(attempt(db, 'CREATE TABLE Player(player_id INT NOT NULL PRIMARY KEY, team_id INT NOT NULL REFERENCES Team(team_id))'), 'OK');
  assert.equal(attempt(db, 'INSERT INTO Team VALUES (1, 1)'), 'FOREIGN KEY constraint failed');
  assert.equal(attempt(db, 'INSERT INTO Player VALUES (1, 1)'), 'FOREIGN KEY constraint failed');
});

test('booleans: true and false read as 1 and 0', async () => {
  const db = await fresh();
  assert.equal(one(db, 'SELECT true'), 1);
  assert.equal(one(db, 'SELECT false'), 0);
});
