const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/rules.js');
const D = require('../src/db.js');
const { getSQL } = require('./helpers.js');
const F = require('./fixtures.js');

test('isBlank: empty and all-space text are blank; 0 and false are not', () => {
  for (const v of [null, undefined, '', '   ']) assert.equal(R.isBlank(v), true, JSON.stringify(v));
  for (const v of [0, false, 'a', ' a ']) assert.equal(R.isBlank(v), false, JSON.stringify(v));
});

test('a duplicate-person rule ignores ctx.self; a throwing rule counts as broken', async () => {
  const g = D.openLevel(await getSQL(), F.level);
  const level = { id: 1, rules: [
    { id: 'one-person', table: 'Student', text: 'one person per email',
      check: (row, ctx) => !ctx.query('SELECT rowid AS _rowid FROM Student WHERE lower(email) = lower(?)', [row.email]).some(r => r._rowid !== ctx.self) },
    { id: 'boom', table: 'Ticket', text: 'throws', check: () => { throw new Error('bug'); } },
  ] };
  const jordan = D.tableRows(g, 'Student').find(r => r.student_id === 2);
  assert.deepEqual(R.brokenRules(level, 'Student', { email: 'JLEE@marshall.edu' }, R.makeCtx(g)), ['one-person']);
  assert.deepEqual(R.brokenRules(level, 'Student', jordan, R.makeCtx(g, jordan._rowid)), [], 'its own row is ignored');
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(R.brokenRules(level, 'Ticket', {}, R.makeCtx(g)), ['boom']); } finally { console.warn = warn; }
  assert.equal(R.ruleText(level, 'one-person'), 'one person per email');
});
