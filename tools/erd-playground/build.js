// Combines the ERD Playground's src/ with files it shares with SQL Studio (read in place, never copied)
// into one self-contained file: dist/erd-playground.html
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const STUDIO = path.join(ROOT, '..', 'sql-studio');
const OUT = path.join(ROOT, 'dist', 'erd-playground.html');

const VENDOR_CSS = ['codemirror/codemirror.css'];
const VENDOR_JS = ['codemirror/codemirror.js', 'codemirror/matchbrackets.js', 'codemirror/active-line.js'];
// From tools/sql-studio/src/, in load order.
const SHARED = ['dom.js', 'icons.js', 'erd-model.js', 'panels.js', 'canvas.js'];
// Load order matters: each file reads what earlier files put on window.SS.
const SCRIPT_ORDER = ['notation.js', 'readings.js', 'examples.js', 'prefs.js', 'editor.js', 'diagram-view.js', 'app.js'];

const read = p => fs.readFileSync(p, 'utf8');
const label = p => path.relative(ROOT, p);

function build() {
  const vendorJs = VENDOR_JS.map(f => ({ name: `../sql-studio/vendor/${f}`, code: read(path.join(STUDIO, 'vendor', f)) }));
  // Files not written yet are skipped, so the build works at every step of the plan.
  const ours = [...SHARED.map(f => path.join(STUDIO, 'src', f)), ...SCRIPT_ORDER.map(f => path.join(SRC, f))]
    .filter(p => fs.existsSync(p))
    .map(p => ({ name: label(p), code: `// ---- ${label(p)} ----\n${read(p)}` }));
  // Each part is its own <script>, so one file's top-level names can't clash with another's.
  const scripts = [...vendorJs, ...ours];
  for (const sc of scripts) if (/<\/script/i.test(sc.code)) throw new Error(`${sc.name} contains "</script", which would break the page.`);
  const css = [...VENDOR_CSS.map(f => read(path.join(STUDIO, 'vendor', f))), read(path.join(SRC, 'styles.css'))].join('\n');
  const html = read(path.join(SRC, 'index.html'))
    .replace('/* INLINE_CSS */', () => css)
    .replace('<!-- INLINE_JS -->', () => scripts.map(sc => `<script data-src="${sc.name}">\n${sc.code}\n</script>`).join('\n'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return OUT;
}

if (require.main === module) {
  const out = build();
  console.log(`Built ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
module.exports = { build, OUT, SCRIPT_ORDER, SHARED, VENDOR_JS };
