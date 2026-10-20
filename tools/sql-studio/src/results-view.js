// SQL Studio: the Results panel (count, table, paging, number display, Copy, Export CSV, error box).
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, clear, icon, rich } = SS;

  const PAGE = 100;
  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
  const isNumericColumn = (rows, i) => rows.some(r => r[i] !== null) && rows.every(r => r[i] === null || typeof r[i] === 'number');

  // display: { sep: bool, dec: null | 0..3 } — changes what is shown, never the data.
  function formatCell(v, display) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v !== 'number' || !display || (!display.sep && display.dec === null)) return String(v);
    const opts = { useGrouping: !!display.sep };
    if (display.dec !== null) { opts.minimumFractionDigits = display.dec; opts.maximumFractionDigits = display.dec; } else opts.maximumFractionDigits = 10;
    return v.toLocaleString('en-US', opts);
  }

  // A real <table>. `headerExtra(i)` can add controls to a numeric header.
  function renderDataTable(columns, rows, { caption, display = [], headerExtra = null } = {}) {
    const numeric = columns.map((_, i) => isNumericColumn(rows, i));
    return h('table', { class: 'data' },
      h('caption', { class: 'sr-only' }, caption),
      h('thead', null, h('tr', null, columns.map((c, i) => h('th', { scope: 'col', class: numeric[i] ? 'num' : null },
        h('span', { class: 'th-inner' }, h('span', null, c), numeric[i] && headerExtra ? headerExtra(i, c) : null))))),
      h('tbody', null, rows.map(r => h('tr', null, r.map((v, i) => h('td', { class: [numeric[i] ? 'num' : '', v === null ? 'null' : ''].join(' ').trim() || null }, formatCell(v, display[i])))))));
  }

  function createResults(panel) {
    const count = h('span', { class: 'res-count' });
    const copyBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: onCopy }, icon('copy'), 'Copy');
    const csvBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: onCsv }, icon('download'), 'Export CSV');
    const bar = h('div', { class: 'res-bar' }, count, h('span', { class: 'spacer' }), copyBtn, csvBtn);
    const body = h('div', { class: 'res-body' });
    const pager = h('nav', { class: 'pager', 'aria-label': 'Result pages', hidden: true });
    panel.body.append(bar, body, pager);

    let result = null;
    let page = 0;
    let display = [];

    function showEmpty() {
      result = null;
      count.textContent = '';
      copyBtn.hidden = csvBtn.hidden = true;
      pager.hidden = true;
      clear(body).append(h('div', { class: 'empty-box' }, 'Run a query to display results.'));
    }

    function showResult(r, { before = null } = {}) {
      result = r;
      page = 0;
      display = r.columns.map(() => ({ sep: false, dec: null }));
      count.replaceChildren(h('strong', null, plural(r.rows.length, 'row', 'rows')), ' × ', h('strong', null, plural(r.columns.length, 'column', 'columns')));
      copyBtn.hidden = csvBtn.hidden = false;
      draw(before);
    }

    function draw(before) {
      clear(body);
      if (before) body.append(before);
      if (result.truncated) body.append(h('p', { class: 'note-box' }, `Showing the first ${result.rows.length.toLocaleString('en-US')} rows. Your query made even more than that. Is a JOIN missing its ON condition?`));
      if (!result.rows.length) {
        body.append(h('div', { class: 'empty-box' }, 'Your query ran, but no rows matched. Does that make sense for your question?'));
        pager.hidden = true;
        return;
      }
      const pages = Math.ceil(result.rows.length / PAGE);
      const rows = result.rows.slice(page * PAGE, page * PAGE + PAGE);
      body.append(renderDataTable(result.columns, rows, {
        caption: `Query results: ${plural(result.rows.length, 'row', 'rows')}, ${plural(result.columns.length, 'column', 'columns')}`,
        display,
        headerExtra: numberOptions,
      }));
      pager.hidden = pages < 2;
      if (pages > 1) {
        const first = page * PAGE + 1;
        const last = Math.min(result.rows.length, (page + 1) * PAGE);
        pager.replaceChildren(
          h('button', { type: 'button', class: 'btn', disabled: page === 0, onclick: () => go(page - 1) }, '« Prev'),
          h('span', null, `Rows ${first.toLocaleString('en-US')}–${last.toLocaleString('en-US')} of ${result.rows.length.toLocaleString('en-US')}`),
          h('button', { type: 'button', class: 'btn', disabled: page >= pages - 1, onclick: () => go(page + 1) }, 'Next »'));
      }
    }

    function go(p) {
      page = p;
      draw(null);
      body.scrollTop = 0;
      const first = page * PAGE + 1;
      SS.announce(`Showing rows ${first} to ${Math.min(result.rows.length, first + PAGE - 1)}.`);
    }

    // The ⋯ button on a numeric header: thousands separators and decimal places (display only).
    function numberOptions(i, name) {
      const btn = h('button', { type: 'button', class: 'col-opts', 'aria-label': `Number display for ${name}`, title: 'Number display' }, '⋯');
      const sep = h('input', { type: 'checkbox', id: `sep-${i}` });
      sep.checked = display[i].sep;
      const dec = h('select', { id: `dec-${i}`, 'aria-label': 'Decimal places' },
        [['', 'Auto'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']].map(([v, t]) => h('option', { value: v, selected: String(display[i].dec ?? '') === v }, t)));
      const apply = () => {
        display[i] = { sep: sep.checked, dec: dec.value === '' ? null : Number(dec.value) };
        // Update the cells in place so the popover stays open.
        const tbody = body.querySelector('tbody');
        const rows = result.rows.slice(page * PAGE, page * PAGE + PAGE);
        if (tbody) [...tbody.rows].forEach((tr, k) => { tr.cells[i].textContent = formatCell(rows[k][i], display[i]); });
      };
      sep.addEventListener('change', apply);
      dec.addEventListener('change', apply);
      const pop = h('div', { class: 'popover', role: 'group', 'aria-label': `Number display for ${name}` },
        h('h3', null, name),
        h('label', { class: 'check-label', for: `sep-${i}` }, sep, 'Thousands separators'),
        h('label', { class: 'check-label', for: `dec-${i}` }, 'Decimal places', dec),
        h('p', { class: 'added' }, 'This only changes how numbers look.'));
      return SS.popover(btn, pop).wrap;
    }

    async function onCopy() {
      if (!result) return;
      const how = await SS.copyText(SS.toTSV(result));
      SS.announce(how === 'copied' ? `Copied ${plural(result.rows.length, 'row', 'rows')}. Paste into Excel or Google Sheets.` : 'Your browser would not let us copy. Try Export CSV instead.');
    }

    function onCsv() {
      if (!result) return;
      SS.downloadText('sql-studio-results.csv', SS.toCSV(result), 'text/csv');
      SS.announce('Saved sql-studio-results.csv.');
    }

    // explained: from SS.explainError; where: { line, col } or null.
    function errorBox(explained, where, onJump) {
      return h('div', { class: 'err-box', role: 'alert' },
        h('p', { class: 'headline' }, rich(explained.headline)),
        where ? h('p', { class: 'where' }, h('button', { type: 'button', class: 'btn-link', onclick: onJump }, `Line ${where.line}, column ${where.col}`)) : null,
        explained.raw ? h('details', null, h('summary', null, 'What SQLite said'), h('code', null, explained.raw)) : null);
    }

    function showError(explained, where, onJump) {
      result = null;
      count.textContent = '';
      copyBtn.hidden = csvBtn.hidden = true;
      pager.hidden = true;
      clear(body).append(errorBox(explained, where, onJump));
    }

    showEmpty();
    return { showEmpty, showResult, showError, errorBox, get result() { return result; } };
  }

  root.SS = Object.assign(SS, { createResults, renderDataTable, formatCell, isNumericColumn });
})(this);
