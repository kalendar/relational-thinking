const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../src/exercises.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const datasets = loadDatasets();
const stripSemi = s => s.replace(/;\s*$/, '');

test('every data set has 5–6 exercises, keyed by id', () => {
  assert.deepEqual(Object.keys(X.EXERCISES).sort(), datasets.map(d => d.id).sort());
  for (const d of datasets) {
    const n = X.EXERCISES[d.id].length;
    assert.ok(n >= 5 && n <= 6, `${d.id} has ${n}`);
  }
});

test('the first three exercises match the Query Explorer questions and notes exactly', () => {
  for (const d of datasets) {
    d.questions.forEach((q, i) => {
      const ex = X.EXERCISES[d.id][i];
      assert.equal(ex.text, q.text, `${d.id} ${i + 1}`);
      assert.equal(ex.note || '', q.note || '', `${d.id} ${i + 1} note`);
    });
  }
});

test('practice sets (1–6) all have hints; assessment sets (7–10) have none', () => {
  for (const d of datasets) {
    for (const ex of X.EXERCISES[d.id]) {
      if (X.isAssessment(d.number)) assert.equal(ex.hint, undefined, `${d.id}: ${ex.text}`);
      else assert.ok(ex.hint && ex.hint.length > 10, `${d.id}: ${ex.text}`);
    }
  }
  assert.equal(X.isAssessment(6), false);
  assert.equal(X.isAssessment(7), true);
});

test('hints never contain the answer query', () => {
  for (const list of Object.values(X.EXERCISES)) for (const ex of list) {
    if (ex.hint) assert.ok(!/SELECT\s+\S+.*FROM/i.test(ex.hint), ex.text);
  }
});

test('every answer runs and returns at least one row', async () => {
  const SQL = await getSQL();
  for (const d of datasets) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    for (const ex of X.EXERCISES[d.id]) {
      const r = D.runQuery(st, stripSemi(ex.answer));
      assert.equal(r.ok, true, `${d.id}: ${ex.text}\n${r.error && r.error.message}`);
      assert.ok(r.rows.length > 0, `${d.id}: ${ex.text} returned no rows`);
    }
    D.closeStudio(st);
  }
});

test('answers with orderMatters have exactly one correct order (no ties)', async () => {
  const SQL = await getSQL();
  for (const d of datasets) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    for (const ex of X.EXERCISES[d.id].filter(e => e.orderMatters)) {
      assert.match(ex.answer, /ORDER BY/i, ex.text);
      const normal = D.runQuery(st, stripSemi(ex.answer));
      st.db.run('PRAGMA reverse_unordered_selects = ON');
      const reversed = D.runQuery(st, stripSemi(ex.answer));
      st.db.run('PRAGMA reverse_unordered_selects = OFF');
      assert.deepEqual(reversed.rows, normal.rows, `${d.id}: ${ex.text} has ties in its ORDER BY`);
    }
    D.closeStudio(st);
  }
});

test('exerciseLabel numbers like the Query Explorer', () => {
  assert.equal(X.exerciseLabel(1, 0), '1.1');
  assert.equal(X.exerciseLabel(10, 5), '10.6');
});
