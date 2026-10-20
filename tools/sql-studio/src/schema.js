// SQL Studio: turns a data set into a schema, CREATE TABLE statements, and a loaded SQLite database.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const quoteIdent = name => `"${String(name).replace(/"/g, '""')}"`;
  const pkOf = table => table.columns.find(c => c.pk);

  function sqlTypeFor(type, values) {
    if (type !== 'number') return 'TEXT';
    return values.every(v => v === null || v === undefined || Number.isInteger(v)) ? 'INTEGER' : 'REAL';
  }

  function buildSchema(dataset) {
    const pkName = name => {
      const t = dataset.tables.find(x => x.name === name);
      const c = t && t.columns.find(x => x.key === 'pk');
      return c ? c.name : null;
    };
    const tables = dataset.tables.map(t => ({
      name: t.name,
      columns: t.columns.map((c, i) => ({
        name: c.name,
        type: c.type,
        sqlType: sqlTypeFor(c.type, t.rows.map(r => r[i])),
        pk: c.key === 'pk',
        fk: c.key === 'fk' ? { table: c.ref, column: pkName(c.ref) || c.name } : null,
      })),
      rows: t.rows,
    }));
    return {
      id: dataset.id,
      number: dataset.number,
      name: dataset.name,
      description: dataset.description,
      tables,
      relationships: relationshipsOf(tables),
    };
  }

  function relationshipsOf(tables) {
    const out = [];
    for (const t of tables) for (const c of t.columns) if (c.fk) out.push({ from: { table: t.name, column: c.name }, to: { table: c.fk.table, column: c.fk.column } });
    return out;
  }

  // Parent tables first (a table comes after every table it references). Cycles fall back to the given order.
  function parentFirst(schema) {
    const done = new Set();
    const order = [];
    const visit = (t, path) => {
      if (done.has(t.name) || path.has(t.name)) return;
      path.add(t.name);
      for (const c of t.columns) {
        const parent = c.fk && schema.tables.find(x => x.name === c.fk.table);
        if (parent && parent !== t) visit(parent, path);
      }
      done.add(t.name);
      order.push(t);
    };
    schema.tables.forEach(t => visit(t, new Set()));
    return order;
  }

  function createStatements(schema) {
    return parentFirst(schema).map(t => {
      const cols = t.columns.map(c => {
        let s = `${quoteIdent(c.name)} ${c.sqlType}`;
        if (c.pk) s += ' PRIMARY KEY';
        if (c.fk) s += ` REFERENCES ${quoteIdent(c.fk.table)}(${quoteIdent(c.fk.column)})`;
        return s;
      });
      return `CREATE TABLE ${quoteIdent(t.name)} (${cols.join(', ')})`;
    });
  }

  function loadSchema(db, schema) {
    db.run('BEGIN');
    try {
      for (const ddl of createStatements(schema)) db.run(ddl);
      for (const t of parentFirst(schema)) {
        if (!t.rows.length) continue;
        const stmt = db.prepare(`INSERT INTO ${quoteIdent(t.name)} VALUES (${t.columns.map(() => '?').join(', ')})`);
        try {
          for (const r of t.rows) stmt.run(t.columns.map((c, i) => (r[i] === undefined ? null : r[i])));
        } finally {
          stmt.free();
        }
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  }

  const api = { quoteIdent, pkOf, buildSchema, relationshipsOf, createStatements, loadSchema };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
