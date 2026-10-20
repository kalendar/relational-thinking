// Shared test helpers: the vendored sql.js and the Query Explorer data sets (read in place).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATASET_DIR = path.join(ROOT, '..', 'query-explorer', 'src', 'datasets');

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

module.exports = { ROOT, DATASET_DIR, getSQL, loadDatasets };
