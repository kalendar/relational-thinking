const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/progress.js');

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

test('defaults, round trip, and goals are only ever added', () => {
  const s = store();
  assert.deepEqual(P.loadProgress(s), { mode: 'form', levels: {} });
  let p = P.markGoals(P.loadProgress(s), 3, ['add', 'mu'], false);
  p.mode = 'sql';
  P.saveProgress(s, p);
  p = P.markGoals(P.loadProgress(s), 3, ['email'], true);
  p = P.markGoals(p, 3, [], false);
  assert.deepEqual(p.levels['3'], { goals: ['add', 'mu', 'email'], complete: true });
  assert.equal(P.loadProgress(s).mode, 'sql');
});

test('bad data and blocked storage fall back to defaults', () => {
  const s = store();
  s.setItem(P.PROGRESS_KEY, '{not json');
  assert.deepEqual(P.loadProgress(s), { mode: 'form', levels: {} });
  s.setItem(P.PROGRESS_KEY, JSON.stringify({ mode: 'voice', levels: { x: {}, 2: { goals: ['a', 5], complete: 'yes' } } }));
  assert.deepEqual(P.loadProgress(s), { mode: 'form', levels: { 2: { goals: ['a'], complete: false } } });
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(P.loadProgress(blocked), { mode: 'form', levels: {} });
  assert.equal(P.saveProgress(blocked, { mode: 'form', levels: {} }), false);
});
