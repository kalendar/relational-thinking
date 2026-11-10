// Constraint Gauntlet: checks Row form values for type problems, and writes the INSERT / UPDATE / DELETE they mean.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;
  const D = isNode ? require('./db.js') : root.CG;

  const WRAP = 70;

  // Blank means NULL (spec §5.1). Type problems only; constraints are the database's job.
  // (A date like 2026-02-30 passes the pattern. SQLite doesn't check calendars either.)
  function parseForm(table, fields) {
    const row = {};
    const problems = {};
    for (const c of table.columns) {
      const raw = fields[c.name] === undefined || fields[c.name] === null ? '' : String(fields[c.name]);
      if (raw.trim() === '') { row[c.name] = null; continue; }
      const v = S.typeOf(c).parse(c.type === 'varchar' ? raw : raw.trim());
      if (v instanceof Error) problems[c.name] = `\`${c.name}\` ${v.message}.`;
      else row[c.name] = v;
    }
    return Object.keys(problems).length ? { ok: false, problems } : { ok: true, row };
  }

  function literal(col, v) {
    if (v === null || v === undefined) return 'NULL';
    if (col.type === 'boolean') return v === true || v === 1 ? 'true' : 'false';
    if (col.type === 'decimal' && typeof v === 'number') return v.toFixed(col.precision ? col.precision[1] : 2);
    if (col.type === 'int' && typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  const where = (t, keyRow) => S.pkColumns(t).map(k => `${k} = ${literal(S.findColumn(t, k), keyRow[k])}`).join(' AND ');

  function insertSql(t, row) {
    const cols = t.columns.map(c => c.name);
    const vals = t.columns.map(c => literal(c, row[c.name]));
    const one = `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
    return one.length <= WRAP ? one : `INSERT INTO ${t.name} (${cols.join(', ')})\nVALUES (${vals.join(', ')});`;
  }

  function updateSql(t, row, keyRow) {
    const sets = t.columns.filter(c => literal(c, row[c.name]) !== literal(c, keyRow[c.name]))
      .map(c => `${c.name} = ${literal(c, row[c.name])}`);
    if (!sets.length) return null;
    const one = `UPDATE ${t.name} SET ${sets.join(', ')} WHERE ${where(t, keyRow)};`;
    return one.length <= WRAP ? one : `UPDATE ${t.name}\nSET ${sets.join(', ')}\nWHERE ${where(t, keyRow)};`;
  }

  const deleteSql = (t, keyRow) => `DELETE FROM ${t.name} WHERE ${where(t, keyRow)};`;

  function nextId(game, tableName) {
    const t = S.findTable(game.tables, tableName);
    const pk = S.pkColumns(t);
    if (pk.length !== 1 || S.findColumn(t, pk[0]).type !== 'int') return null;
    const n = D.readQuery(game, `SELECT MAX(${pk[0]}) AS m FROM main.${t.name}`).rows[0].m;
    return (typeof n === 'number' ? n : 0) + 1;
  }

  const api = { parseForm, literal, insertSql, updateSql, deleteSql, nextId };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
