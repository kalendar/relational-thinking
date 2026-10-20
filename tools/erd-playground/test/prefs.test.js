const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/prefs.js');

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('defaults and the storage key', () => {
  assert.equal(P.STORAGE_KEY, 'erdPlayground.layout.v1');
  assert.deepEqual(P.loadPrefs(memory()), P.DEFAULT_PREFS);
  assert.deepEqual(P.DEFAULT_PREFS, { notationWidth: 0.42, height: 560, collapsed: { notation: false, diagram: false }, zoom: { notation: 100 }, diagramZoom: 100, cheatSheetOpen: false });
});

test('round trip', () => {
  const s = memory();
  const p = P.loadPrefs(s);
  p.notationWidth = 0.5; p.collapsed.diagram = true; p.zoom.notation = 130; p.diagramZoom = 80; p.cheatSheetOpen = true;
  assert.equal(P.savePrefs(s, p), true);
  assert.deepEqual(P.loadPrefs(s), p);
});

test('out-of-range and wrong-type values fall back or clamp', () => {
  const p = P.sanitizePrefs({ notationWidth: 9, height: -5, zoom: { notation: 333 }, diagramZoom: 'big', collapsed: { notation: 'yes' }, cheatSheetOpen: 1 });
  assert.equal(p.notationWidth, 0.8);
  assert.equal(p.height, 320);
  assert.equal(p.zoom.notation, 200);
  assert.equal(p.diagramZoom, 100);
  assert.equal(p.collapsed.notation, false);
  assert.equal(p.cheatSheetOpen, false);
  assert.equal(P.sanitizePrefs({ zoom: { notation: 104 } }).zoom.notation, 100, 'snaps to steps of 10');
});

test('bad JSON and blocked storage never throw', () => {
  const s = memory();
  s.setItem(P.STORAGE_KEY, '{oops');
  assert.deepEqual(P.loadPrefs(s), P.DEFAULT_PREFS);
  const blocked = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.deepEqual(P.loadPrefs(blocked), P.DEFAULT_PREFS);
  assert.equal(P.savePrefs(blocked, P.DEFAULT_PREFS), false);
});

test('stepZoom moves by 10 within the range', () => {
  assert.equal(P.stepZoom(100, 1), 110);
  assert.equal(P.stepZoom(200, 1), 200);
  assert.equal(P.stepZoom(70, -1), 70);
  assert.equal(P.stepZoom(30, -1, { min: 30, max: 250, step: 10 }), 30);
});
