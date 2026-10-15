// Checks every data set against the rules in spec §7.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const QE = require('../src/engine.js');
const { loadDatasets } = require('./helpers.js');
const ANSWER_KEYS = require('./answer-keys.js');

const DATASETS = loadDatasets();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  const year = Number(s.slice(0, 4));
  return !isNaN(d) && d.toISOString().slice(0, 10) === s && year >= 2015 && year <= 2026;
}

test('data set ids are unique', () => {
  const ids = DATASETS.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('data set numbers are unique integers that match the file name prefix', () => {
  const files = fs.readdirSync(path.join(__dirname, '..', 'src', 'datasets')).filter(f => f.endsWith('.js')).sort();
  const nums = DATASETS.map(d => d.number);
  nums.forEach(n => assert.ok(Number.isInteger(n) && n >= 1, `number ${n} is a positive integer`));
  assert.equal(new Set(nums).size, nums.length);
  files.forEach((f, i) => assert.equal(DATASETS[i].number, parseInt(f.slice(0, 2), 10), `${f} has the matching number`));
});

test('there are exactly 10 data sets', () => {
  assert.equal(DATASETS.length, 10);
});

for (const ds of DATASETS) {
  test(`${ds.name}: basic shape`, () => {
    assert.match(ds.id, /^[a-z0-9-]+$/);
    assert.ok(ds.tables.length >= 2 && ds.tables.length <= 3, '2–3 tables');
    assert.ok(ds.tables.some(t => t.name === ds.start), 'start table exists');
    assert.equal(ds.description, ds.tables.map(t => t.name).join(' · '));
  });

  test(`${ds.name}: tables follow the rules`, () => {
    for (const t of ds.tables) {
      assert.ok(t.rows.length >= 8 && t.rows.length <= 25, `${t.name} has ${t.rows.length} rows (needs 8–25)`);
      const pks = t.columns.filter(c => c.key === 'pk');
      assert.equal(pks.length, 1, `${t.name} has exactly one primary key`);
      assert.match(pks[0].name, /_id$/, `${t.name} primary key ends in _id`);
      t.rows.forEach((r, i) => {
        assert.equal(r.length, t.columns.length, `${t.name} row ${i} has ${t.columns.length} values`);
        t.columns.forEach((c, j) => {
          const v = r[j];
          const where = `${t.name}.${c.name} row ${i}`;
          if (c.type === 'number') assert.ok(Number.isFinite(v), `${where} is a number`);
          if (c.type === 'text') assert.ok(typeof v === 'string' && v.length > 0 && v.trim() === v, `${where} is non-empty trimmed text`);
          if (c.type === 'date') assert.ok(validDate(v), `${where} is a real date from 2015–2026`);
          if (typeof v === 'string') assert.ok(!v.includes('`') && !v.includes('**'), `${where} has no \` or **`);
        });
      });
      const k = t.columns.indexOf(pks[0]);
      const ids = t.rows.map(r => r[k]);
      assert.equal(new Set(ids).size, ids.length, `${t.name} primary keys are unique`);
    }
  });

  test(`${ds.name}: foreign keys are valid and some row has no match`, () => {
    let noMatch = false;
    for (const t of ds.tables) {
      t.columns.forEach((c, j) => {
        if (c.key !== 'fk') return;
        const parent = ds.tables.find(p => p.name === c.ref);
        assert.ok(parent, `${t.name}.${c.name} points to a real table`);
        const p = parent.columns.findIndex(pc => pc.key === 'pk' && pc.name === c.name);
        assert.ok(p >= 0, `${t.name}.${c.name} has the same name as ${parent.name}'s primary key`);
        const parentIds = new Set(parent.rows.map(r => r[p]));
        const used = new Set(t.rows.map(r => r[j]));
        for (const v of used) assert.ok(parentIds.has(v), `${t.name}.${c.name} value ${v} exists in ${parent.name}`);
        if ([...parentIds].some(id => !used.has(id))) noMatch = true;
      });
    }
    assert.ok(noMatch, 'at least one row has no match in a related table');
  });

  test(`${ds.name}: column names and types`, () => {
    const nonKey = ds.tables.flatMap(t => t.columns.filter(c => !c.key).map(c => c.name));
    assert.equal(new Set(nonKey).size, nonKey.length, 'non-key column names are unique across tables');
    const types = new Set(ds.tables.flatMap(t => t.columns.filter(c => !c.key).map(c => c.type)));
    for (const type of ['text', 'number', 'date']) assert.ok(types.has(type), `has a ${type} column`);
  });

  test(`${ds.name}: three Try-this questions whose hints run`, () => {
    assert.equal(ds.questions.length, 3);
    const keyed = ANSWER_KEYS[ds.id];
    if (keyed) {
      assert.ok(ds.questions.every(q => !q.recipe), 'assessment data sets must not ship their recipes in the page');
      assert.equal(keyed.length, 3, 'answer key has one recipe per question');
    }
    ds.questions.forEach((q, i) => {
      const recipe = q.recipe || (keyed && keyed[i]);
      assert.ok(recipe, `"${q.text}" has a recipe (in the data set or test/answer-keys.js)`);
      const results = QE.runRecipe(ds, recipe);
      results.forEach((r, k) => assert.equal(r.status, 'ok', `"${q.text}" step ${k}: ${r.message}`));
      assert.ok(results[results.length - 1].table.rows.length > 0, `"${q.text}" gives at least one row`);
    });
  });
}
