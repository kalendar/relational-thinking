// Constraint Gauntlet: Fix the rule (spec §8). Choices, the CHECK builder, or a typed CHECK;
// Test this rule shows the fix-test table; Use this rule rebuilds the table, with clean-up when needed.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const verdictRow = r => h('tr', { class: r.ok ? 'ok' : 'bad' },
    h('td', null, r.label, r.source === 'yours' ? h('span', { class: 'cg-tag' }, 'yours') : null),
    h('td', null, r.before), h('td', null, r.after),
    h('td', null, h('span', { class: `cg-verdict ${r.ok ? 'ok' : 'bad'}` }, r.ok ? '✓ ' : '✗ ', r.verdict)));

  function choiceFrom(ctx, fx) {
    const f = ctx.ui.fix[fx.table] || {};
    if (fx.options) return f.optionId ? { table: fx.table, optionId: f.optionId } : null;
    if (ctx.ui.mode === 'sql') return f.expr ? { table: fx.table, expr: f.expr } : null;
    return f.op ? { table: fx.table, builder: { op: f.op, value: f.value, value2: f.value2, list: f.value } } : null;
  }

  function builder(ctx, fx, f, onChange) {
    const t = CG.findTable(ctx.session.game.tables, fx.table);
    if (ctx.ui.mode === 'sql') {
      const input = h('input', { type: 'text', class: 'mono cg-expr', value: f.expr || '', placeholder: `${fx.column} > 0`, 'aria-label': `New CHECK rule for ${fx.column}`, spellcheck: 'false',
        oninput: () => { f.expr = input.value; onChange(); } });
      return h('div', { class: 'cg-builder' }, h('label', { class: 'cg-small-label' }, `New CHECK for ${fx.column}: CHECK (`), input, h('span', { class: 'cg-small-label' }, ')'));
    }
    const op = h('select', { 'aria-label': 'Operator', onchange: () => { f.op = op.value; onChange(true); } },
      h('option', { value: '' }, 'Choose…'), CG.CHECK_OPS.map(o => h('option', { value: o, selected: f.op === o }, o)));
    const v1 = h('input', { type: 'text', class: 'mono', value: f.value || '', 'aria-label': f.op === 'IN' ? 'Values, separated by commas' : 'Value',
      placeholder: f.op === 'IN' ? 'Floor, Lawn' : f.op === 'LIKE' ? '_%@_%._%' : '0', oninput: () => { f.value = v1.value; onChange(); } });
    const v2 = f.op === 'BETWEEN' ? h('input', { type: 'text', class: 'mono', value: f.value2 || '', 'aria-label': 'Second value', oninput: () => { f.value2 = v2.value; onChange(); } }) : null;
    const built = f.op ? CG.buildExpression(t, { column: fx.column, op: f.op, value: f.value, value2: f.value2, list: f.value }) : null;
    return h('div', { class: 'cg-builder' },
      h('code', null, fx.column), op, v1, v2 ? [h('span', null, 'AND'), v2] : null,
      built ? h('p', { class: 'cg-sub' }, built.ok ? ['Your rule: ', h('code', null, `CHECK (${built.expr})`)] : built.message) : null);
  }

  function renderFix(ctx, fx) {
    const st = ctx.session.state();
    const unlocked = ctx.session.fixUnlocked(fx.table);
    const applied = !!st.flags[`applied:${fx.table}`];
    const ui = ctx.ui;
    ui.fix[fx.table] = ui.fix[fx.table] || {};
    const f = ui.fix[fx.table];
    if (!unlocked) {
      return h('div', { class: 'cg-fix' }, h('button', { type: 'button', class: 'btn', disabled: true, title: 'Find the hole first' }, icon('lock'), 'Fix the rule'),
        h('span', { class: 'cg-sub' }, fx.unlock === 'too-strict' ? ' Unlocks when the rule refuses a row that looks real.' : fx.unlock === 'bounced' ? ' Unlocks when a row bounces.' : ' Find the hole first: get a bad row past the rules.'));
    }
    const box = h('div', { class: 'cg-fix open' });
    const rerender = () => ctx.render();
    const parts = [h('h3', { class: 'cg-fix-title' }, icon('unlock'), ` Fix the rule on ${fx.table}`)];
    if (applied) parts.push(h('p', { class: 'cg-applied' }, icon('check'), ' Your new rule is on the table. Try the rows that used to get through.'));
    if (fx.options) {
      parts.push(h('fieldset', { class: 'cg-options' }, h('legend', null, 'Which rule should it be?'),
        fx.options.map(o => h('label', { class: 'cg-option' },
          h('input', { type: 'radio', name: `cg-fix-${fx.table}`, value: o.id, checked: f.optionId === o.id, onchange: () => { f.optionId = o.id; f.result = null; f.apply = null; rerender(); } }),
          h('code', null, o.label)))));
    } else {
      parts.push(builder(ctx, fx, f, structural => { f.result = null; f.apply = null; if (structural) rerender(); }));
    }
    const choice = () => choiceFrom(ctx, fx);
    parts.push(h('div', { class: 'cg-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => { const c = choice(); if (!c) { f.result = { error: 'Choose a rule first.' }; rerender(); return; } ctx.act.tryFix(c, f); } }, icon('play'), 'Test this rule'),
      f.result && f.result.passed ? h('button', { type: 'button', class: 'btn primary', onclick: () => ctx.act.applyFix(choice(), f, null) }, icon('check'), 'Use this rule') : null));
    if (f.result) {
      if (f.result.error) parts.push(h('p', { class: 'cg-field-problem' }, SS.rich(f.result.error)));
      else {
        parts.push(h('p', { class: `cg-fix-summary ${f.result.passed ? 'ok' : 'bad'}` }, f.result.passed ? '✓ This rule blocks every bad row and still allows every real one.' : '✗ Not yet. Look at the rows marked ✗.'));
        if (f.result.rows.length) {
          parts.push(h('div', { class: 'cg-grid-wrap' }, h('table', { class: 'data cg-fix-table' },
            h('thead', null, h('tr', null, ['Row', 'Before', 'After', 'Verdict'].map(x => h('th', { scope: 'col' }, x)))),
            h('tbody', null, f.result.rows.map(verdictRow)))));
        }
        if (f.result.why) parts.push(h('p', { class: 'cg-why' }, icon('bulb'), ' ', SS.rich(f.result.why)));
      }
    }
    if (f.apply && !f.apply.ok) {
      parts.push(h('div', { class: 'note-box cg-cleanup' },
        h('p', null, h('strong', null, 'Your table already has rows that break this rule. '), 'A real database won’t add a rule your data already breaks. You’d clean the data first.'),
        h('ul', null, (f.apply.problems || []).map(p => h('li', null, SS.rich(p.explained.headline)))),
        f.apply.cleanupError ? h('p', { class: 'cg-field-problem' }, `Couldn’t delete them: ${f.apply.cleanupError}`) : null,
        h('div', { class: 'cg-actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => ctx.act.applyFix(choice(), f, 'delete') }, icon('trash'), 'Delete these rows and apply'),
          h('button', { type: 'button', class: 'btn', onclick: () => ctx.act.applyFix(choice(), f, 'reset') }, icon('reset'), 'Reset the level’s data and apply'))));
    }
    box.append(...parts);
    return box;
  }

  CG.renderFix = renderFix;
})(this);
