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

  function projectTable(table, step) {
    const keep = new Set(step.columns);
    const columns = table.columns.filter(c => keep.has(c.name));
    const rows = table.rows.map(r => {
      const row = {};
      columns.forEach(c => { row[c.name] = r[c.name]; });
      return row;
    });
    return {
      table: { ...table, columns, rows },
      trace: { kept: columns.map(c => c.name), dropped: table.columns.filter(c => !keep.has(c.name)).map(c => c.name) },
    };
  }

  function sameValue(a, b, type) {
    return type === 'text' ? norm(a) === norm(b) : a === b;
  }

  function joinTable(left, right, step) {
    const cartesian = !!step.cartesian;
    const sameKey = !cartesian && step.leftColumn === step.rightColumn;
    const rightKept = right.columns.filter(c => !(sameKey && c.name === step.rightColumn));
    const leftNames = new Set(left.columns.map(c => c.name));
    const clash = new Set(rightKept.filter(c => leftNames.has(c.name)).map(c => c.name));
    const leftMap = left.columns.map(c => ({ from: c.name, col: clash.has(c.name) ? { ...c, name: `${c.origin}.${c.name}` } : c }));
    const rightMap = rightKept.map(c => ({ from: c.name, col: clash.has(c.name) ? { ...c, name: `${right.name}.${c.name}` } : c }));
    const type = cartesian ? null : getColumn(left, step.leftColumn).type;

    const pairs = [];
    const unmatchedLeft = [];
    const matchedRight = new Set();
    left.rows.forEach((lr, li) => {
      let found = false;
      right.rows.forEach((rr, ri) => {
        if (cartesian || sameValue(lr[step.leftColumn], rr[step.rightColumn], type)) {
          pairs.push([li, ri]);
          matchedRight.add(ri);
          found = true;
        }
      });
      if (!found) unmatchedLeft.push(li);
    });
    const unmatchedRight = right.rows.map((_, i) => i).filter(i => !matchedRight.has(i));
    const rows = pairs.map(([li, ri]) => {
      const row = {};
      leftMap.forEach(m => { row[m.col.name] = left.rows[li][m.from]; });
      rightMap.forEach(m => { row[m.col.name] = right.rows[ri][m.from]; });
      return row;
    });
    return {
      table: {
        name: left.name,
        sources: [...left.sources, right.name],
        columns: [...leftMap.map(m => m.col), ...rightMap.map(m => m.col)],
        rows,
      },
      trace: { pairs, unmatchedLeft, unmatchedRight, cartesian },
    };
  }

  function suggestJoinKey(current, other) {
    for (const c of current.columns) {
      for (const o of other.columns) {
        if (c.name !== o.name) continue;
        if (c.key === 'fk' && c.ref === other.name && o.key === 'pk') return { leftColumn: c.name, rightColumn: o.name };
        if (o.key === 'fk' && o.ref === c.origin && c.key === 'pk') return { leftColumn: c.name, rightColumn: o.name };
      }
    }
    return null;
  }

  const api = { CONDITIONS, loadTable, getColumn, findTableDef, filterTable, projectTable, joinTable, suggestJoinKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
