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

  const SUMMARY_FUNCTIONS = [
    { id: 'count', label: 'count of rows', prefix: 'number_of_rows', types: [] },
    { id: 'total', label: 'total', prefix: 'total', types: ['number'] },
    { id: 'average', label: 'average', prefix: 'average', types: ['number'] },
    { id: 'lowest', label: 'lowest', prefix: 'lowest', types: ['number', 'date'] },
    { id: 'highest', label: 'highest', prefix: 'highest', types: ['number', 'date'] },
  ];

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

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function summarize(fn, rows, column) {
    if (fn === 'count') return rows.length;
    const vals = rows.map(r => r[column]).filter(v => v !== null && v !== undefined);
    if (fn === 'total') return round2(vals.reduce((s, v) => s + v, 0));
    if (!vals.length) return null;
    if (fn === 'average') return round2(vals.reduce((s, v) => s + v, 0) / vals.length);
    if (fn === 'lowest') return vals.reduce((m, v) => (v < m ? v : m));
    if (fn === 'highest') return vals.reduce((m, v) => (v > m ? v : m));
    throw new Error(`Unknown summary "${fn}"`);
  }

  function aggregateTable(table, step) {
    const index = new Map();
    const groups = [];
    table.rows.forEach((row, i) => {
      const key = JSON.stringify(step.groupBy.map(g => row[g]));
      if (!index.has(key)) { index.set(key, groups.length); groups.push([]); }
      groups[index.get(key)].push(i);
    });
    if (!step.groupBy.length && !groups.length) groups.push([]);

    const groupCols = step.groupBy.map(g => getColumn(table, g));
    const used = new Set(groupCols.map(c => c.name));
    const sumCols = step.summaries.map(s => {
      const fn = SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
      const base = s.fn === 'count' ? fn.prefix : `${fn.prefix}_${s.column.replace(/\./g, '_')}`;
      let name = base;
      for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
      used.add(name);
      const type = s.fn === 'lowest' || s.fn === 'highest' ? getColumn(table, s.column).type : 'number';
      return { name, type, origin: table.name, summary: s };
    });

    const rows = groups.map(members => {
      const memberRows = members.map(i => table.rows[i]);
      const row = {};
      groupCols.forEach(c => { row[c.name] = memberRows[0][c.name]; });
      sumCols.forEach(c => { row[c.name] = summarize(c.summary.fn, memberRows, c.summary.column); });
      return row;
    });
    const columns = [...groupCols, ...sumCols.map(({ summary, ...c }) => c)];
    return { table: { ...table, columns, rows }, trace: { groups } };
  }

  const api = { CONDITIONS, SUMMARY_FUNCTIONS, loadTable, getColumn, findTableDef, filterTable, projectTable, joinTable, suggestJoinKey, aggregateTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
