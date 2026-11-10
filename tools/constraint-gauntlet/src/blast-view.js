// Constraint Gauntlet: the blast radius of a DELETE (spec §9): one bar per table that lost rows.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h } = SS;

  function renderBlast(blast, tables) {
    if (!blast) return null;
    if (blast.blocked) return h('div', { class: 'cg-blast blocked' }, h('p', { class: 'cg-blast-total' }, 'Blocked: 0 rows changed.'));
    const entries = Object.entries(blast.removed);
    const max = Math.max(1, ...entries.map(([, n]) => n));
    const noun = name => { const t = CG.findTable(tables, name); return t ? CG.noun(t) : name.toLowerCase(); };
    return h('div', { class: 'cg-blast', role: 'group', 'aria-label': 'What the delete removed' },
      entries.map(([t, n]) => h('div', { class: 'cg-bar-row' },
        h('span', { class: 'cg-bar-label' }, t),
        h('span', { class: 'cg-bar-track', 'aria-hidden': 'true' }, h('span', { class: 'cg-bar', style: { width: `${Math.max(8, (n / max) * 100)}%` } })),
        h('span', { class: 'cg-bar-num' }, `−${n}`))),
      Object.entries(blast.nulled).map(([k, n]) => {
        const [t, c] = k.split('.');
        return h('p', { class: 'cg-blast-null' }, `${n} ${n === 1 ? noun(t) : `${noun(t)}s`} now ${n === 1 ? 'has' : 'have'} a blank ${c} (SET NULL).`);
      }),
      h('p', { class: 'cg-blast-total' }, `${blast.total} ${blast.total === 1 ? 'row' : 'rows'} gone from one DELETE.`));
  }

  CG.renderBlast = renderBlast;
})(this);
