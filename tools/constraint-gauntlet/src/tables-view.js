// Constraint Gauntlet: the Tables panel. Tabs per table, a grid of the rows, report cards, and labels for
// the newest row, the latest bounced row, rows that slipped through, and orphans (rows pointing at nothing).
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const keyOf = (t, row) => `${t.name}#${CG.pkColumns(t).map(k => row[k]).join('|')}`;

  function visibleTables(ctx, st) {
    const bonus = ctx.level.bonusTables || [];
    return st.tables.filter(t => !bonus.includes(t.name) || ctx.ui.bonusOpen);
  }

  function orphanCols(ctx, st, t, row) {
    const def = CG.findTable(ctx.level.tables, t.name) || t;
    return def.columns.filter(c => c.fk && row[c.name] !== null && row[c.name] !== undefined &&
      st.rows[c.fk.table] && !st.rows[c.fk.table].some(p => p[c.fk.column] === row[c.name])).map(c => c.name);
  }

  function reportCards(ctx) {
    const reports = (ctx.level.reports || []).filter(r => !r.hidden);
    if (!reports.length) return null;
    const vals = reports.map(r => { try { return ctx.session.report(r.id); } catch (_) { return { columns: [], rows: [] }; } });
    const first = v => (v.rows[0] ? v.rows[0][v.columns[0]] : null);
    const mismatch = reports.length > 1 && vals.some(v => first(v) !== first(vals[0]));
    return h('div', { class: `cg-reports${mismatch ? ' mismatch' : ''}`, role: 'group', 'aria-label': 'Report cards' },
      reports.map((r, i) => h('div', { class: 'cg-report' },
        h('p', { class: 'cg-report-title' }, r.title),
        h('p', { class: 'cg-report-vals' }, vals[i].columns.map(c => {
          const v = vals[i].rows[0] ? vals[i].rows[0][c] : null;
          const shown = v === null || v === undefined ? '—' : c === 'revenue' || c === 'total' ? `$${Number(v).toFixed(2)}` : String(v);
          return h('span', { class: 'cg-report-val' }, h('strong', null, shown), ` ${c}`);
        })))),
      mismatch ? h('p', { class: 'cg-report-note' }, icon('alert'), 'These don’t match. Some rows are missing from one of them.') : null);
  }

  function renderTables(panel, ctx) {
    const st = ctx.session.state();
    const tables = visibleTables(ctx, st);
    if (!tables.some(t => t.name === ctx.ui.tableTab)) ctx.ui.tableTab = tables[0].name;
    const t = CG.findTable(st.tables, ctx.ui.tableTab);
    const rows = st.rows[t.name];
    const pk = CG.pkColumns(t);

    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Tables' }, tables.map(x => h('button', {
      type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(x.name === t.name),
      onclick: () => { ctx.ui.tableTab = x.name; ctx.render(); } }, `${x.name} (${st.rows[x.name].length})`)));
    SS.clear(panel.headSlot).append(tabs);

    const last = st.log[st.log.length - 1];
    const newKeys = new Set(last && last.outcome !== 'rejected' && last.kind !== 'delete' && last.n === ctx.ui.flashN
      ? last.rows.map(r => keyOf(CG.findTable(st.tables, last.table), r)) : []);
    const slipped = new Set(st.log.filter(a => a.outcome === 'slipped').flatMap(a => a.rows.map(r => keyOf(CG.findTable(st.tables, a.table), r))));
    const sel = ctx.ui.selected;

    const head = h('tr', null, t.columns.map(c => h('th', { scope: 'col', class: ['int', 'decimal'].includes(c.type) ? 'num' : null },
      h('span', { class: 'th-inner' }, c.name,
        pk.includes(c.name) ? h('span', { class: 'cg-badge pk', title: 'Primary key' }, 'PK') : null,
        c.fk ? h('span', { class: 'cg-badge fk', title: `Foreign key to ${c.fk.table}` }, 'FK') : null))),
    h('th', { scope: 'col', class: 'cg-status-col' }, h('span', { class: 'sr-only' }, 'Status')));

    const bodyRows = rows.map((r, i) => {
      const k = keyOf(t, r);
      const orphan = orphanCols(ctx, st, t, r);
      const isSel = sel && sel.table === t.name && sel.rowid === r._rowid;
      const status = [];
      if (slipped.has(k)) status.push(h('span', { class: 'cg-tag slipped' }, '! slipped through'));
      if (orphan.length) status.push(h('span', { class: 'cg-tag orphan' }, `points to nothing (${orphan.join(', ')})`));
      if (r.is_active === false) status.push(h('span', { class: 'cg-tag inactive' }, 'inactive'));
      const tr = h('tr', { tabindex: '0', 'aria-selected': String(!!isSel),
        class: [newKeys.has(k) && !SS.reducedMotion() ? 'cg-row--new' : '', isSel ? 'cg-row--selected' : '', orphan.length ? 'cg-row--orphan' : '', slipped.has(k) ? 'cg-row--slipped' : ''].join(' ').trim() || null,
        onclick: () => ctx.act.selectRow(t.name, r._rowid),
        onkeydown: e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.act.selectRow(t.name, r._rowid); }
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const sib = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
            if (sib && sib.tabIndex === 0) sib.focus();
          }
        } },
      t.columns.map(c => {
        const v = r[c.name];
        const isNull = v === null || v === undefined;
        return h('td', { class: [isNull ? 'null' : '', ['int', 'decimal'].includes(c.type) ? 'num' : ''].join(' ').trim() || null }, CG.showValue(c, v));
      }),
      h('td', { class: 'cg-status-col' }, status));
      tr.dataset.index = String(i);
      return tr;
    });

    let bounced = null;
    if (last && last.outcome === 'rejected' && last.table === t.name && last.kind !== 'delete' && last.rows.length) {
      bounced = last.rows.map(r => h('tr', { class: 'cg-row--bounced' }, t.columns.map(c => h('td', { class: r[c.name] === null || r[c.name] === undefined ? 'null' : null }, CG.showValue(c, r[c.name]))),
        h('td', { class: 'cg-status-col' }, h('span', { class: 'cg-tag bounced' }, `✗ bounced: ${last.error ? SS.plain(last.error.chips.rule || last.error.kind) : 'refused'}`))));
    }

    const empty = !rows.length && !bounced ? h('tr', null, h('td', { colspan: String(t.columns.length + 1), class: 'cg-empty-row' }, 'No rows yet.')) : null;
    const table = h('table', { class: 'data cg-grid', 'aria-label': `${t.name} rows. Select a row to edit or delete it.` },
      h('thead', null, head), h('tbody', null, bodyRows, bounced, empty));
    SS.clear(panel.body).append(h('div', { class: 'cg-tables' }, reportCards(ctx), h('div', { class: 'cg-grid-wrap' }, table),
      h('p', { class: 'cg-grid-note' }, 'Click a row (or press Enter on it) to pick it for Edit or Delete.')));
  }

  CG.renderTables = renderTables;
})(this);
