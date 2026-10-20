const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, OUT, SCRIPT_ORDER, DATASETS } = require('../build.js');
const { ROOT } = require('./helpers.js');

const html = fs.readFileSync(build(), 'utf8');

test('build writes one file to dist/sql-studio.html', () => {
  assert.equal(OUT, path.join(ROOT, 'dist', 'sql-studio.html'));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.length > 1_000_000, 'includes the vendored libraries and wasm');
});

test('every src/*.js file is in the load order', () => {
  const listed = SCRIPT_ORDER.filter(f => f !== 'DATASETS');
  for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(n => n.endsWith('.js'))) assert.ok(listed.includes(f), `${f} is missing from SCRIPT_ORDER`);
});

const appDone = fs.existsSync(path.join(ROOT, 'src', 'app.js'));
test('every file in the load order exists', { skip: !appDone && 'app.js arrives in Task 19' }, () => {
  for (const f of SCRIPT_ORDER.filter(n => n !== 'DATASETS')) assert.ok(fs.existsSync(path.join(ROOT, 'src', f)), f);
});

test('data sets are read in place from the Query Explorer, one per file', () => {
  const files = fs.readdirSync(DATASETS).filter(f => f.endsWith('.js'));
  assert.equal(files.length, 10);
  for (const f of files) assert.ok(html.includes(`// ---- ../query-explorer/src/datasets/${f} ----`), f);
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'datasets')), false, 'no copied data sets');
});

test('the wasm is inlined as base64', () => {
  const wasm = fs.readFileSync(path.join(ROOT, 'vendor', 'sql.js', 'sql-wasm.wasm')).toString('base64');
  assert.ok(html.includes(`window.SS_WASM_BASE64 = "${wasm}";`));
});

test('the only outside URLs are Google Fonts and the published page', () => {
  const loads = [...html.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(loads.map(u => new URL(u).host), ['fonts.googleapis.com']);
  assert.ok(!/\bfetch\(\s*['"]https?:/.test(html));
});

test('the color tokens are exactly the Query Explorer ones', () => {
  const qe = fs.readFileSync(path.join(ROOT, '..', 'query-explorer', 'src', 'styles.css'), 'utf8');
  const tokens = qe.slice(0, qe.indexOf('*{box-sizing'));
  const ours = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8');
  assert.ok(ours.includes(tokens.trim()), 'paste the Query Explorer :root token block unchanged at the top of styles.css');
});
