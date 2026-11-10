// Constraint Gauntlet: opens a level as an in-memory SQLite database with foreign keys on, and reads from it.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;

  const fkOn = db => db.exec('PRAGMA foreign_keys')[0].values[0][0] === 1;

  // Every database in the Gauntlet is opened here (Global Constraints).
  function openLevel(SQL, level, opts = {}) {
    const variant = opts.variant !== undefined ? opts.variant : (level.startVariant || null);
    const tables = opts.tables || (variant ? level.variants[variant].tables : level.tables);
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    if (!fkOn(db)) {
      db.close();
      throw new Error('Foreign keys did not turn on. Every lesson in Levels 6-8 depends on them.');
    }
    for (const t of tables) db.run(S.createTableSql(t, { hidden: true }));
    const byName = Object.fromEntries(tables.map(t => [t.name, t]));
    const seed = opts.seed || level.seed || {};
    for (const name of S.seedOrder(tables)) {
      const rows = seed[name] || [];
      if (!rows.length) continue;
      const t = byName[name];
      const cols = t.columns.map(c => c.name);
      const stmt = db.prepare(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
      try {
        for (const r of rows) {
          try { stmt.run(S.rowToValues(t, r)); } catch (e) {
            throw new Error(`Level ${level.id}: a seed row for ${name} breaks a rule (${e.message}): ${JSON.stringify(r)}`);
          }
        }
      } finally { stmt.free(); }
    }
    return { db, SQL, level, tables: tables.slice(), variant };
  }

  function closeLevel(game) {
    if (game && game.db) { game.db.close(); game.db = null; }
  }

  // Read-only use: reports, lookups, counts. Rows come back as objects.
  function readQuery(game, sql, params = []) {
    const stmt = game.db.prepare(sql);
    try {
      stmt.bind(params);
      const columns = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return { columns, rows };
    } finally { stmt.free(); }
  }

  const countRows = game => Object.fromEntries(game.tables.map(t => [t.name, readQuery(game, `SELECT COUNT(*) AS n FROM main.${t.name}`).rows[0].n]));

  function tableRows(game, name) {
    const t = S.findTable(game.tables, name);
    const cols = t.columns.map(c => c.name);
    const order = S.pkColumns(t).join(', ') || 'rowid';
    const res = game.db.exec(`SELECT rowid, ${cols.join(', ')} FROM main.${t.name} ORDER BY ${order}`);
    return (res[0] ? res[0].values : []).map(v => Object.assign(S.valuesToRow(t, v.slice(1)), { _rowid: v[0] }));
  }

  const api = { openLevel, closeLevel, readQuery, countRows, tableRows, fkOn };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
