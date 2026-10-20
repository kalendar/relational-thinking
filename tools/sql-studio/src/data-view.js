// SQL Studio: the Data panel. A tab for each table; shows the first 10 rows and the total count.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, clear } = SS;
  const PREVIEW_ROWS = 10;

  function createDataView(panel) {
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Tables' });
    panel.headSlot.append(tabs);
    const body = h('div', { class: 'data-body', role: 'tabpanel', id: 'data-tabpanel', tabindex: '0' });
    panel.body.append(body);
    let studio = null;
    let selected = 0;

    function setStudio(st) {
      studio = st;
      selected = 0;
      drawTabs();
      show(0, false);
    }

    function drawTabs() {
      clear(tabs);
      studio.schema.tables.forEach((t, i) => tabs.append(h('button', {
        type: 'button', class: 'tab', role: 'tab', id: `data-tab-${i}`, 'aria-controls': 'data-tabpanel',
        'aria-selected': String(i === selected), tabindex: i === selected ? '0' : '-1', onclick: () => show(i, true),
        onkeydown: e => {
          const n = studio.schema.tables.length;
          const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          if (k) { e.preventDefault(); show((i + k + n) % n, true); }
          else if (e.key === 'Home') { e.preventDefault(); show(0, true); }
          else if (e.key === 'End') { e.preventDefault(); show(n - 1, true); }
        },
      }, t.name)));
    }

    function show(i, focusTab) {
      selected = i;
      drawTabs();
      if (focusTab) tabs.children[i].focus();
      const t = studio.schema.tables[i];
      body.setAttribute('aria-labelledby', `data-tab-${i}`);
      const q = SS.quoteIdent(t.name);
      const rows = SS.runQuery(studio, `SELECT * FROM ${q} LIMIT ${PREVIEW_ROWS}`);
      const total = SS.runQuery(studio, `SELECT COUNT(*) FROM ${q}`);
      clear(body);
      if (!rows.ok || !total.ok) { body.append(h('p', null, 'This table could not be shown.')); return; }
      const n = total.rows[0][0];
      body.append(h('p', { class: 'data-count' }, n <= PREVIEW_ROWS ? `Showing all ${n} rows of ${t.name}.` : `Showing ${PREVIEW_ROWS} of ${n.toLocaleString('en-US')} rows of ${t.name}.`));
      body.append(SS.renderDataTable(rows.columns, rows.rows, { caption: `First rows of the ${t.name} table` }));
    }

    return { setStudio };
  }

  root.SS = Object.assign(SS, { createDataView });
})(this);
