const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const Q = require('../src/randomq.js');
const { getSQL, loadAllDatasets } = require('./helpers.js');

const all = loadAllDatasets();
const sample = all.find(d => d.number === 0);

async function open() {
  return D.openStudio(await getSQL(), S.buildSchema(sample));
}
const col = (r, i = 0) => r.rows.map(x => x[i]);

test('data set 0 is "Ch 8 and 9 Sample Data" and comes first', () => {
  assert.ok(sample, 'tools/sql-studio/datasets/ has a data set numbered 0');
  assert.equal(sample.name, 'Ch 8 and 9 Sample Data');
  assert.equal(all[0], sample);
  assert.deepEqual(all.map(d => d.number), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("it has Chapter 8's four tables and columns, with at least 50 rows in all", () => {
  const shape = Object.fromEntries(sample.tables.map(t => [t.name, t.columns.map(c => c.name)]));
  assert.deepEqual(shape, {
    Artist: ['artist_id', 'artist_name', 'genre', 'hometown'],
    Song: ['song_id', 'song_title', 'artist_id', 'duration_seconds', 'explicit', 'release_date'],
    User: ['user_id', 'username', 'email', 'subscription_tier', 'signup_date'],
    Stream: ['stream_id', 'user_id', 'song_id', 'stream_date', 'seconds_listened'],
  });
  assert.ok(sample.tables.reduce((n, t) => n + t.rows.length, 0) >= 50);
  assert.equal(sample.tables.find(t => t.name === 'Song').columns.find(c => c.name === 'explicit').type, 'boolean');
});

test('the ERD gets the three relationships from Chapter 8, and every foreign key finds its row', async () => {
  const st = await open();
  assert.deepEqual(st.schema.relationships.map(r => `${r.from.table}.${r.from.column}->${r.to.table}`).sort(),
    ['Song.artist_id->Artist', 'Stream.song_id->Song', 'Stream.user_id->User']);
  assert.equal(st.db.exec('PRAGMA foreign_key_check').length, 0);
  D.closeStudio(st);
});

test("Chapter 8's WHERE examples work on this data", async () => {
  const st = await open();
  const run = sql => { const r = D.runQuery(st, sql); assert.equal(r.ok, true, `${sql}\n${r.error && r.error.message}`); return r; };
  // The "complete example": pop, released in 2024, under 3 minutes, not explicit.
  assert.deepEqual(col(run("SELECT song_title FROM Song s JOIN Artist a ON a.artist_id = s.artist_id WHERE genre = 'Pop' AND release_date BETWEEN '2024-01-01' AND '2024-12-31' AND duration_seconds < 180 AND explicit = false")), ['Espresso']);
  assert.ok(run("SELECT artist_name FROM Artist WHERE artist_name LIKE 'The %'").rows.length >= 2);
  assert.ok(run("SELECT song_title FROM Song WHERE song_title LIKE '%Love%'").rows.length >= 2);
  assert.ok(run('SELECT artist_name FROM Artist WHERE hometown IS NULL').rows.length >= 2);
  const explicit = run('SELECT COUNT(*) FROM Song WHERE explicit = true').rows[0][0];
  const clean = run('SELECT COUNT(*) FROM Song WHERE NOT explicit').rows[0][0];
  assert.ok(explicit > 0 && clean > 0);
  assert.equal(explicit + clean, run('SELECT COUNT(*) FROM Song').rows[0][0]);
  assert.ok(run("SELECT * FROM Artist WHERE genre IN ('Pop', 'R&B', 'Hip-Hop')").rows.length >= 5);
  assert.ok(run('SELECT * FROM Song WHERE duration_seconds BETWEEN 180 AND 240').rows.length >= 5);
  D.closeStudio(st);
});

test("Chapter 9's join examples work on this data", async () => {
  const st = await open();
  const run = sql => D.runQuery(st, sql);
  // The excerpt: songs 1–3 and streams 101–103.
  assert.deepEqual(run('SELECT song_id, song_title, artist_id FROM Song WHERE song_id <= 3 ORDER BY song_id').rows,
    [[1, 'Espresso', 10], [2, 'Cruel Summer', 11], [3, 'Paint the Town Red', 12]]);
  assert.deepEqual(run('SELECT stream_id, song_id, stream_date FROM Stream WHERE stream_id <= 103 ORDER BY stream_id').rows,
    [[101, 1, '2026-03-15'], [102, 1, '2026-03-16'], [103, 2, '2026-03-17']]);
  // LEFT JOIN finds songs never streamed; INNER JOIN drops them.
  const never = col(run('SELECT s.song_title FROM Song s LEFT JOIN Stream st ON s.song_id = st.song_id WHERE st.stream_date IS NULL'));
  assert.ok(never.includes('Paint the Town Red'));
  assert.ok(!col(run('SELECT DISTINCT s.song_title FROM Song s INNER JOIN Stream st ON s.song_id = st.song_id')).includes('Paint the Town Red'));
  // Someone has signed up but never streamed, and some artists have no songs yet.
  assert.ok(run('SELECT u.user_id FROM User u LEFT JOIN Stream st ON st.user_id = u.user_id WHERE st.stream_id IS NULL').rows.length >= 1);
  assert.ok(run('SELECT a.artist_id FROM Artist a LEFT JOIN Song s ON s.artist_id = a.artist_id WHERE s.song_id IS NULL').rows.length >= 1);
  // COUNT(column) ignores NULLs: some listening times are missing.
  const [[all, counted]] = run('SELECT COUNT(*), COUNT(seconds_listened) FROM Stream').rows;
  assert.ok(counted < all);
  // Nobody listens longer than the song.
  assert.equal(run('SELECT COUNT(*) FROM Stream st JOIN Song s ON s.song_id = st.song_id WHERE st.seconds_listened > s.duration_seconds').rows[0][0], 0);
  D.closeStudio(st);
});

test('random queries on data set 0 all run', async () => {
  const st = await open();
  const run = sql => D.runQuery(st, sql);
  for (let i = 0; i < 300; i++) {
    const rnd = Q.mulberry32(i + 17);
    const options = Object.fromEntries(Q.FEATURES.map(f => [f, rnd() < 0.5]));
    const g = Q.generateQuery({ schema: st.schema, run, options, seed: 9000 + i });
    assert.equal(g.errors, 0, g.sql);
    assert.equal(run(g.sql.replace(/;\s*$/, '')).ok, true, g.sql);
  }
  D.closeStudio(st);
});

test('random WHERE conditions on a true/false column read as = TRUE or = FALSE', async () => {
  const st = await open();
  const run = sql => D.runQuery(st, sql);
  const seen = [];
  for (let i = 0; i < 400; i++) {
    const g = Q.generateQuery({ schema: st.schema, run, options: { where: true, andOr: true }, seed: 300 + i });
    for (const m of g.sql.matchAll(/\bexplicit\b[^\n]*/g)) if (/WHERE|AND|OR/.test(m.input.slice(Math.max(0, m.index - 12), m.index))) seen.push(m[0]);
  }
  assert.ok(seen.length > 0, 'some random query filtered on explicit');
  for (const c of seen) assert.match(c, /^explicit = (TRUE|FALSE);?$/, c);
  D.closeStudio(st);
});

test('exactly two songs have never been streamed: Paint the Town Red and Pink Skies', async () => {
  const st = await open();
  const r = D.runQuery(st, 'SELECT s.song_title FROM Song s LEFT JOIN Stream st ON s.song_id = st.song_id WHERE st.stream_id IS NULL ORDER BY s.song_id');
  assert.deepEqual(col(r), ['Paint the Town Red', 'Pink Skies']);
  D.closeStudio(st);
});
