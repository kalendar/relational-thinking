const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/prefs.js');

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test('defaults when nothing is saved', () => {
  const p = P.loadPrefs(memoryStorage());
  assert.equal(p.sqlWidth, 0.5);
  assert.equal(p.collapsed.exercises, true);
  assert.equal(p.tidyOnRun, true);
  assert.equal(p.random.join, true);
});

test('round trip through storage', () => {
  const s = memoryStorage();
  const p = P.loadPrefs(s);
  p.sqlWidth = 0.6;
  p.collapsed.erd = true;
  p.zoom.results = 130;
  assert.equal(P.savePrefs(s, p), true);
  const back = P.loadPrefs(s);
  assert.equal(back.sqlWidth, 0.6);
  assert.equal(back.collapsed.erd, true);
  assert.equal(back.zoom.results, 130);
});

test('bad JSON, wrong types, and out-of-range values fall back', () => {
  const s = memoryStorage();
  s.setItem(P.STORAGE_KEY, '{not json');
  assert.deepEqual(P.loadPrefs(s), P.sanitizePrefs({}));
  const p = P.sanitizePrefs({ sqlWidth: 5, zoom: { sql: 999, results: 'big' }, collapsed: { sql: 'yes' }, erdZoom: 3, random: { having: true } });
  assert.equal(p.sqlWidth, 0.8);
  assert.equal(p.zoom.sql, 200);
  assert.equal(p.zoom.results, 100);
  assert.equal(p.collapsed.sql, false);
  assert.equal(p.erdZoom, 30);
  assert.equal(p.random.groupBy, true, 'HAVING pulls in GROUP BY');
});

test('blocked storage: load gives defaults, save returns false, nothing throws', () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.deepEqual(P.loadPrefs(blocked), P.sanitizePrefs({}));
  assert.equal(P.savePrefs(blocked, P.sanitizePrefs({})), false);
  assert.equal(P.savePrefs(null, P.sanitizePrefs({})), false);
});

test('stepZoom moves by 10 and stops at the ends', () => {
  assert.equal(P.stepZoom(100, 1), 110);
  assert.equal(P.stepZoom(200, 1), 200);
  assert.equal(P.stepZoom(70, -1), 70);
  assert.equal(P.stepZoom(30, -1, P.ERD_ZOOM), 30);
});

test('"Add mistakes to fix" is off by default, saved, and only true/false', () => {
  assert.equal(P.sanitizePrefs({}).mistakes, false);
  assert.equal(P.sanitizePrefs({ mistakes: true }).mistakes, true);
  assert.equal(P.sanitizePrefs({ mistakes: 'yes' }).mistakes, false);
  const s = memoryStorage();
  P.savePrefs(s, Object.assign(P.sanitizePrefs({}), { mistakes: true }));
  assert.equal(P.loadPrefs(s).mistakes, true);
});
