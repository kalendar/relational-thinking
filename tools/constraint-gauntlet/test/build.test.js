const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const B = require('../build.js');
const { VENDOR } = require('./helpers.js');

test('the build makes one self-contained page', () => {
  const out = B.build();
  const html = fs.readFileSync(out, 'utf8');
  assert.match(html, /window\.CG_WASM_BASE64 = "[A-Za-z0-9+/=]{100000,}"/);
  const scripts = html.split(/<script data-src=/).slice(1).map(s => s.slice(0, s.lastIndexOf('</script>')));
  for (const sc of scripts) assert.doesNotMatch(sc.slice(sc.indexOf('>') + 1), /<\/script/i);
  const urls = [...html.matchAll(/https?:\/\/[^\s"')]+/g)].map(m => m[0]).filter(u => !/^https?:\/\/(www\.)?w3\.org\//.test(u));
  const fetched = [...html.matchAll(/<link[^>]+href="(https?:[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(fetched, ['https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Nunito+Sans:wght@300;400;600;700;800&display=swap']);
  assert.doesNotMatch(html, /fetch\(\s*['"]https?:|XMLHttpRequest\(\)\s*;\s*\w+\.open\(\s*['"]GET['"],\s*['"]https?:/, 'no runtime requests to the web');
  assert.ok(urls.length >= 1);
});

test('shared SQL Studio files are inlined byte-for-byte, and the vendored files too', () => {
  const html = fs.readFileSync(B.OUT, 'utf8');
  for (const f of B.SHARED) assert.ok(html.includes(fs.readFileSync(path.join(B.STUDIO_SRC, f), 'utf8')), `${f} must be inlined unchanged`);
  assert.ok(html.includes(fs.readFileSync(path.join(B.STUDIO_SRC, B.SHARED_CSS), 'utf8')), 'SQL Studio styles inlined unchanged');
  for (const f of B.VENDOR_JS) assert.ok(html.includes(fs.readFileSync(path.join(VENDOR, f), 'utf8')), `${f} inlined`);
});

test('every level file is in the page', () => {
  const html = fs.readFileSync(B.OUT, 'utf8');
  for (const p of B.levelFiles()) assert.ok(html.includes(fs.readFileSync(p, 'utf8')), path.basename(p));
});

test("the shim's stepZoom matches SQL Studio's, so both tools zoom the same way", () => {
  const studio = require('../../sql-studio/src/prefs.js').stepZoom;
  const sandbox = { SS: { ICON_PATHS: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'shim.js'), 'utf8'), sandbox);
  for (let v = 70; v <= 200; v += 5) for (const dir of [-1, 1]) assert.equal(sandbox.SS.stepZoom(v, dir), studio(v, dir), `stepZoom(${v}, ${dir})`);
  assert.ok(sandbox.SS.ICON_PATHS.shield);
});
