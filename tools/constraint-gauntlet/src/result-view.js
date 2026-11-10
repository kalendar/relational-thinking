// Constraint Gauntlet: the result box (spec §7.1): error, row added/changed/deleted, or slipped through.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const chip = (label, value) => h('span', { class: 'cg-chip' }, h('span', { class: 'cg-chip-label' }, label), h('code', null, value || '—'));
  const raw = text => (text ? h('details', null, h('summary', null, 'What SQLite said'), h('code', { class: 'cg-raw' }, text)) : null);

  function attemptBox(ctx, a) {
    const tables = ctx.session.game.tables;
    const t = CG.findTable(tables, a.table);
    if (a.outcome === 'rejected') {
      const e = a.error;
      return h('div', { class: 'err-box cg-result cg-result--error', role: 'alert' },
        h('p', { class: 'headline' }, icon('x'), ' ', SS.rich(e.headline)),
        h('p', { class: 'cg-chips' }, chip('Table', e.chips.table), chip('Rule', e.chips.rule), chip('Value', e.chips.value)),
        a.tooStrict ? h('p', { class: 'cg-too-strict' }, icon('bulb'), `The database said no. But this looks like a real ${t ? CG.noun(t) : 'row'}. Is the rule too strict?`) : null,
        a.kind === 'delete' ? CG.renderBlast(a.blast, tables) : null,
        raw(e.raw));
    }
    const verb = { insert: 'added', update: 'changed', delete: 'deleted' }[a.kind];
    const n = a.kind === 'delete' ? (a.blast ? a.blast.removed[a.table] || 0 : a.rows.length) : a.rows.length;
    const what = `${n} ${n === 1 ? (t ? CG.noun(t) : 'row') : `${t ? CG.noun(t) : 'row'}s`} ${verb}.`;
    if (a.outcome === 'slipped') {
      const texts = a.broken.map(id => CG.ruleText(ctx.level, id));
      return h('div', { class: 'cg-result cg-result--slipped', role: 'status' },
        h('p', { class: 'headline' }, icon('alert'), ' ', h('strong', null, 'Slipped through! '),
          `The database accepted this, but it breaks the rule: `, h('em', null, texts.join('; ')), '.'),
        h('p', { class: 'cg-sub' }, `${what} No constraint stopped it.`));
    }
    return h('div', { class: 'cg-result cg-result--ok', role: 'status' },
      h('p', { class: 'headline' }, icon('check'), ' ', h('strong', null, `Row ${verb}. `), what),
      a.kind === 'delete' ? CG.renderBlast(a.blast, tables) : null);
  }

  function selectBox(r) {
    const rows = r.rows.slice(0, 50);
    return h('div', { class: 'cg-result cg-result--select' },
      h('p', { class: 'res-count' }, h('strong', null, String(r.rows.length)), ` ${r.rows.length === 1 ? 'row' : 'rows'}${r.rows.length > 50 ? ' (showing 50)' : ''}`),
      h('div', { class: 'cg-grid-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, r.columns.map(c => h('th', { scope: 'col' }, c)))),
        h('tbody', null, rows.map(row => h('tr', null, r.columns.map(c => h('td', { class: row[c] === null ? 'null' : null }, row[c] === null ? 'NULL' : String(row[c])))))))));
  }

  function resultBox(ctx) {
    const r = ctx.ui.lastResult;
    if (!r) return h('div', { class: 'cg-result cg-result--idle' }, h('p', null, 'Results show up here. Add, change, or delete a row to see what the database says.'));
    if (r.type === 'attempt') return attemptBox(ctx, r.attempt);
    if (r.type === 'blocked') return h('div', { class: 'note-box cg-result', role: 'status' }, SS.rich(r.message.replace(/\*\*/g, '')));
    if (r.type === 'syntax') return h('div', { class: 'err-box cg-result', role: 'alert' }, h('p', { class: 'headline' }, SS.rich(r.explained.headline)), raw(r.explained.raw));
    if (r.type === 'form') return h('div', { class: 'note-box cg-result', role: 'status' }, r.message || 'Fix the highlighted fields first. Nothing was sent to the database.');
    if (r.type === 'select') return selectBox(r);
    if (r.type === 'many') {
      const counts = { accepted: 0, rejected: 0, slipped: 0 };
      r.results.forEach(x => { if (x.attempt) counts[x.attempt.outcome] += 1; });
      return h('div', { class: `cg-result ${counts.rejected ? 'cg-result--slipped' : 'cg-result--ok'}`, role: 'status' },
        h('p', { class: 'headline' }, `Ran ${r.results.length} statements: ${counts.accepted + counts.slipped} went in, ${counts.rejected} bounced.`),
        h('ul', { class: 'cg-many' }, r.results.filter(x => x.attempt && x.attempt.outcome === 'rejected')
          .map(x => h('li', null, h('code', null, x.attempt.sql.slice(0, 60)), ' — ', SS.rich(x.attempt.error.headline)))));
    }
    if (r.type === 'info') return h('div', { class: `cg-result ${r.tone === 'bad' ? 'err-box' : r.tone === 'warn' ? 'cg-result--slipped' : 'cg-result--ok'}`, role: 'status' }, h('p', { class: 'headline' }, SS.rich(r.text)));
    return null;
  }

  function renderResult(area, ctx) {
    SS.clear(area).append(CG.predictCard(ctx) || '', CG.readErrorCard(ctx) || '', resultBox(ctx));
  }

  CG.renderResult = renderResult;
})(this);
