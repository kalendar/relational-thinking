// Constraint Gauntlet: turns SQLite's constraint errors into plain words, with three chips:
// which table, which rule, which value (spec §7). For foreign keys SQLite names nothing, so the
// explanation is worked out here, and only ever after SQLite has already said no.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;
  const D = isNode ? require('./db.js') : root.CG;
  const B = isNode ? require('./blast.js') : root.CG;
  const R = isNode ? require('./rowform-sql.js') : root.CG;

  const code = s => '`' + s + '`';
  const plural = (n, word) => (n === 1 ? word : `${word}s`);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const attempted = p => (p ? [...(p.added || []), ...(p.changed || []).map(c => c.after)] : []);
  const encodeVal = (col, v) => (col && col.type === 'boolean' && typeof v === 'boolean' ? (v ? 1 : 0) : v);

  function keyText(t, row) {
    const pk = S.pkColumns(t);
    return pk.map(k => S.showValue(S.findColumn(t, k), row[k])).join(', ');
  }
  // A short human label for a row: "Jordan Lee", else the first text column that isn't a key.
  function label(t, row) {
    const pk = S.pkColumns(t);
    if (row.first_name && row.last_name) return `${row.first_name} ${row.last_name}`;
    const c = t.columns.find(x => x.type === 'varchar' && !pk.includes(x.name) && !x.fk && row[x.name]);
    return c ? String(row[c.name]) : '';
  }
  const nameRow = (t, row) => `${cap(S.noun(t))} ${keyText(t, row)}${label(t, row) ? ` (${label(t, row)})` : ''}`;

  // Is the expression false for this row? (CHECK fails only on false, never on NULL.)
  function isFalse(game, t, row, expr) {
    const cols = t.columns.map(c => c.name);
    const sql = `SELECT CASE WHEN (${expr}) THEN 1 WHEN NOT (${expr}) THEN 0 ELSE NULL END AS r FROM (SELECT ${cols.map(c => `? AS ${c}`).join(', ')})`;
    try { return D.readQuery(game, sql, t.columns.map(c => encodeVal(c, row[c.name]))).rows[0].r === 0; } catch (_) { return false; }
  }

  function chips(table, rule, value) { return { table, rule, value }; }
  function result(kind, headline, c, columns, raw) { return { kind, headline, chips: c, columns, raw }; }

  function explainUnique(game, t, cols, att, raw) {
    const pk = S.pkColumns(t);
    const isPk = cols.length === pk.length && cols.every(c => pk.includes(c));
    const rows = attempted(att.probe);
    const updateIds = new Set((att.probe && att.probe.changed || []).map(c => c.after._rowid));
    let culprit = null;
    let existing = null;
    for (const r of rows) {
      const where = cols.map(c => `${c} = ?`).join(' AND ');
      const hit = D.readQuery(game, `SELECT rowid AS _rowid, * FROM main.${t.name} WHERE ${where}`, cols.map(c => encodeVal(S.findColumn(t, c), r[c]))).rows
        .find(x => !updateIds.has(r._rowid) || x._rowid !== r._rowid);
      if (hit) { culprit = r; existing = hit; break; }
    }
    if (!culprit) { // two attempted rows clash with each other
      for (let i = 0; i < rows.length && !culprit; i++) for (let j = i + 1; j < rows.length; j++) {
        if (cols.every(c => String(rows[i][c]).toLowerCase() === String(rows[j][c]).toLowerCase())) { culprit = rows[j]; existing = rows[i]; break; }
      }
    }
    const r = culprit || rows[0] || {};
    const vals = cols.map(c => S.showValue(S.findColumn(t, c), r[c]));
    const noun = S.noun(t);
    if (isPk) {
      const next = R.nextId(game, t.name);
      const h = `There's already a ${noun} with ${code(cols[0])} ${vals.join(', ')}. Each ${noun} needs its own ID.${next ? ` Try ${next}.` : ''}`;
      return result('pk', h, chips(t.name, S.describeConstraint(t, { kind: 'pk' }), vals.join(', ')), cols, raw);
    }
    if (cols.length === 1) {
      const col = S.findColumn(t, cols[0]);
      let h = col.uniqueText ? `${col.uniqueText} ` : '';
      h += `Another ${noun} already has the ${col.name} ${code(vals[0])}.`;
      if (!col.uniqueText) h += ` Each ${col.name} can belong to only one ${noun}.`;
      if (existing && existing[col.name] !== undefined && existing[col.name] !== r[col.name]) h += ` (It's saved as ${code(existing[col.name])}.)`;
      return result('unique', h, chips(t.name, S.describeConstraint(t, { kind: 'unique', column: col.name }), vals[0]), cols, raw);
    }
    const k = (t.constraints || []).find(x => x.kind === 'unique' && x.columns.join() === cols.join());
    let h = `${(k && k.text) || "That combination is already taken."} There's already a ${noun} with ${cols.map((c, i) => `${c} ${vals[i]}`).join(' and ')}.`;
    if (k && k.describe) { const extra = k.describe(r, game); if (extra) h += ` ${extra}`; }
    return result('unique', h, chips(t.name, S.describeConstraint(t, { kind: 'unique', columns: cols }), vals.join(' + ')), cols, raw);
  }

  function explainCheck(game, t, s, att, raw) {
    const rows = attempted(att.probe);
    const named = (t.constraints || []).find(k => k.kind === 'check' && k.name === s);
    const col = t.columns.find(c => c.check && c.check.expr === s);
    const tableCheck = named || (t.constraints || []).find(k => k.kind === 'check' && k.expr === s);
    if (col) {
      const r = rows.find(x => isFalse(game, t, x, col.check.expr)) || rows[0] || {};
      const v = S.showValue(col, r[col.name]);
      const h = `${col.check.text || `This row breaks the rule ${code(col.check.expr)}.`} You entered ${code(v)}.`;
      return result('check', h, chips(t.name, S.describeConstraint(t, { kind: 'check', expr: col.check.expr }), v), [col.name], raw);
    }
    if (tableCheck) {
      const r = rows.find(x => isFalse(game, t, x, tableCheck.expr)) || rows[0] || {};
      const cols = tableCheck.columns || [];
      const vals = cols.map(c => S.showValue(S.findColumn(t, c), r[c]));
      const h = `${tableCheck.text || `This row breaks the rule ${code(tableCheck.expr)}.`}${cols.length ? ` You entered ${cols.map((c, i) => `${c} ${code(vals[i])}`).join(' and ')}.` : ''}`;
      return result('check', h, chips(t.name, S.describeConstraint(t, { kind: 'check', name: tableCheck.name, expr: tableCheck.expr }), vals.join(', ')), cols, raw);
    }
    return result('check', `This row breaks the rule ${code(s)} on the ${t.name} table.`, chips(t.name, `CHECK (${s})`, ''), [], raw);
  }

  function explainFkParent(game, t, att, raw) {
    const misses = [];
    for (const r of attempted(att.probe)) {
      for (const c of t.columns) {
        if (!c.fk || r[c.name] === null || r[c.name] === undefined) continue;
        const parent = S.findTable(game.tables, c.fk.table);
        const hit = D.readQuery(game, `SELECT 1 AS x FROM main.${c.fk.table} WHERE ${c.fk.column} = ?`, [r[c.name]]).rows.length;
        if (!hit && !misses.some(m => m.col === c.name && m.value === r[c.name])) misses.push({ col: c.name, value: r[c.name], parent });
      }
    }
    if (!misses.length) return null;
    const h = misses.map(m => `There's no ${S.noun(m.parent)} with ${code(m.col)} ${m.value}. Add the ${S.noun(m.parent)} first, or check the ID.`).join(' ');
    const m = misses[0];
    return result('fk-parent', h, chips(t.name, S.describeConstraint(t, { kind: 'fk', column: m.col }), String(m.value)), [...new Set(misses.map(x => x.col))], raw);
  }

  function explainFkKeyUpdate(game, t, att, raw) {
    for (const ch of (att.probe && att.probe.changed) || []) {
      for (const link of B.childLinks(game.tables, t.name)) {
        if (ch.before[link.parentColumn] === ch.after[link.parentColumn]) continue;
        const n = D.readQuery(game, `SELECT COUNT(*) AS n FROM main.${link.child} WHERE ${link.column} = ?`, [ch.before[link.parentColumn]]).rows[0].n;
        if (!n) continue;
        const child = S.findTable(game.tables, link.child);
        const h = `${n} ${plural(n, S.noun(child))} still point to ${S.noun(t)} ${S.showValue(S.findColumn(t, link.parentColumn), ch.before[link.parentColumn])}. ` +
          `Changing its ${code(link.parentColumn)} would leave them pointing at nothing.`;
        return result('fk-child', h, chips(link.child, S.describeConstraint(child, { kind: 'fk', column: link.column }), String(ch.before[link.parentColumn])), [link.parentColumn], raw);
      }
    }
    return null;
  }

  function explainDeleteBlock(game, t, att, raw) {
    const sim = B.simulateDelete(game, t.name, (att.probe && att.probe.removed) || []);
    const b = sim.blocked;
    if (!b) return null;
    const parent = S.findTable(game.tables, b.parentTable);
    const child = S.findTable(game.tables, b.child);
    const top = (att.probe.removed || [])[0];
    const inactive = t.columns.some(c => c.name === 'is_active') ? ', or mark it inactive instead' : '';
    let h;
    if (b.kind === 'notnull') {
      h = `Deleting this ${S.noun(t)} would make ${code(`${b.child}.${b.column}`)} blank (ON DELETE SET NULL), but that column can't be blank. Let it be blank, or choose another delete rule.`;
      return result('notnull', h, chips(b.child, 'NOT NULL', 'NULL'), [], raw);
    }
    const kids = `${b.count} ${plural(b.count, S.noun(child))}`;
    const rule = `${code(`ON DELETE ${b.onDelete}`)} on ${b.child}.${b.column}`;
    if (b.parentTable === t.name) {
      h = `${nameRow(t, b.parentRow)} still has ${kids}. The rule ${rule} blocks the delete. Delete or move those ${plural(2, S.noun(child))} first${inactive}.`;
    } else {
      h = `Deleting ${top ? nameRow(t, top) : `this ${S.noun(t)}`} would also delete its ${plural(2, S.noun(parent))} (ON DELETE CASCADE). ` +
        `But ${S.noun(parent)} ${keyText(parent, b.parentRow)} still has ${kids}, and the rule ${rule} blocks that.`;
    }
    return result('fk-child', h, chips(b.child, S.describeConstraint(child, { kind: 'fk-delete', column: b.column }), keyText(parent, b.parentRow)), [], raw);
  }

  // att = { kind: 'insert' | 'update' | 'delete', table, probe }
  function explainConstraint(game, att, raw) {
    const t = S.findTable(game.tables, att.table);
    let m;
    if ((m = /^NOT NULL constraint failed: (\w+)\.(\w+)$/.exec(raw))) {
      if (att.kind === 'delete') { const d = explainDeleteBlock(game, t, att, raw); if (d) return d; }
      const tt = S.findTable(game.tables, m[1]) || t;
      return result('notnull', `Every ${S.noun(tt)} needs a ${code(m[2])}. You left it blank.`, chips(tt.name, 'NOT NULL', 'NULL'), [m[2]], raw);
    }
    if ((m = /^UNIQUE constraint failed: (.+)$/.exec(raw))) {
      const cols = m[1].split(', ').map(x => x.split('.')[1]);
      return explainUnique(game, t, cols, att, raw);
    }
    if ((m = /^CHECK constraint failed: cg_type_(\w+)$/.exec(raw))) {
      const col = S.findColumn(t, m[1]);
      const r = attempted(att.probe).find(x => x[col.name] !== null && x[col.name] !== undefined) || {};
      const v = S.showValue(col, r[col.name]);
      return result('type', `${code(col.name)} needs ${S.typeOf(col).needs}. ${code(v)} won't work.`, chips(t.name, S.describeConstraint(t, { kind: 'type', column: col.name }), v), [col.name], raw);
    }
    if ((m = /^CHECK constraint failed: (.+)$/.exec(raw))) return explainCheck(game, t, m[1], att, raw);
    if (/^FOREIGN KEY constraint failed$/.test(raw)) {
      const e = att.kind === 'delete' ? explainDeleteBlock(game, t, att, raw)
        : (explainFkParent(game, t, att, raw) || (att.kind === 'update' ? explainFkKeyUpdate(game, t, att, raw) : null));
      if (e) return e;
      return result('fk-unknown', "A row points to something that doesn't exist, or something still points to this row.", chips(t.name, 'REFERENCES', ''), [], raw);
    }
    return result('other', "Something went wrong. (SQLite's message is shown below.)", chips(t ? t.name : '', '', ''), [], raw);
  }

  const api = { explainConstraint, rowLabel: label, nameRow };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
