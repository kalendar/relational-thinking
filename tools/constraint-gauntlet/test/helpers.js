// Shared test helpers: SQL Studio's vendored sql.js, read in place.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STUDIO = path.join(ROOT, '..', 'sql-studio');
const VENDOR = path.join(STUDIO, 'vendor');

let sqlPromise = null;
function getSQL() {
  if (!sqlPromise) {
    const initSqlJs = require(path.join(VENDOR, 'sql.js', 'sql-wasm.js'));
    const wasmBinary = fs.readFileSync(path.join(VENDOR, 'sql.js', 'sql-wasm.wasm'));
    sqlPromise = initSqlJs({ wasmBinary });
  }
  return sqlPromise;
}

// Runs a statement; returns 'OK' or the error message. For behavior tests only.
function attempt(db, sql) {
  try { db.run(sql); return 'OK'; } catch (e) { return e.message; }
}
const one = (db, sql) => db.exec(sql)[0].values[0][0];

module.exports = { ROOT, STUDIO, VENDOR, getSQL, attempt, one };
