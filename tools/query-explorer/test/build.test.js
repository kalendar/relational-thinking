const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { build } = require('../build.js');
const { loadDatasets } = require('./helpers.js');

test('build makes one self-contained HTML file', () => {
  const out = build();
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(!html.includes('INLINE_CSS') && !html.includes('INLINE_JS'), 'markers are replaced');
  assert.ok(!/<script[^>]+src=/.test(html), 'no external scripts');
  assert.ok(html.includes('--teal:#117c70'), 'styles are inlined');
  for (const ds of loadDatasets()) assert.ok(html.includes(`name: '${ds.name}'`) || html.includes(`name: "${ds.name}"`), `${ds.name} is inlined`);
  assert.ok(html.indexOf('---- engine.js') < html.indexOf('---- datasets/01-spotify.js'), 'engine loads before data');
  assert.ok(html.indexOf('---- narrate.js') < html.indexOf('---- datasets/01-spotify.js'), 'narrate loads before data');
  assert.ok(html.indexOf('---- narrate.js') < html.indexOf('---- export.js'), 'export loads after narrate');
  assert.ok(html.indexOf('---- export.js') < html.indexOf('---- datasets/01-spotify.js'), 'export loads before data');
  assert.ok(html.indexOf('---- modal.js') < html.indexOf('---- export-dialog.js'), 'export dialog loads after modal');
  assert.ok(html.indexOf('---- visual.js') < html.indexOf('---- narrate.js'), 'narrate loads after visual');
  assert.ok(html.indexOf('---- modal.js') < html.indexOf('---- animate.js'), 'modal loads before animate');
  assert.ok(html.indexOf('---- table-view.js') < html.indexOf('---- modal.js'), 'modal loads after table-view');
});
