// Constraint Gauntlet: finds the rows a statement would add, change, or remove, by running it on an
// unconstrained TEMP copy of its table. A TEMP table with the same name hides the main one for every
// unqualified name (pinned in sqlite-behaviors.test.js), so the student's text runs unchanged.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;

  function probe(game, text, cls) {
    if (cls.kind === 'select') return { ok: true, added: [], changed: [], removed: [] };
    const t = S.findTable(game.tables, cls.table);
    const cols = t.columns.map(c => c.name);
    const db = game.db;
    const snap = () => {
      const res = db.exec(`SELECT rowid, ${cols.join(', ')} FROM temp.${t.name}`);
      const out = new Map();
      for (const v of (res[0] ? res[0].values : [])) out.set(v[0], Object.assign(S.valuesToRow(t, v.slice(1)), { _rowid: v[0] }));
      return out;
    };
    db.run(`DROP TABLE IF EXISTS temp.${t.name}`);
    db.run(S.probeTableSql(t, `temp.${t.name}`));
    try {
      db.run(`INSERT INTO temp.${t.name} (rowid, ${cols.join(', ')}) SELECT rowid, ${cols.join(', ')} FROM main.${t.name}`);
      const before = snap();
      try { db.run(text); } catch (e) { return { ok: false, message: e.message }; }
      const after = snap();
      const added = [];
      const changed = [];
      const removed = [];
      for (const [id, row] of after) {
        if (!before.has(id)) added.push(row);
        else if (cols.some(c => before.get(id)[c] !== row[c])) changed.push({ before: before.get(id), after: row });
      }
      for (const [id, row] of before) if (!after.has(id)) removed.push(row);
      return { ok: true, added, changed, removed };
    } finally {
      db.run(`DROP TABLE IF EXISTS temp.${t.name}`);
    }
  }

  const api = { probe };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
