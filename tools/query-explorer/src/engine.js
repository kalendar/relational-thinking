// Query Explorer engine: tables and the four operations as pure functions. No DOM.
(function (root) {
  'use strict';

  const CONDITIONS = {
    text: [
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'is_one_of', label: 'is one of' },
      { id: 'contains', label: 'contains' },
    ],
    number: [
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'more_than', label: 'is more than' },
      { id: 'less_than', label: 'is less than' },
      { id: 'at_least', label: 'is at least' },
      { id: 'at_most', label: 'is at most' },
      { id: 'between', label: 'is between' },
    ],
    date: [
      { id: 'on', label: 'is on' },
      { id: 'before', label: 'is before' },
      { id: 'after', label: 'is after' },
      { id: 'between', label: 'is between' },
    ],
  };

  function loadTable(def) {
    const columns = def.columns.map(c => ({ ...c, origin: def.name }));
    const rows = def.rows.map(r => {
      const row = {};
      columns.forEach((c, i) => { row[c.name] = r[i]; });
      return row;
    });
    return { name: def.name, sources: [def.name], columns, rows };
  }

  function getColumn(table, name) {
    return table.columns.find(c => c.name === name) || null;
  }

  function findTableDef(dataset, name) {
    return dataset.tables.find(t => t.name === name) || null;
  }

  function norm(v) {
    return String(v).trim().toLowerCase();
  }

  function matches(value, type, f) {
    const c = f.condition;
    if (type === 'text') {
      const v = norm(value);
      switch (c) {
        case 'is': return v === norm(f.value);
        case 'is_not': return v !== norm(f.value);
        case 'is_one_of': return (f.values || []).some(x => norm(x) === v);
        case 'contains': return v.includes(norm(f.value));
      }
    }
    if (type === 'number') {
      const a = Number(f.value);
      switch (c) {
        case 'is': return value === a;
        case 'is_not': return value !== a;
        case 'more_than': return value > a;
        case 'less_than': return value < a;
        case 'at_least': return value >= a;
        case 'at_most': return value <= a;
        case 'between': {
          const b = Number(f.value2);
          return value >= Math.min(a, b) && value <= Math.max(a, b);
        }
      }
    }
    if (type === 'date') {
      const a = f.value;
      switch (c) {
        case 'on': return value === a;
        case 'before': return value < a;
        case 'after': return value > a;
        case 'between': {
          const b = f.value2;
          const lo = a < b ? a : b;
          const hi = a < b ? b : a;
          return value >= lo && value <= hi;
        }
      }
    }
    throw new Error(`Unknown condition "${c}" for a ${type} column`);
  }

  function filterTable(table, step) {
    const type = getColumn(table, step.column).type;
    const kept = [];
    const dropped = [];
    table.rows.forEach((row, i) => (matches(row[step.column], type, step) ? kept : dropped).push(i));
    return { table: { ...table, rows: kept.map(i => table.rows[i]) }, trace: { kept, dropped } };
  }

  const api = { CONDITIONS, loadTable, getColumn, findTableDef, filterTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
