// Query Explorer: draws a table and the size counter.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h } = QE;

  function keyBadge(col) {
    if (col.key === 'pk') return h('span', { class: 'badge', title: 'Primary key', 'aria-label': 'primary key' }, '🔑');
    if (col.key === 'fk') return h('span', { class: 'badge', title: `Foreign key to ${col.ref}`, 'aria-label': `foreign key to ${col.ref}` }, '🔗');
    return null;
  }

  function cls(...names) {
    const s = names.filter(Boolean).join(' ');
    return s || null;
  }

  function renderTable(table, opts = {}) {
    const colClass = name => (opts.colClass ? opts.colClass(name) : null);
    const head = h('tr', null, table.columns.map(c =>
      h('th', { scope: 'col', class: cls(c.type === 'number' && 'num', colClass(c.name)) }, h('code', null, c.name), keyBadge(c))));
    const body = [];
    table.rows.forEach((row, i) => {
      body.push(h('tr', { class: opts.rowClass ? opts.rowClass(i) : null, 'data-row': String(opts.rowKey ? opts.rowKey(i) : i) },
        table.columns.map((c, ci) => h('td', { class: cls(c.type === 'number' && 'num', colClass(c.name)) },
          ci === 0 && opts.rowTag ? opts.rowTag(i) : null,
          QE.formatValue(row[c.name], c)))));
      if (opts.afterRow) body.push(...opts.afterRow(i));
    });
    if (!table.rows.length) {
      body.push(h('tr', null, h('td', { class: 'empty', colspan: String(Math.max(1, table.columns.length)) }, opts.emptyMessage || 'No rows.')));
    }
    return h('div', { class: cls('table-wrap', opts.wrapClass) },
      h('table', { class: 'data' }, h('thead', null, head), h('tbody', null, body)));
  }

  function sizeText(t) {
    const r = t.rows.length;
    const c = t.columns.length;
    return `${r.toLocaleString('en-US')} ${r === 1 ? 'row' : 'rows'} × ${c} ${c === 1 ? 'column' : 'columns'}`;
  }

  function renderCounter(before, after) {
    if (!before) return h('p', { class: 'counter' }, h('strong', null, sizeText(after)));
    return h('p', { class: 'counter', 'aria-live': 'polite' },
      sizeText(before), h('span', { 'aria-hidden': 'true' }, ' → '), h('span', { class: 'sr-only' }, ' becomes '), h('strong', null, sizeText(after)));
  }

  root.QE = Object.assign(QE, { renderTable, sizeText, renderCounter });
})(this);
