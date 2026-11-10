// Constraint Gauntlet: what a DELETE takes with it. simulateDelete predicts it without touching the data
// (following CASCADE, SET NULL, and RESTRICT down the chain); snapshotCounts + blastBetween measure it.
// changes() can't be used: it counts only the parent row of a cascade (pinned in sqlite-behaviors.test.js).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;
  const D = isNode ? require('./db.js') : root.CG;

  function childLinks(tables, parentName) {
    const out = [];
    for (const t of tables) {
      const pk = S.pkColumns(t);
      for (const c of t.columns) {
        if (c.fk && c.fk.table === parentName) {
          out.push({ child: t.name, column: c.name, onDelete: c.fk.onDelete || 'RESTRICT', parentColumn: c.fk.column, notNull: !!c.notNull || pk.includes(c.name) });
        }
      }
    }
    return out;
  }

  function simulateDelete(game, table, rows) {
    const removed = {};
    const nulled = {};
    const seen = new Set();
    const nulledRows = new Set();
    const queue = rows.map(r => ({ table, row: r }));
    while (queue.length) {
      const { table: t, row } = queue.shift();
      const key = `${t}#${row._rowid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      removed[t] = (removed[t] || 0) + 1;
      for (const link of childLinks(game.tables, t)) {
        const childT = S.findTable(game.tables, link.child);
        const kids = D.readQuery(game, `SELECT rowid AS _rowid, * FROM main.${link.child} WHERE ${link.column} = ?`, [row[link.parentColumn]]).rows
          .filter(k => !seen.has(`${link.child}#${k._rowid}`))
          .map(k => Object.assign(S.valuesToRow(childT, childT.columns.map(c => k[c.name])), { _rowid: k._rowid }));
        if (!kids.length) continue;
        const blocked = kind => ({ blocked: { kind, parentTable: t, parentRow: row, child: link.child, column: link.column, count: kids.length, onDelete: link.onDelete }, removed: {}, nulled: {} });
        if (link.onDelete === 'CASCADE') { for (const k of kids) queue.push({ table: link.child, row: k }); continue; }
        if (link.onDelete === 'SET NULL') {
          if (link.notNull) return blocked('notnull');
          const fresh = kids.filter(k => !nulledRows.has(`${link.child}.${link.column}#${k._rowid}`));
          fresh.forEach(k => nulledRows.add(`${link.child}.${link.column}#${k._rowid}`));
          if (fresh.length) nulled[`${link.child}.${link.column}`] = (nulled[`${link.child}.${link.column}`] || 0) + fresh.length;
          continue;
        }
        return blocked('restrict'); // RESTRICT, NO ACTION, SET DEFAULT all leave children pointing at a deleted row here
      }
    }
    // A row that was SET NULL and then cascade-deleted shouldn't be counted as nulled.
    for (const k of Object.keys(nulled)) {
      const [child] = k.split('.');
      let n = 0;
      for (const id of nulledRows) if (id.startsWith(`${k}#`) && !seen.has(`${child}#${id.split('#')[1]}`)) n++;
      if (n) nulled[k] = n; else delete nulled[k];
    }
    return { blocked: null, removed, nulled };
  }

  function snapshotCounts(game) {
    const rows = D.countRows(game);
    const nulls = {};
    for (const t of game.tables) {
      for (const c of t.columns) {
        if (c.fk && !c.notNull) nulls[`${t.name}.${c.name}`] = D.readQuery(game, `SELECT COUNT(*) AS n FROM main.${t.name} WHERE ${c.name} IS NULL`).rows[0].n;
      }
    }
    return { rows, nulls };
  }

  function blastBetween(before, after) {
    const removed = {};
    const nulled = {};
    let total = 0;
    for (const [t, n] of Object.entries(before.rows)) {
      const d = n - (after.rows[t] || 0);
      if (d > 0) { removed[t] = d; total += d; }
    }
    for (const [k, n] of Object.entries(after.nulls)) {
      const d = n - (before.nulls[k] || 0);
      if (d > 0) nulled[k] = d;
    }
    return { removed, nulled, total };
  }

  const api = { childLinks, simulateDelete, snapshotCounts, blastBetween };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
