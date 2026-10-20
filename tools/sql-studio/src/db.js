// SQL Studio: opens a data set as an in-memory SQLite database and runs one read-only statement.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./schema.js')) : root.SS;

  const MAX_ROWS = 200000;

  function firstWord(text) {
    const t = X.tokenize(text).find(k => k.type !== 'ws' && k.type !== 'comment');
    return t ? t.text.toUpperCase() : '';
  }

  const isReadOnly = text => ['SELECT', 'WITH', 'VALUES'].includes(firstWord(text));

  function openStudio(SQL, schema) {
    const db = new SQL.Database();
    X.loadSchema(db, schema);
    db.run('PRAGMA query_only = ON');
    return { db, schema };
  }

  function closeStudio(studio) {
    if (studio && studio.db) studio.db.close();
  }

  function runQuery(studio, text, { maxRows = MAX_ROWS } = {}) {
    if (!firstWord(text) || firstWord(text) === ';') return { ok: false, error: { kind: 'empty', message: '' } };
    if (!isReadOnly(text)) return { ok: false, error: { kind: 'readonly', message: '' } };
    let stmt = null;
    try {
      stmt = studio.db.prepare(text);
      const columns = stmt.getColumnNames();
      const rows = [];
      let truncated = false;
      while (stmt.step()) {
        if (rows.length >= maxRows) { truncated = true; break; }
        rows.push(stmt.get());
      }
      return { ok: true, columns, rows, truncated };
    } catch (e) {
      const message = String((e && e.message) || e);
      const kind = /attempt to write a readonly database/i.test(message) ? 'readonly' : 'sqlite';
      return { ok: false, error: { kind, message } };
    } finally {
      if (stmt) stmt.free();
    }
  }

  // Compiles (never runs) `text`; returns SQLite's error message, or null if it compiles. Used to find where an error starts.
  function probeError(studio, text) {
    try {
      studio.db.prepare(text).free();
      return null;
    } catch (e) {
      return String((e && e.message) || e);
    }
  }

  const api = { MAX_ROWS, isReadOnly, openStudio, closeStudio, runQuery, probeError };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
