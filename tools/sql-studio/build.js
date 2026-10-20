// Combines vendor/, the Query Explorer data sets, and src/ into one self-contained file: dist/sql-studio.html
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const VENDOR = path.join(ROOT, 'vendor');
const DATASETS = path.join(ROOT, '..', 'query-explorer', 'src', 'datasets');
const OUT = path.join(ROOT, 'dist', 'sql-studio.html');

const VENDOR_CSS = ['codemirror/codemirror.css', 'codemirror/show-hint.css'];
const VENDOR_JS = ['codemirror/codemirror.js', 'codemirror/mode-sql.js', 'codemirror/show-hint.js', 'codemirror/sql-hint.js',
  'codemirror/active-line.js', 'codemirror/matchbrackets.js', 'sql.js/sql-wasm.js', 'sheetjs/xlsx.mini.min.js'];

// Load order matters: each file reads what earlier files put on window.SS.
const SCRIPT_ORDER = ['sql-text.js', 'schema.js', 'db.js', 'query-runner.js', 'errors.js', 'format.js', 'check.js', 'exercises.js', 'randomq.js',
  'export.js', 'upload-parse.js', 'prefs.js', 'sessions.js', 'erd-model.js', 'DATASETS',
  'dom.js', 'icons.js', 'layout.js', 'editor.js', 'results-view.js', 'exercises-view.js', 'export-dialog.js',
  'random-ui.js', 'erd.js', 'data-view.js', 'upload.js', 'app.js'];

function datasetFiles() {
  return fs.readdirSync(DATASETS).filter(f => f.endsWith('.js')).sort().map(f => path.join(DATASETS, f));
}

const read = p => fs.readFileSync(p, 'utf8');
const label = p => path.relative(ROOT, p);

function build() {
  const vendorJs = VENDOR_JS.map(f => ({ name: `vendor/${f}`, code: read(path.join(VENDOR, f)) }));
  const wasm = fs.readFileSync(path.join(VENDOR, 'sql.js', 'sql-wasm.wasm')).toString('base64');
  // Files not written yet (the DOM files arrive over Tasks 12–19) are skipped, so the build works at every step.
  const ours = SCRIPT_ORDER.flatMap(f => (f === 'DATASETS' ? datasetFiles() : [path.join(SRC, f)]))
    .filter(p => fs.existsSync(p))
    .map(p => ({ name: label(p), code: `// ---- ${label(p)} ----\n${read(p)}` }));
  // Each part is its own <script>, so one file's top-level names can't clash with another's strict-mode code.
  // data-src names let app.js build the query worker from scripts already in the page.
  const scripts = [...vendorJs, { name: 'wasm', code: `window.SS_WASM_BASE64 = "${wasm}";` }, ...ours];
  for (const sc of scripts) if (/<\/script/i.test(sc.code)) throw new Error(`${sc.name} contains "</script", which would break the page.`);
  const css = [...VENDOR_CSS.map(f => read(path.join(VENDOR, f))), read(path.join(SRC, 'styles.css'))].join('\n');
  const html = read(path.join(SRC, 'index.html'))
    .replace('/* INLINE_CSS */', () => css)
    .replace('<!-- INLINE_JS -->', () => scripts.map(sc => `<script data-src="${sc.name}">\n${sc.code}\n</script>`).join('\n'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return OUT;
}

if (require.main === module) {
  const out = build();
  console.log(`Built ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
}
module.exports = { build, OUT, SCRIPT_ORDER, VENDOR_JS, DATASETS };
