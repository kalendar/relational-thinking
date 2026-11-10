// Combines SQL Studio's vendored libraries and shared files, the shim, and src/ into one self-contained file:
// dist/constraint-gauntlet.html
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const STUDIO = path.join(ROOT, '..', 'sql-studio');
const STUDIO_SRC = path.join(STUDIO, 'src');
const VENDOR = path.join(STUDIO, 'vendor');
const OUT = path.join(ROOT, 'dist', 'constraint-gauntlet.html');

const VENDOR_CSS = ['codemirror/codemirror.css', 'codemirror/show-hint.css'];
const VENDOR_JS = ['codemirror/codemirror.js', 'codemirror/mode-sql.js', 'codemirror/show-hint.js', 'codemirror/sql-hint.js',
  'codemirror/active-line.js', 'codemirror/matchbrackets.js', 'sql.js/sql-wasm.js'];
// From tools/sql-studio/src, unchanged (a test checks they are byte-identical). They attach to window.SS.
const SHARED = ['sql-text.js', 'errors.js', 'dom.js', 'icons.js', 'panels.js', 'editor.js'];
const SHARED_CSS = 'styles.css';

// Load order: each file reads what earlier files put on window.CG. Level files go where 'LEVELS' is.
const SCRIPT_ORDER = ['shim.js', 'schema.js', 'db.js', 'statement.js', 'rowform-sql.js', 'probe.js', 'blast.js', 'constraint-errors.js',
  'rules.js', 'goals.js', 'rebuild.js', 'session.js', 'LEVELS', 'levels-index.js', 'export.js', 'progress.js',
  'layout.js', 'rowform-view.js', 'sql-view.js', 'tables-view.js', 'blast-view.js', 'result-view.js', 'goals-view.js',
  'rules-view.js', 'fix-view.js', 'boards-view.js', 'export-dialog.js', 'app.js'];

const read = p => fs.readFileSync(p, 'utf8');
const label = p => path.relative(path.join(ROOT, '..'), p);
const levelFiles = () => fs.readdirSync(path.join(SRC, 'levels')).filter(f => f.endsWith('.js')).sort().map(f => path.join(SRC, 'levels', f));

function build() {
  const vendorJs = VENDOR_JS.map(f => ({ name: `sql-studio/vendor/${f}`, code: read(path.join(VENDOR, f)) }));
  const wasm = fs.readFileSync(path.join(VENDOR, 'sql.js', 'sql-wasm.wasm')).toString('base64');
  const shared = SHARED.map(f => ({ name: `sql-studio/src/${f}`, code: `// ---- shared from tools/sql-studio/src/${f} (do not edit here) ----\n${read(path.join(STUDIO_SRC, f))}` }));
  // Files not written yet are skipped, so the build works at every step.
  const ours = SCRIPT_ORDER.flatMap(f => (f === 'LEVELS' ? levelFiles() : [path.join(SRC, f)]))
    .filter(p => fs.existsSync(p))
    .map(p => ({ name: label(p), code: `// ---- ${label(p)} ----\n${read(p)}` }));
  const scripts = [...vendorJs, { name: 'wasm', code: `window.CG_WASM_BASE64 = "${wasm}";` }, ...shared, ...ours];
  for (const sc of scripts) if (/<\/script/i.test(sc.code)) throw new Error(`${sc.name} contains "</script", which would break the page.`);
  const css = [...VENDOR_CSS.map(f => read(path.join(VENDOR, f))),
    `/* ---- shared from tools/sql-studio/src/${SHARED_CSS} ---- */\n${read(path.join(STUDIO_SRC, SHARED_CSS))}`,
    `/* ---- constraint-gauntlet/src/styles.css ---- */\n${read(path.join(SRC, 'styles.css'))}`].join('\n');
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
module.exports = { build, OUT, SCRIPT_ORDER, SHARED, SHARED_CSS, VENDOR_JS, VENDOR_CSS, STUDIO_SRC, levelFiles };
