// Constraint Gauntlet: the Rules panel. The CREATE TABLE students see (no hidden checks), with each
// constraint highlighted and changed lines marked, plus Fix the rule for this table.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const RULE_RE = /(NOT NULL|PRIMARY KEY(?: \([^)]*\))?|UNIQUE(?: \([^)]*\))?|COLLATE NOCASE|DEFAULT \S+|REFERENCES \w+\(\w+\)(?: ON DELETE (?:RESTRICT|CASCADE|SET NULL))?|(?:CONSTRAINT \w+ )?CHECK \((?:[^()]|\([^()]*\))*\))/g;

  function ddlLines(sql, baseline) {
    const base = new Set((baseline || '').split('\n').map(l => l.replace(/,$/, '').trim()));
    return sql.split('\n').map(line => {
      const parts = [];
      let last = 0;
      let m;
      RULE_RE.lastIndex = 0;
      while ((m = RULE_RE.exec(line))) {
        if (m.index > last) parts.push(line.slice(last, m.index));
        parts.push(h('mark', { class: 'cg-k' }, m[0]));
        last = RULE_RE.lastIndex;
      }
      if (last < line.length) parts.push(line.slice(last));
      const changed = baseline && !base.has(line.replace(/,$/, '').trim());
      return h('span', { class: `cg-ddl-line${changed ? ' changed' : ''}` }, parts, changed ? h('span', { class: 'cg-changed-tag' }, ' ← changed') : null, '\n');
    });
  }

  function ddlBlock(t, baseline, label) {
    const sql = CG.createTableSql(t, { hidden: false });
    return h('div', { class: 'cg-ddl-wrap' }, label ? h('p', { class: 'cg-small-label' }, label) : null,
      h('pre', { class: 'cg-ddl mono', 'aria-label': `CREATE TABLE for ${t.name}` }, ddlLines(sql, baseline)));
  }

  function baselineFor(ctx, name) {
    const fx = ctx.session.fixFor(name);
    const base = fx && fx.base ? ctx.level.variants[fx.base].tables : (ctx.session.game.variant ? ctx.level.variants[ctx.session.game.variant].tables : ctx.level.tables);
    const t = CG.findTable(base, name);
    return t ? CG.createTableSql(t, { hidden: false }) : null;
  }

  function renderRules(panel, ctx) {
    const st = ctx.session.state();
    const name = ctx.ui.tableTab && CG.findTable(st.tables, ctx.ui.tableTab) ? ctx.ui.tableTab : st.tables[0].name;
    const t = CG.findTable(st.tables, name);
    SS.clear(panel.headSlot).append(h('span', { class: 'cg-rules-for' }, h('code', null, t.name)));
    const parts = [];
    const lv = ctx.level;
    if (lv.variantToggle && CG.goalMet(ctx, 'missing') && CG.findTable(lv.tables, name)) {
      parts.push(h('div', { class: 'cg-ddl-pair' },
        ddlBlock(CG.findTable(lv.tables, name), null, 'Strict version'),
        ddlBlock(CG.findTable(lv.variants[lv.variantToggle.name].tables, name), CG.createTableSql(CG.findTable(lv.tables, name), { hidden: false }), 'Loose version')));
    } else {
      parts.push(ddlBlock(t, baselineFor(ctx, name)));
    }
    if (st.variant && lv.variants[st.variant] && lv.variants[st.variant].label) parts.push(h('p', { class: 'cg-hint' }, icon('info'), lv.variants[st.variant].label));
    if (name === 'Ticket' && lv.policyLinks) parts.push(h('p', { class: 'cg-hint' }, icon('info'), 'student_id can be blank in this level, so ON DELETE SET NULL can work. Most ticket tables would make it NOT NULL.'));

    const fx = ctx.session.fixFor(name);
    const fixHere = fx && fx.table === name ? fx : null;
    if (fixHere) parts.push(CG.renderFix(ctx, fixHere));
    else {
      const others = ctx.session.fixList().filter(f => f.table !== name);
      if (others.length) parts.push(h('p', { class: 'cg-hint' }, icon('info'), 'This level’s ', h('strong', null, 'Fix the rule'), ' is on the ',
        others.map((f, i) => [i ? ' and ' : '', h('button', { type: 'button', class: 'btn-link', onclick: () => { ctx.ui.tableTab = f.table; ctx.render(); } }, f.table)]), ' table.'));
    }
    SS.clear(panel.body).append(h('div', { class: 'cg-rules' }, parts));
  }

  CG.renderRules = renderRules;
  CG.ddlBlock = ddlBlock;
})(this);
