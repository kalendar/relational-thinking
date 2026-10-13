// Query Explorer: value formatting and plain-English step sentences. No DOM.
(function (root) {
  'use strict';
  const engine = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.QE;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ALL_CONDITIONS = [].concat(...Object.values(engine.CONDITIONS));

  function formatDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }

  function formatValue(value, column) {
    if (value === null || value === undefined || value === '') return '—';
    const type = column ? column.type : 'text';
    if (type === 'date') return formatDate(value);
    if (type === 'number') {
      const n = Number(value);
      if (column.key || column.plain) return String(n);
      return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return String(value);
  }

  const code = s => '`' + s + '`';
  const bold = s => '**' + s + '**';

  function listJoin(items) {
    if (items.length <= 2) return items.join(' and ');
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  function conditionLabel(id, type) {
    const found = (engine.CONDITIONS[type] || []).find(c => c.id === id) || ALL_CONDITIONS.find(c => c.id === id);
    return found ? found.label : id;
  }

  function describeStart(name) {
    return 'Start with ' + bold(name);
  }

  function describeStep(step, input) {
    switch (step.op) {
      case 'filter': {
        const col = input ? engine.getColumn(input, step.column) : null;
        const shown = col || { type: 'text' };
        const fmt = v => bold(formatValue(shown.type === 'number' ? Number(v) : v, shown));
        let value;
        if (step.condition === 'between') value = fmt(step.value) + ' and ' + fmt(step.value2);
        else if (step.condition === 'is_one_of') value = (step.values || []).map(bold).join(', ');
        else value = fmt(step.value);
        return `Keep only rows where ${code(step.column)} ${conditionLabel(step.condition, shown.type)} ${value}`;
      }
      case 'project':
        return 'Keep only the columns ' + step.columns.map(code).join(', ');
      case 'join':
        if (step.cartesian) return `Combine every row with every row of ${bold(step.table)}`;
        if (step.leftColumn === step.rightColumn) return `Combine with ${bold(step.table)}, matching ${code(step.leftColumn)}`;
        return `Combine with ${bold(step.table)}, matching ${code(step.leftColumn)} to ${code(step.rightColumn)}`;
      case 'aggregate': {
        const sums = listJoin(step.summaries.map(s => {
          if (s.fn === 'count') return 'the count of rows';
          const fn = engine.SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
          return `the ${fn.label} of ${code(s.column)}`;
        }));
        return step.groupBy.length
          ? `Group by ${listJoin(step.groupBy.map(code))} and calculate ${sums}`
          : `For the whole table, calculate ${sums}`;
      }
    }
    return 'Unknown step';
  }

  function describeRecipe(dataset, recipe) {
    const results = engine.runRecipe(dataset, recipe);
    return [describeStart(recipe.start), ...recipe.steps.map((s, k) => describeStep(s, results[k].table))];
  }

  function parseRich(str) {
    const parts = [];
    const re = /\*\*(.+?)\*\*|`(.+?)`/g;
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      if (m.index > last) parts.push({ kind: 'text', text: str.slice(last, m.index) });
      parts.push(m[1] !== undefined ? { kind: 'strong', text: m[1] } : { kind: 'code', text: m[2] });
      last = re.lastIndex;
    }
    if (last < str.length) parts.push({ kind: 'text', text: str.slice(last) });
    return parts;
  }

  const api = { formatValue, formatDate, describeStart, describeStep, describeRecipe, parseRich };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
