// Query Explorer: builds the "Copy for homework" answer (markdown + HTML) and the reopen link. No DOM.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? Object.assign({}, require('./engine.js'), require('./describe.js')) : root.QE;

  const PUBLIC_URL = 'https://kalendar.github.io/relational-thinking/query-explorer.html';
  const OPS = ['filter', 'project', 'join', 'aggregate'];
  const MAX_ENCODED = 20000;
  const MAX_STEPS = 40;

  // ---- reopen link ----
  function toBase64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  function encodeRecipe(datasetId, recipe) {
    const steps = recipe.steps.map(({ id, ...rest }) => rest);
    return toBase64Url(JSON.stringify({ d: datasetId, s: recipe.start, t: steps }));
  }

  const isStr = v => typeof v === 'string';
  const strList = v => Array.isArray(v) && v.every(isStr);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const scalar = v => (v === undefined || v === null ? '' : v);
  const isScalar = v => ['string', 'number'].includes(typeof v);

  // Rebuilds a step from untrusted data with only the fields we know; returns null if anything is the wrong shape.
  function cleanStep(s) {
    if (!isObj(s) || !OPS.includes(s.op)) return null;
    const on = s.on !== false;
    if (s.op === 'filter') {
      const values = s.values === undefined ? [] : s.values;
      if (!isStr(s.column) || !isStr(s.condition) || !strList(values) || !isScalar(scalar(s.value)) || !isScalar(scalar(s.value2))) return null;
      return { op: 'filter', column: s.column, condition: s.condition, value: scalar(s.value), value2: scalar(s.value2), values, on };
    }
    if (s.op === 'project') return strList(s.columns) ? { op: 'project', columns: s.columns, on } : null;
    if (s.op === 'join') {
      const leftColumn = s.leftColumn === undefined ? '' : s.leftColumn;
      const rightColumn = s.rightColumn === undefined ? '' : s.rightColumn;
      if (!isStr(s.table) || !isStr(leftColumn) || !isStr(rightColumn)) return null;
      return { op: 'join', table: s.table, leftColumn, rightColumn, cartesian: s.cartesian === true, on };
    }
    if (!strList(s.groupBy) || !Array.isArray(s.summaries)) return null;
    const summaries = s.summaries.map(x => (isObj(x) && isStr(x.fn) && (x.column === undefined || isStr(x.column)) ? { fn: x.fn, column: x.column || '' } : null));
    return summaries.includes(null) ? null : { op: 'aggregate', groupBy: s.groupBy, summaries, on };
  }

  // Returns { datasetId, recipe } or null. Never throws.
  function decodeRecipe(str) {
    try {
      if (!isStr(str) || !str || str.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+$/.test(str)) return null;
      const o = JSON.parse(fromBase64Url(str));
      if (!isObj(o) || !isStr(o.d) || !isStr(o.s) || !Array.isArray(o.t) || o.t.length > MAX_STEPS) return null;
      const steps = o.t.map(cleanStep);
      if (steps.includes(null)) return null;
      return { datasetId: o.d, recipe: { start: o.s, steps } };
    } catch (e) {
      return null;
    }
  }

  // ---- the answer ----
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mdCell = s => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n|\r/g, ' ');
  const richHtml = str => E.parseRich(str).map(p => (p.kind === 'strong' ? `<strong>${esc(p.text)}</strong>` : p.kind === 'code' ? `<code>${esc(p.text)}</code>` : esc(p.text))).join('');
  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

  function buildAnswer({ dataset, recipe, questionIndex, maxRows = 50, baseUrl = PUBLIC_URL }) {
    const label = `${dataset.number}.${questionIndex + 1}`;
    const question = dataset.questions[questionIndex].text;
    const dataLine = `${dataset.number}. ${dataset.name}`;
    const results = E.runRecipe(dataset, recipe);

    // A plain "Step N:" bullet list reads correctly as markdown and as HTML (ordered lists can't start at 0).
    const lines = [[E.describeStart(recipe.start), null]];
    recipe.steps.forEach((s, k) => lines.push([E.describeStep(s, results[k].table), results[k + 1]]));
    const recipeMd = lines.map(([text, r], n) => {
      let line = `- Step ${n}: ${text}`;
      if (r && r.status === 'off') line += ' *(turned off)*';
      if (r && r.status === 'invalid') line += ` *(skipped: ${r.message})*`;
      return line;
    });
    const recipeHtml = lines.map(([text, r], n) => {
      let line = `Step ${n}: ${richHtml(text)}`;
      if (r && r.status === 'off') line += ' <em>(turned off)</em>';
      if (r && r.status === 'invalid') line += ` <em>(skipped: ${richHtml(r.message)})</em>`;
      return `<li>${line}</li>`;
    });

    const table = results[results.length - 1].table;
    const total = table.rows.length;
    const shown = table.rows.slice(0, maxRows);
    const sizeLine = `Result (${plural(total, 'row', 'rows')} × ${plural(table.columns.length, 'column', 'columns')})`;
    const cell = (row, c) => E.formatValue(row[c.name], c);
    const capNote = total > maxRows ? `(showing ${maxRows} of ${total.toLocaleString('en-US')} rows)` : null;

    const resultMd = [];
    const resultHtml = [];
    if (!total) {
      resultMd.push('(no rows)');
      resultHtml.push('<p>(no rows)</p>');
    } else {
      resultMd.push(`| ${table.columns.map(c => mdCell(c.name)).join(' | ')} |`);
      resultMd.push(`|${table.columns.map(c => (c.type === 'number' ? '---:' : '---')).join('|')}|`);
      shown.forEach(r => resultMd.push(`| ${table.columns.map(c => mdCell(cell(r, c))).join(' | ')} |`));
      const align = c => (c.type === 'number' ? ' style="text-align:right"' : '');
      resultHtml.push('<table border="1" cellpadding="4" style="border-collapse:collapse">',
        `<thead><tr>${table.columns.map(c => `<th${align(c)}>${esc(c.name)}</th>`).join('')}</tr></thead>`,
        `<tbody>${shown.map(r => `<tr>${table.columns.map(c => `<td${align(c)}>${esc(cell(r, c))}</td>`).join('')}</tr>`).join('')}</tbody>`,
        '</table>');
      if (capNote) {
        resultMd.push('', capNote);
        resultHtml.push(`<p>${esc(capNote)}</p>`);
      }
    }

    const url = `${baseUrl}#r=${encodeRecipe(dataset.id, recipe)}`;
    const linkText = 'Open this recipe in Query Explorer';
    const markdown = [
      `## Query Explorer — Question ${label}`,
      question + '  ', // two trailing spaces: a line break in markdown
      `Data set: ${dataLine}`,
      '',
      '### Recipe',
      ...recipeMd,
      '',
      `### ${sizeLine}`,
      ...resultMd,
      '',
      `[${linkText}](${url})`,
      '',
    ].join('\n');
    const html = [
      `<h2>Query Explorer — Question ${esc(label)}</h2>`,
      `<p>${esc(question)}<br>Data set: ${esc(dataLine)}</p>`,
      '<h3>Recipe</h3>',
      `<ul>${recipeHtml.join('')}</ul>`,
      `<h3>${esc(sizeLine)}</h3>`,
      ...resultHtml,
      `<p><a href="${esc(url)}">${linkText}</a></p>`,
    ].join('\n');
    return { markdown, html, filename: `query-explorer-${label}.md` };
  }

  const api = { PUBLIC_URL, encodeRecipe, decodeRecipe, buildAnswer };
  if (isNode) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
