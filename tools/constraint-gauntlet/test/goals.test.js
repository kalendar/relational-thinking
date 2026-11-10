const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/goals.js');

const rej = (table, kind, column, rule, akind = 'insert') => ({ outcome: 'rejected', table, kind: akind, rows: [], broken: [],
  error: { kind, columns: [column], chips: { rule } } });
const base = () => ({ log: [], predictions: {}, fixes: [], flags: {} });

test('each goal kind, met and not met', () => {
  const level = { id: 1, goals: [
    { id: 'a', kind: 'accepted', table: 'Student', match: { first_name: 'Chris' } },
    { id: 'b', kind: 'rejected-by', errorKind: 'unique', column: 'email' },
    { id: 'c', kind: 'slipped', rule: 'one-person' },
    { id: 'd', kind: 'predicted', predict: 'p' },
    { id: 'e', kind: 'fixed', table: 'Student' },
    { id: 'f', kind: 'flag', flag: 'batchClean' },
    { id: 'g', kind: 'state', check: st => st.log.length >= 3 },
    { id: 'h', kind: 'rejected-by', errorKind: 'fk-parent', attemptKind: 'update' },
    { id: 'i', kind: 'state', optional: true, check: () => false },
  ] };
  const st = base();
  assert.deepEqual(G.evaluate(level, st).filter(g => g.met).map(g => g.id), []);
  assert.equal(G.complete(level, st), false);
  st.log.push({ outcome: 'accepted', kind: 'insert', table: 'Student', rows: [{ first_name: 'Chris' }], broken: [] });
  st.log.push(rej('Student', 'unique', 'email', 'UNIQUE (email)'));
  st.log.push({ outcome: 'slipped', kind: 'insert', table: 'Student', rows: [{}], broken: ['one-person'] });
  st.log.push(rej('Ticket', 'fk-parent', 'student_id', 'REFERENCES', 'insert'));
  assert.equal(G.evaluate(level, st).find(g => g.id === 'h').met, false, 'an insert is not an update');
  st.log.push(rej('Ticket', 'fk-parent', 'student_id', 'REFERENCES', 'update'));
  st.predictions.p = 'no';
  st.fixes.push({ table: 'Student', optionId: 'x', passed: true });
  st.flags.batchClean = true;
  assert.deepEqual(G.evaluate(level, st).filter(g => !g.met).map(g => g.id), ['i']);
  assert.equal(G.complete(level, st), true, 'an optional goal does not block completion');
});

test('distinct counts columns or rules, not attempts', () => {
  const byCol = { id: 1, goals: [{ id: 'x', kind: 'rejected-by', errorKind: 'notnull', distinct: 3 }] };
  const byRule = { id: 1, goals: [{ id: 'x', kind: 'rejected-by', errorKind: 'check', distinct: 2, distinctBy: 'rule' }] };
  const st = base();
  st.log.push(rej('Ticket', 'notnull', 'price_paid', 'NOT NULL'), rej('Ticket', 'notnull', 'price_paid', 'NOT NULL'), rej('Ticket', 'notnull', 'purchase_date', 'NOT NULL'));
  assert.equal(G.complete(byCol, st), false);
  st.log.push(rej('Ticket', 'notnull', 'student_id', 'NOT NULL'));
  assert.equal(G.complete(byCol, st), true);
  st.log.push(rej('Ticket', 'check', 'quantity', 'CHECK (quantity BETWEEN 1 AND 10)'), rej('Ticket', 'check', 'quantity', 'CHECK (quantity BETWEEN 1 AND 10)'));
  assert.equal(G.complete(byRule, st), false);
  st.log.push(rej('Ticket', 'check', 'price_paid', 'CHECK (price_paid >= 0)'));
  assert.equal(G.complete(byRule, st), true);
});
