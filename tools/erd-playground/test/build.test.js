const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, OUT, SCRIPT_ORDER, SHARED } = require('../build.js');
const { ROOT } = require('./helpers.js');

const html = fs.readFileSync(build(), 'utf8');

test('build writes one file to dist/erd-playground.html', () => {
  assert.equal(OUT, path.join(ROOT, 'dist', 'erd-playground.html'));
  assert.ok(html.startsWith('<!doctype html>'));
});

test('every src/*.js file is in the load order', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(n => n.endsWith('.js'))) assert.ok(SCRIPT_ORDER.includes(f), `${f} is missing from SCRIPT_ORDER`);
});

test("SQL Studio's shared files are read in place, not copied", () => {
  for (const f of SHARED) {
    const p = path.join(ROOT, '..', 'sql-studio', 'src', f);
    if (fs.existsSync(p)) assert.ok(html.includes(`<script data-src="../sql-studio/src/${f}">`), f);
    assert.equal(fs.existsSync(path.join(ROOT, 'src', f)), false, `${f} must not be copied into src/`);
  }
});

const appDone = fs.existsSync(path.join(ROOT, 'src', 'app.js'));
test('every file in the load order exists', { skip: !appDone && 'app.js arrives in Task 9' }, () => {
  for (const f of SCRIPT_ORDER) assert.ok(fs.existsSync(path.join(ROOT, 'src', f)), f);
  for (const f of SHARED) assert.ok(fs.existsSync(path.join(ROOT, '..', 'sql-studio', 'src', f)), f);
});

test('the only outside URLs are Google Fonts', () => {
  const loads = [...html.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(loads.map(u => new URL(u).host), ['fonts.googleapis.com']);
});

test('the color tokens are exactly the Query Explorer ones', () => {
  const qe = fs.readFileSync(path.join(ROOT, '..', 'query-explorer', 'src', 'styles.css'), 'utf8');
  const tokens = qe.slice(0, qe.indexOf('*{box-sizing'));
  const ours = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8');
  assert.ok(ours.includes(tokens.trim()));
});
