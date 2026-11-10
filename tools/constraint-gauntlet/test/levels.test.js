// Checks every level file: schema and seed, scripted solution, test rows, fixes, concept order, wording.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getSQL } = require('./helpers.js');
const { playSolution } = require('./drive.js');
const { createSession } = require('../src/session.js');
const { sortLevels } = require('../src/levels-index.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const RU = require('../src/rules.js');
const RB = require('../src/rebuild.js');
const G = require('../src/goals.js');

const DIR = path.join(__dirname, '..', 'src', 'levels');
const LEVELS = sortLevels(fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().map(f => require(path.join(DIR, f)).level));
const fixesOf = l => (!l.fix ? [] : Array.isArray(l.fix) ? l.fix : [l.fix]);
const allTables = l => [l.tables, ...Object.values(l.variants || {}).map(v => v.tables)];

function strings(l) {
  const out = [l.title, l.mission, l.done];
  (l.goals || []).forEach(g => out.push(g.text));
  (l.rules || []).forEach(r => out.push(r.text));
  (l.predict || []).forEach(p => { out.push(p.question); if (typeof p.why === 'string') out.push(p.why); (p.choices || []).forEach(c => out.push(c.text)); });
  fixesOf(l).forEach(f => (f.options || []).forEach(o => out.push(o.why)));
  (l.decisions || []).forEach(d => out.push(d.why));
  (l.policyKey || []).forEach(k => Object.values(k.notes || {}).forEach(n => out.push(n)));
  (l.cards || []).forEach(c => out.push(c.label));
  return out.filter(x => typeof x === 'string');
}

test('there are eight levels, numbered 1-8', () => {
  assert.deepEqual(LEVELS.map(l => l.id), [1, 2, 3, 4, 5, 6, 7, 8]);
});

for (const level of LEVELS) {
  test(`Level ${level.id} (${level.title}): schema and seed load with foreign keys on, in every variant`, async () => {
    const SQL = await getSQL();
    for (const v of [null, ...Object.keys(level.variants || {})]) {
      const g = D.openLevel(SQL, level, { variant: v });
      assert.equal(D.fkOn(g.db), true);
      D.closeLevel(g);
    }
  });

  test(`Level ${level.id}: the scripted solution completes the level`, async () => {
    const { session } = playSolution(await getSQL(), level);
    const unmet = session.goals().filter(g => !g.met && !g.optional).map(g => g.id);
    assert.deepEqual(unmet, [], `unmet goals: ${unmet.join(', ')}`);
    assert.equal(session.complete(), true);
    const optional = session.goals().filter(g => g.optional && !g.met).map(g => g.id);
    assert.deepEqual(optional, [], 'the solution should reach the bonus goals too');
  });

  test(`Level ${level.id}: legit rows break no rules; bad rows break at least one`, async () => {
    const SQL = await getSQL();
    const g = D.openLevel(SQL, level);
    for (const r of level.legitRows || []) assert.deepEqual(RU.brokenRules(level, r.table, r.row, RU.makeCtx(g)), [], `legit: ${r.note}`);
    for (const r of level.badRows || []) assert.ok(RU.brokenRules(level, r.table, r.row, RU.makeCtx(g)).length > 0, `bad: ${r.note}`);
    D.closeLevel(g);
  });

  test(`Level ${level.id}: correct fixes pass the fix test and wrong ones fail on a named row`, async () => {
    const SQL = await getSQL();
    for (const fx of fixesOf(level)) {
      if (fx.test === false) continue;
      const base = fx.base ? level.variants[fx.base].tables : level.tables;
      const def = S.findTable(base, fx.table);
      const run = newDef => RB.fixTest(SQL, Object.assign({}, level, { tables: base }), base.map(t => (t.name === fx.table ? newDef : t)), fx.table, []);
      for (const o of fx.options || []) {
        const r = run(RB.applyOption(def, o));
        assert.equal(r.passed, o.correct, `${fx.table} option ${o.id}: ${JSON.stringify(r.rows.filter(x => !x.ok))}`);
        if (!o.correct) assert.ok(r.rows.some(x => !x.ok && x.label), `${fx.table} option ${o.id} should fail on a named row`);
      }
      if (fx.reference) assert.equal(run(RB.withCheck(def, fx.column, fx.reference)).passed, true, `${fx.table} reference ${fx.reference}`);
      for (const w of fx.wrong || []) assert.equal(run(RB.withCheck(def, fx.column, w)).passed, false, `${fx.table} wrong ${w}`);
    }
  });

  test(`Level ${level.id}: concept order, predictions, goals, hidden checks, and wording`, async () => {
    if (level.section === '11.1') {
      for (const ts of allTables(level)) for (const t of ts) assert.ok(!t.columns.some(c => c.fk), `11.1 levels use no REFERENCES (${t.name})`);
    }
    const s = createSession(await getSQL(), level);
    for (const p of level.predict || []) {
      const answer = typeof p.answer === 'function' ? p.answer(s) : p.answer;
      assert.ok(p.choices.some(c => c.id === answer), `prediction ${p.id}: answer ${answer} is not a choice`);
    }
    const ruleIds = new Set((level.rules || []).map(r => r.id));
    const ids = new Set();
    for (const g of level.goals) {
      assert.ok(!ids.has(g.id), `duplicate goal id ${g.id}`); ids.add(g.id);
      assert.ok(G.GOAL_KINDS.includes(g.kind), `goal ${g.id}: unknown kind ${g.kind}`);
      if (g.rule) assert.ok(ruleIds.has(g.rule), `goal ${g.id}: no rule ${g.rule}`);
      if (g.predict) assert.ok((level.predict || []).some(p => p.id === g.predict), `goal ${g.id}: no prediction ${g.predict}`);
    }
    for (const ts of allTables(level)) for (const t of ts) assert.doesNotMatch(S.createTableSql(t, { hidden: false }), /cg_/);
    for (const str of strings(level)) {
      for (const sentence of str.replace(/`[^`]*`/g, 'x').split(/(?<=[.!?])\s+/)) {
        const words = sentence.split(/\s+/).filter(Boolean).length;
        assert.ok(words <= 25, `Level ${level.id}: sentence over 25 words (${words}): "${sentence}"`);
      }
    }
    s.close();
  });
}
