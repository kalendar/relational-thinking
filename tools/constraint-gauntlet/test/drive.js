// Plays a level's scripted solution through the session, checking each step's `expect`.
const assert = require('node:assert/strict');
const { createSession } = require('../src/session.js');

function playSolution(SQL, level) {
  const s = createSession(SQL, level);
  const results = [];
  (level.solution || []).forEach((step, i) => {
    const where = `Level ${level.id}, solution step ${i + 1} (${JSON.stringify(step).slice(0, 120)})`;
    let r;
    if (step.sql !== undefined) {
      r = s.run(step.sql);
      assert.equal(r.type, 'attempt', `${where}: expected an attempt, got ${r.type} ${JSON.stringify(r.explained || r.message || '')}`);
      if (step.expect) assert.equal(r.attempt.outcome, step.expect, `${where}: ${r.attempt.error ? r.attempt.error.headline : ''}`);
    } else if (step.form) {
      r = s.runForm(...step.form);
      if (step.expect) assert.equal(r.attempt && r.attempt.outcome, step.expect, where);
    } else if (step.runAll) {
      r = s.runAll(step.runAll);
      if (step.expect) assert.deepEqual(r.map(x => x.attempt && x.attempt.outcome), step.expect, where);
    } else if (step.predict) {
      r = s.predict(...step.predict);
      if (step.expect) assert.equal(r.correct, step.expect === 'correct', where);
    } else if (step.variant !== undefined) {
      r = s.switchVariant(step.variant);
    } else if (step.tryFix) {
      r = s.tryFix(step.tryFix);
      if (step.expect) assert.equal(r.passed, step.expect === 'passed', `${where}: ${r.error || JSON.stringify(r.rows.filter(x => !x.ok))}`);
    } else if (step.applyFix) {
      if (step.expect === 'rows-then-ok' || step.expect === 'orphans-then-ok') {
        const first = s.applyFix(step.applyFix);
        assert.equal(first.ok, false, `${where}: expected the live data to block the fix first`);
        assert.equal(first.reason, step.expect.split('-')[0], where);
        r = s.applyFix(step.applyFix, { cleanup: step.cleanup || 'delete' });
      } else r = s.applyFix(step.applyFix, { cleanup: step.cleanup || null });
      assert.equal(r.ok, true, `${where}: ${JSON.stringify(r)}`);
    } else if (step.decide) {
      r = s.decide(step.decide);
      if (step.expect) assert.equal(r.clean, step.expect === 'clean', `${where}: ${JSON.stringify(r)}`);
    } else if (step.policies) {
      r = s.setPolicies(step.policies);
      assert.equal(r.ok, true, where);
    } else if (step.soft) {
      r = s.softDelete(...step.soft);
    } else if (step.judge) {
      r = s.judgePolicies(step.judge);
      if (step.expect) assert.equal(r.passed, step.expect === 'passed', `${where}: ${JSON.stringify(r.rows)}`);
    } else if (step.resetData) {
      r = s.resetData();
    } else if (step.flag) {
      s.setFlag(step.flag);
    } else throw new Error(`${where}: unknown step type`);
    results.push(r);
  });
  return { session: s, results };
}

module.exports = { playSolution };
