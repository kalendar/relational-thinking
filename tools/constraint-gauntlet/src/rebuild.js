// Constraint Gauntlet: Fix the rule. A fix rebuilds the table (SQLite can't change a constraint in place),
// and the fix test replays the student's attempts and the level's test rows against the new rule.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;
  const D = isNode ? require('./db.js') : root.CG;
  const E = isNode ? require('./constraint-errors.js') : root.CG;
  const R = isNode ? require('./rowform-sql.js') : root.CG;
  const P = isNode ? require('./probe.js') : root.CG;
  const ST = isNode ? require('./statement.js') : root.CG;
  const RU = isNode ? require('./rules.js') : root.CG;
  const T = isNode ? require('../../sql-studio/src/sql-text.js') : root.SS;

  const cloneTable = t => Object.assign({}, t, {
    columns: t.columns.map(c => Object.assign({}, c, c.fk ? { fk: Object.assign({}, c.fk) } : {}, c.check ? { check: Object.assign({}, c.check) } : {})),
    constraints: (t.constraints || []).map(k => Object.assign({}, k)),
  });

  function applyOption(tableDef, option) {
    const next = option.change(cloneTable(tableDef));
    const a = tableDef.columns.map(c => c.name).join();
    const b = next.columns.map(c => c.name).join();
    if (a !== b) throw new Error(`Fix option "${option.id}" changed the columns (${a} -> ${b}). A fix may only change rules.`);
    return next;
  }

  // Replace a column's CHECK with a new expression (Level 5's builder and typed fixes).
  function withCheck(tableDef, column, expr) {
    const t = cloneTable(tableDef);
    const c = S.findColumn(t, column);
    c.check = { expr };
    return t;
  }

  const OPS = ['>', '>=', '<', '<=', '=', 'BETWEEN', 'IN', 'LIKE'];
  function buildExpression(tableDef, { column, op, value, value2, list }) {
    const col = S.findColumn(tableDef, column);
    if (!col || !OPS.includes(op)) return { ok: false, message: 'Pick a column and an operator.' };
    const lit = raw => {
      const v = col.type === 'varchar' || op === 'LIKE' ? String(raw) : S.typeOf(col).parse(String(raw).trim());
      if (v instanceof Error) throw new Error(`The value ${v.message}.`);
      return op === 'LIKE' ? `'${String(raw).replace(/'/g, "''")}'` : R.literal(col, v);
    };
    try {
      if (op === 'BETWEEN') return { ok: true, expr: `${col.name} BETWEEN ${lit(value)} AND ${lit(value2)}` };
      if (op === 'IN') {
        const items = String(list || value || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!items.length) return { ok: false, message: 'List at least one value, separated by commas.' };
        return { ok: true, expr: `${col.name} IN (${items.map(lit).join(', ')})` };
      }
      if (value === undefined || value === null || String(value) === '') return { ok: false, message: 'Type a value.' };
      return { ok: true, expr: `${col.name} ${op} ${lit(value)}` };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  // A typed CHECK expression (SQL mode): one expression, this table's columns only.
  function checkExpression(game, text, tableDef) {
    const expr = String(text || '').trim();
    if (!expr) return { ok: false, message: 'Type a rule, like `price_paid > 0`.' };
    const toks = T.tokenize(expr).filter(t => t.type !== 'ws' && t.type !== 'comment');
    if (toks.some(t => t.text === ';')) return { ok: false, message: 'A rule is one expression, with no `;`.' };
    if (toks.some(t => t.type === 'word' && /^(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|ATTACH|PRAGMA)$/i.test(t.text))) {
      return { ok: false, message: 'A rule can only look at this row, so it can’t contain a query.' };
    }
    if (toks.some(t => /^sqlite_/i.test(t.text))) return { ok: false, message: 'A rule can only use this table’s columns.' };
    const cols = tableDef.columns.map(c => c.name.toLowerCase());
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const isCall = toks[i + 1] && toks[i + 1].text === '(';
      if ((t.type === 'word' && !T.isKeyword(t.text) && !isCall && !cols.includes(t.text.toLowerCase())) ||
          (t.type === 'qident' && !cols.includes(t.text.slice(1, -1).toLowerCase()))) {
        return { ok: false, message: `There's no column called \`${t.text}\` in the ${tableDef.name} table.` };
      }
    }
    try { game.db.prepare(`SELECT 1 FROM main.${tableDef.name} WHERE (${expr})`).free(); } catch (e) {
      return { ok: false, message: `SQLite couldn't read that rule: ${e.message}` };
    }
    return { ok: true, expr };
  }

  function rebuildTable(game, newDef) {
    const db = game.db;
    const old = S.findTable(game.tables, newDef.name);
    const cols = old.columns.map(c => c.name).join(', ');
    const tmp = `cg_new_${newDef.name}`;
    const tmpDef = Object.assign(cloneTable(newDef), { name: tmp, noun: S.noun(newDef) });
    const tmpGame = Object.assign({}, game, { tables: game.tables.map(t => (t.name === newDef.name ? tmpDef : t)) });
    const problems = [];
    const rows = D.tableRows(game, newDef.name);
    db.run('PRAGMA foreign_keys = OFF'); // must be outside the transaction: SQLite ignores it inside one
    try {
      db.run('BEGIN');
      try {
        db.run(S.createTableSql(tmpDef, { hidden: true }));
        const stmt = db.prepare(`INSERT INTO ${tmp} (${cols}) VALUES (${old.columns.map(() => '?').join(', ')})`);
        try {
          for (const r of rows) {
            try { stmt.run(S.rowToValues(old, r)); } catch (e) {
              const ex = E.explainConstraint(tmpGame, { kind: 'insert', table: tmp, probe: { added: [r], changed: [], removed: [] } }, e.message);
              ex.chips.table = newDef.name;
              ex.raw = ex.raw.split(tmp).join(newDef.name);
              problems.push({ row: r, explained: ex });
            }
          }
        } finally { stmt.free(); }
        if (problems.length) { db.run('ROLLBACK'); return { ok: false, reason: 'rows', problems }; }
        db.run(`DROP TABLE ${newDef.name}`);
        db.run(`ALTER TABLE ${tmp} RENAME TO ${newDef.name}`);
        const res = db.exec('PRAGMA foreign_key_check');
        const orphans = res[0] ? res[0].values : [];
        if (orphans.length) {
          const tablesAfter = game.tables.map(t => (t.name === newDef.name ? newDef : t));
          const list = orphans.map(([tname, rowid, parent]) => {
            const t = S.findTable(tablesAfter, tname);
            const v = db.exec(`SELECT ${t.columns.map(c => c.name).join(', ')} FROM main.${tname} WHERE rowid = ${Number(rowid)}`)[0].values[0];
            const row = Object.assign(S.valuesToRow(t, v), { _rowid: rowid });
            const c = t.columns.find(x => x.fk && x.fk.table === parent && row[x.name] !== null &&
              !db.exec(`SELECT 1 FROM main.${parent} WHERE ${x.fk.column} = ${typeof row[x.name] === 'number' ? row[x.name] : `'${String(row[x.name]).replace(/'/g, "''")}'`}`).length);
            const pNoun = S.noun(S.findTable(game.tables, parent) || { name: parent });
            const h = `This ${S.noun(t)} points to ${pNoun} ${c ? row[c.name] : '?'}, which doesn't exist. Fix or delete it first.`;
            return { row, explained: { kind: 'fk-parent', headline: h, chips: { table: tname, rule: c ? S.describeConstraint(t, { kind: 'fk', column: c.name }) : 'REFERENCES', value: c ? String(row[c.name]) : '' }, columns: c ? [c.name] : [], raw: 'FOREIGN KEY constraint failed' } };
          });
          db.run('ROLLBACK');
          return { ok: false, reason: 'orphans', problems: list };
        }
        db.run('COMMIT');
      } catch (e) {
        try { db.run('ROLLBACK'); } catch (_) { /* already rolled back */ }
        throw e;
      }
      game.tables = game.tables.map(t => (t.name === newDef.name ? newDef : t));
      return { ok: true, game };
    } finally {
      db.run('PRAGMA foreign_keys = ON');
      if (!D.fkOn(db)) throw new Error('Foreign keys did not turn back on.');
    }
  }

  const keyLabel = (t, row) => {
    const name = E.rowLabel(t, row);
    const key = S.pkColumns(t).map(k => row[k]).join(', ');
    return name ? `${name} (${key})` : `${S.noun(t)} ${key}`;
  };

  function verdict(legit, accepted, before) {
    if (legit && accepted) return { ok: true, text: 'real row still allowed' };
    if (!legit && !accepted) return { ok: true, text: before === 'rejected' ? 'bad row still blocked' : 'bad row now blocked' };
    if (legit) return { ok: false, text: 'real row now blocked (too strict)' };
    return { ok: false, text: 'bad row still gets in (too loose)' };
  }

  // newTables: the full table list with the fix applied. fixTable: the table being fixed.
  function fixTest(SQL, level, newTables, fixTable, log = []) {
    const g = D.openLevel(SQL, level, { tables: newTables });
    const rows = [];
    try {
      const names = newTables.map(t => t.name);
      const t = S.findTable(newTables, fixTable);
      for (const a of log) {
        if (!a.sql || a.kind === 'select') continue;
        const cls = ST.classify(a.sql, names);
        if (!cls.ok) continue;
        if (cls.table !== fixTable || cls.kind === 'delete') { try { g.db.run(a.sql); } catch (_) { /* context only */ } continue; }
        const p = P.probe(g, a.sql, cls);
        if (!p.ok) continue;
        const subjects = [...p.added, ...p.changed.map(c => c.after)];
        const legit = subjects.every(r => !RU.brokenRules(level, fixTable, r, RU.makeCtx(g, cls.kind === 'update' ? r._rowid : null)).length);
        let accepted = true;
        try { g.db.run(a.sql); } catch (_) { accepted = false; }
        const v = verdict(legit, accepted, a.outcome === 'rejected' ? 'rejected' : 'accepted');
        rows.push({ label: subjects[0] ? keyLabel(t, subjects[0]) : a.sql, source: 'yours', before: a.outcome, after: accepted ? 'accepted' : 'rejected', ok: v.ok, verdict: v.text });
      }
      const fixed = [...(level.legitRows || []).map(r => [r, true]), ...(level.badRows || []).map(r => [r, false])].filter(([r]) => r.table === fixTable);
      const fresh = D.openLevel(SQL, level, { tables: newTables });
      try {
        for (const [r, legit] of fixed) {
          fresh.db.run('SAVEPOINT cg_t');
          let accepted = true;
          try { fresh.db.run(R.insertSql(S.findTable(newTables, r.table), r.row)); } catch (_) { accepted = false; }
          fresh.db.run('ROLLBACK TO cg_t');
          fresh.db.run('RELEASE cg_t');
          const v = verdict(legit, accepted, 'new');
          rows.push({ label: r.note || keyLabel(t, r.row), source: 'test', before: 'new', after: accepted ? 'accepted' : 'rejected', ok: v.ok, verdict: v.text });
        }
      } finally { D.closeLevel(fresh); }
      return { passed: rows.every(r => r.ok), rows };
    } finally { D.closeLevel(g); }
  }

  const api = { cloneTable, applyOption, withCheck, buildExpression, checkExpression, rebuildTable, fixTest, CHECK_OPS: OPS };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
