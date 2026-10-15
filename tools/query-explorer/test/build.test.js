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

test('assessment answer keys are not in the published page', () => {
  const html = fs.readFileSync(build(), 'utf8');
  const keys = require('./answer-keys.js');
  for (const [id, recipes] of Object.entries(keys)) {
    for (const r of recipes) {
      const last = r.steps[r.steps.length - 1];
      assert.ok(!html.includes(JSON.stringify(last)), `${id}: an answer step leaked into the page`);
    }
  }
  assert.ok(!/recipe:\s*\{/.test(html.slice(html.indexOf('---- datasets/07'), html.indexOf('---- dom.js'))), 'no recipes in data sets 7–10');
});
