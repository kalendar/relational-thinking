// Query Explorer: decides which rows and columns get which highlight. No DOM.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const engine = node ? require('./engine.js') : root.QE;
  const describe = node ? require('./describe.js') : root.QE;

  const COLORS = 5;
  const keyOf = v => String(v).trim().toLowerCase();

  function colorClass(id) {
    return id === null || id === undefined ? null : 'c' + (id % COLORS);
  }

  function visualPlan(step, before, result, other) {
    const trace = result.trace;
    if (step.op === 'filter') {
      const kept = new Set(trace.kept);
      return {
        op: 'filter',
        beforeRows: before.rows.map((_, i) => (kept.has(i) ? 'keep' : 'drop')),
        afterRows: result.table.rows.map(() => 'keep'),
      };
    }
    if (step.op === 'project') {
      return { op: 'project', dropped: trace.dropped, afterRows: result.table.rows.map(() => null) };
    }
    if (step.op === 'join') {
      const leftMatch = before.rows.map(() => null);
      const rightMatch = other.rows.map(() => null);
      if (trace.cartesian) {
        return { op: 'join', cartesian: true, leftMatch, rightMatch, afterRows: result.table.rows.map(() => null) };
      }
      const ids = new Map();
      trace.pairs.forEach(([li, ri]) => {
        const k = keyOf(before.rows[li][step.leftColumn]);
        if (!ids.has(k)) ids.set(k, ids.size);
        leftMatch[li] = ids.get(k);
        rightMatch[ri] = ids.get(k);
      });
      return { op: 'join', cartesian: false, leftMatch, rightMatch, afterRows: trace.pairs.map(([li]) => colorClass(leftMatch[li])) };
    }
    if (step.op === 'aggregate') {
      const rowGroup = before.rows.map(() => null);
      trace.groups.forEach((g, gi) => g.forEach(i => { rowGroup[i] = gi; }));
      const labels = trace.groups.map(g => (step.groupBy.length && g.length
        ? step.groupBy.map(c => describe.formatValue(before.rows[g[0]][c], engine.getColumn(before, c))).join(' · ')
        : 'All rows'));
      return { op: 'aggregate', order: trace.groups.flat(), rowGroup, labels, afterRows: trace.groups.map((_, gi) => colorClass(gi)) };
    }
    throw new Error(`Unknown step type "${step.op}"`);
  }

  const api = { COLORS, colorClass, visualPlan };
  if (node) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
