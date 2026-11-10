// Constraint Gauntlet: column types, CREATE TABLE text (shown and hidden), seed order, probe tables.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const q = s => `'${String(s).replace(/'/g, "''")}'`;
  const scale = col => (col.precision ? col.precision[1] : 2);

  // Hidden checks keep text out of number, date, time, and boolean columns (spec §4.3).
  // Every condition is wrapped as "<col> IS NULL OR (…)": typeof(NULL) is 'null', so without it NULL would be blocked.
  const TYPES = {
    int: {
      sql: () => 'INT',
      hidden: c => `typeof(${c}) = 'integer'`,
      parse: t => (/^-?\d+$/.test(t) ? Number(t) : new Error('needs a whole number')),
      show: v => String(v),
      needs: 'a whole number',
    },
    decimal: {
      sql: col => `DECIMAL(${(col.precision || [8, 2]).join(',')})`,
      hidden: c => `typeof(${c}) IN ('integer','real')`,
      parse: t => (/^-?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : new Error('needs a number, like 45.00')),
      show: (v, col) => (typeof v === 'number' ? v.toFixed(scale(col)) : String(v)),
      needs: 'a number',
    },
    varchar: {
      sql: col => `VARCHAR(${col.size || 255})`,
      hidden: () => null,
      parse: t => t,
      show: v => String(v),
      needs: 'text',
    },
    date: {
      sql: () => 'DATE',
      hidden: c => `typeof(${c}) = 'text' AND ${c} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`,
      parse: t => (/^\d{4}-[01]\d-[0-3]\d$/.test(t) ? t : new Error('needs a date like 2026-11-10')),
      show: v => String(v),
      needs: 'a date like 2026-11-10',
    },
    time: {
      sql: () => 'TIME',
      hidden: c => `typeof(${c}) = 'text' AND ${c} GLOB '[0-2][0-9]:[0-5][0-9]'`,
      parse: t => (/^[0-2]\d:[0-5]\d$/.test(t) ? t : new Error('needs a time like 19:30')),
      show: v => String(v),
      needs: 'a time like 19:30',
    },
    boolean: {
      sql: () => 'BOOLEAN',
      hidden: c => `${c} IN (0, 1)`,
      parse: t => (/^true$/i.test(t) ? true : /^false$/i.test(t) ? false : new Error('needs true or false')),
      show: v => (v === true || v === 1 ? 'true' : v === false || v === 0 ? 'false' : String(v)),
      needs: 'true or false',
    },
  };

  const typeOf = col => {
    const t = TYPES[col.type];
    if (!t) throw new Error(`Unknown column type "${col.type}" on ${col.name}`);
    return t;
  };

  function showValue(col, v) {
    if (v === null || v === undefined) return 'NULL';
    return typeOf(col).show(v, col);
  }

  function defaultSql(col, hidden) {
    const d = col.default;
    if (col.type === 'boolean') return hidden ? (d ? '1' : '0') : (d ? 'true' : 'false');
    if (typeof d === 'number') return String(d);
    return q(d);
  }

  const tablePk = t => (t.constraints || []).find(k => k.kind === 'pk');
  function pkColumns(t) {
    const k = tablePk(t);
    return k ? k.columns.slice() : t.columns.filter(c => c.pk).map(c => c.name);
  }
  const findColumn = (t, name) => t.columns.find(c => c.name.toLowerCase() === String(name).toLowerCase());
  const findTable = (tables, name) => tables.find(t => t.name.toLowerCase() === String(name).toLowerCase());
  const noun = t => t.noun || t.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

  // The parts of one column line after the name and type.
  function columnParts(t, col, hidden) {
    const inPk = pkColumns(t).includes(col.name);
    const parts = [];
    if (col.notNull || inPk) parts.push('NOT NULL');
    if (col.pk && !tablePk(t)) parts.push('PRIMARY KEY');
    if (col.unique) parts.push('UNIQUE');
    if (col.collate) parts.push(`COLLATE ${col.collate}`);
    if (col.default !== undefined) parts.push(`DEFAULT ${defaultSql(col, hidden)}`);
    if (col.check) parts.push(`CHECK (${col.check.expr})`);
    if (col.fk) parts.push(`REFERENCES ${col.fk.table}(${col.fk.column}) ON DELETE ${col.fk.onDelete || 'RESTRICT'}`);
    if (hidden) {
      const h = typeOf(col).hidden(col.name);
      if (h) parts.push(`CONSTRAINT cg_type_${col.name} CHECK (${col.name} IS NULL OR (${h}))`);
    }
    return parts;
  }

  function tableConstraintSql(k) {
    if (k.kind === 'unique') return `UNIQUE (${k.columns.join(', ')})`;
    if (k.kind === 'pk') return `PRIMARY KEY (${k.columns.join(', ')})`;
    if (k.kind === 'check') return `${k.name ? `CONSTRAINT ${k.name} ` : ''}CHECK (${k.expr})`;
    throw new Error(`Unknown table constraint kind "${k.kind}"`);
  }

  // The full CREATE TABLE. hidden: false is the version students see, formatted the book's way.
  function createTableSql(t, { hidden = true } = {}) {
    const nameW = Math.max(...t.columns.map(c => c.name.length)) + 1;
    const typeW = Math.max(...t.columns.map(c => typeOf(c).sql(c).length)) + 1;
    const lines = t.columns.map(c => {
      const parts = columnParts(t, c, hidden);
      const head = c.name.padEnd(nameW) + (parts.length ? typeOf(c).sql(c).padEnd(typeW) : typeOf(c).sql(c));
      return ('    ' + head + parts.join(' ')).replace(/\s+$/, '');
    });
    for (const k of t.constraints || []) lines.push('    ' + tableConstraintSql(k));
    return `CREATE TABLE ${t.name} (\n${lines.join(',\n')}\n);`;
  }

  // Same columns and defaults, no constraints: the copy the probe runs statements against (Task 6).
  function probeTableSql(t, name) {
    const cols = t.columns.map(c => `${c.name} ${typeOf(c).sql(c)}${c.default !== undefined ? ` DEFAULT ${defaultSql(c, true)}` : ''}`);
    return `CREATE TABLE ${name} (${cols.join(', ')})`;
  }

  // Parents before children. FKs to tables outside the list, self-references, and cycles are ignored.
  function seedOrder(tables) {
    const names = tables.map(t => t.name);
    const parents = Object.fromEntries(tables.map(t => [t.name,
      new Set(t.columns.filter(c => c.fk && c.fk.table !== t.name && names.includes(c.fk.table)).map(c => c.fk.table))]));
    const placed = [];
    let left = names.slice();
    while (left.length) {
      const ready = left.filter(n => [...parents[n]].every(p => placed.includes(p)));
      if (!ready.length) { placed.push(...left); break; } // a cycle (Level 7 bonus): keep the written order
      placed.push(...ready);
      left = left.filter(n => !ready.includes(n));
    }
    return placed;
  }

  function encode(col, v) {
    if (v === undefined) v = col.default !== undefined ? col.default : null;
    if (col.type === 'boolean' && typeof v === 'boolean') return v ? 1 : 0;
    return v;
  }
  const rowToValues = (t, row) => t.columns.map(c => encode(c, row[c.name]));
  function valuesToRow(t, values) {
    const row = {};
    t.columns.forEach((c, i) => {
      const v = values[i];
      row[c.name] = c.type === 'boolean' && (v === 0 || v === 1) ? v === 1 : v;
    });
    return row;
  }

  // The shape SQL Studio's errors.js and editor.js read.
  function toStudioSchema(tables) {
    return {
      tables: tables.map(t => ({ name: t.name, columns: t.columns.map(c => ({ name: c.name })) })),
      relationships: tables.flatMap(t => t.columns.filter(c => c.fk)
        .map(c => ({ from: { table: t.name, column: c.name }, to: { table: c.fk.table, column: c.fk.column } }))),
    };
  }

  // The label for the "rule" chip.
  function describeConstraint(t, which) {
    const col = which.column ? findColumn(t, which.column) : null;
    switch (which.kind) {
      case 'notnull': return 'NOT NULL';
      case 'pk': return `PRIMARY KEY (${(which.columns || pkColumns(t)).join(', ')})`;
      case 'unique': {
        const cols = which.columns || [which.column];
        const c1 = cols.length === 1 ? findColumn(t, cols[0]) : null;
        return `UNIQUE (${cols.join(', ')})${c1 && c1.collate ? ` COLLATE ${c1.collate}` : ''}`;
      }
      case 'check': return which.name ? `CHECK ${which.name} (${which.expr})` : `CHECK (${which.expr})`;
      case 'fk': return `REFERENCES ${col.fk.table}(${col.fk.column})`;
      case 'fk-delete': return `ON DELETE ${col.fk.onDelete || 'RESTRICT'}`;
      case 'type': return `must be ${typeOf(col).needs}`;
      default: return '';
    }
  }

  const api = { TYPES, typeOf, showValue, pkColumns, findColumn, findTable, noun, createTableSql, probeTableSql, seedOrder,
    rowToValues, valuesToRow, toStudioSchema, describeConstraint };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
