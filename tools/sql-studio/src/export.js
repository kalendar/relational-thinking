// SQL Studio: results as TSV (for Copy), CSV (for Export), and plain text for "Copy for homework". No DOM.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const PUBLIC_URL = 'https://kalendar.github.io/relational-thinking/sql-studio.html';
  const HOMEWORK_ROWS = 20;

  // Text that starts like a formula would run in Excel; a leading ' makes it plain text. Numbers are never touched.
  const safeText = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const show = v => (v === null || v === undefined ? '' : String(v));

  function toTSV({ columns, rows }) {
    const cell = v => show(safeText(v)).replace(/[\t\r\n]+/g, ' ');
    return [columns.map(cell).join('\t'), ...rows.map(r => r.map(cell).join('\t'))].join('\n') + '\n';
  }

  function toCSV({ columns, rows }) {
    const cell = v => {
      const s = show(safeText(v));
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\r\n') + '\r\n';
  }

  // Same cleanup the Query Explorer uses for lines it copies: no newlines, no live [links].
  const cleanLine = s => String(s).replace(/\r?\n|\r/g, ' ').replace(/[[\]]/g, '\\$&');
  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

  // A simple monospace table: columns padded, numbers right-aligned, NULL spelled out.
  function textTable(columns, rows) {
    const text = v => (v === null || v === undefined ? 'NULL' : String(v).replace(/[\t\r\n]+/g, ' '));
    const isNum = columns.map((_, i) => rows.length > 0 && rows.every(r => r[i] === null || typeof r[i] === 'number'));
    const widths = columns.map((c, i) => Math.max(String(c).length, ...rows.map(r => text(r[i]).length)));
    const fmt = (vals, header) => vals.map((v, i) => (isNum[i] && !header ? text(v).padStart(widths[i]) : text(v).padEnd(widths[i]))).join(' | ').replace(/\s+$/, '');
    return [fmt(columns, true), widths.map(w => '-'.repeat(w)).join('-+-'), ...rows.map(r => fmt(r, false))].join('\n');
  }

  // result: a runQuery result, or null if the query has not run.
  function homeworkText({ datasetLabel, exerciseLabel, question, sql, result }) {
    const lines = [`SQL Studio — Exercise ${exerciseLabel}`, cleanLine(question), `Data set: ${cleanLine(datasetLabel)}`, '', 'SQL:', sql.trim(), ''];
    if (!result) lines.push('(this query did not run)');
    else if (!result.ok) lines.push('(this query did not run: it has an error)');
    else {
      const total = result.rows.length;
      lines.push(`Result (${plural(total, 'row', 'rows')} × ${plural(result.columns.length, 'column', 'columns')}):`);
      if (!total) lines.push('(no rows)');
      else {
        lines.push(textTable(result.columns, result.rows.slice(0, HOMEWORK_ROWS)));
        if (total > HOMEWORK_ROWS) lines.push(`(showing ${HOMEWORK_ROWS} of ${total.toLocaleString('en-US')} rows)`);
      }
    }
    lines.push('', `Made with SQL Studio: ${PUBLIC_URL}`, '');
    return lines.join('\n');
  }

  const homeworkFilename = exerciseLabel => `sql-studio-${String(exerciseLabel).replace(/[^\w.-]+/g, '-')}.txt`;

  const api = { PUBLIC_URL, HOMEWORK_ROWS, toTSV, toCSV, textTable, homeworkText, homeworkFilename, cleanLine };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
