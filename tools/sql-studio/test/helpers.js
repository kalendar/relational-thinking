// Shared test helpers: the vendored sql.js and the Query Explorer data sets (read in place).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATASET_DIR = path.join(ROOT, '..', 'query-explorer', 'src', 'datasets');
// SQL Studio's own data sets (not in the Query Explorer), such as 0. Ch 8 and 9 Sample Data.
const STUDIO_DATASET_DIR = path.join(ROOT, 'datasets');

let sqlPromise = null;
function getSQL() {
  if (!sqlPromise) {
    const initSqlJs = require(path.join(ROOT, 'vendor', 'sql.js', 'sql-wasm.js'));
    const wasmBinary = fs.readFileSync(path.join(ROOT, 'vendor', 'sql.js', 'sql-wasm.wasm'));
    sqlPromise = initSqlJs({ wasmBinary });
  }
  return sqlPromise;
}

function loadDatasets() {
  return fs.readdirSync(DATASET_DIR).filter(f => f.endsWith('.js')).sort()
    .map(f => require(path.join(DATASET_DIR, f)));
}

// Every data set SQL Studio offers, in picker order (by number).
function loadAllDatasets() {
  const own = fs.existsSync(STUDIO_DATASET_DIR)
    ? fs.readdirSync(STUDIO_DATASET_DIR).filter(f => f.endsWith('.js')).sort().map(f => require(path.join(STUDIO_DATASET_DIR, f)))
    : [];
  return [...own, ...loadDatasets()].sort((a, b) => a.number - b.number);
}

module.exports = { ROOT, DATASET_DIR, STUDIO_DATASET_DIR, getSQL, loadDatasets, loadAllDatasets };
