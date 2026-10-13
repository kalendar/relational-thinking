// Combines src/ into one self-contained file: dist/query-explorer.html
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'dist', 'query-explorer.html');

// Load order matters: each file reads what earlier files put on window.QE.
const SCRIPT_ORDER = ['engine.js', 'describe.js', 'visual.js', 'DATASETS', 'dom.js', 'table-view.js'];

function datasetFiles() {
  return fs.readdirSync(path.join(SRC, 'datasets')).filter(f => f.endsWith('.js')).sort().map(f => `datasets/${f}`);
}

function build() {
  const files = SCRIPT_ORDER.flatMap(f => (f === 'DATASETS' ? datasetFiles() : [f]));
  const js = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  if (/<\/script/i.test(js)) throw new Error('A source file contains "</script", which would break the page.');
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8')
    .replace('/* INLINE_CSS */', () => css)
    .replace('// INLINE_JS', () => js);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return OUT;
}

if (require.main === module) console.log('Built ' + build());
module.exports = { build, OUT, SCRIPT_ORDER };
