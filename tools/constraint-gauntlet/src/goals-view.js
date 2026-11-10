// Constraint Gauntlet: the Goals strip, prediction cards, and Level 6's read-the-error card.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  function goalMet(ctx, id) {
    const saved = ctx.progress.levels[String(ctx.level.id)];
    return (saved && saved.goals.includes(id)) || ctx.session.goals().some(g => g.id === id && g.met);
  }

  function renderGoals(panel, ctx) {
    const goals = ctx.session.goals().map(g => Object.assign({}, g, { met: g.met || goalMet(ctx, g.id) }));
    const required = goals.filter(g => !g.optional);
    const met = required.filter(g => g.met).length;
    const complete = met === required.length;
    const next = goals.find(g => !g.met && !g.optional) || goals.find(g => !g.met);
    panel.el.classList.toggle('complete', complete);
    const hw = h('button', { type: 'button', class: 'btn', onclick: e => ctx.act.openHomework(e.currentTarget) }, icon('homework'), 'Copy for homework');
    SS.clear(panel.headSlot).append(h('div', { class: 'ex-current' },
      h('span', { class: 'ex-num' }, complete ? 'Level complete' : `${met} of ${required.length}`),
      h('span', { class: 'text' }, complete ? SS.rich(ctx.level.done) : next ? SS.rich(`Next: ${next.text}`) : '')));
    SS.clear(panel.tools).append(hw);
    SS.clear(panel.body).append(h('ul', { class: 'cg-goals' }, goals.map(g => h('li', { class: `cg-goal${g.met ? ' met' : ''}` },
      h('span', { class: 'cg-goal-dot', 'aria-hidden': 'true' }, g.met ? icon('check') : null),
      h('span', { class: 'sr-only' }, g.met ? 'Done: ' : 'To do: '),
      h('span', null, SS.rich(g.text), g.optional ? h('span', { class: 'cg-bonus' }, ' (bonus)') : null)))),
    ...(complete ? [h('p', { class: 'cg-done' }, icon('check'), ' ', SS.rich(ctx.level.done))] : []));
  }

  function whenHolds(ctx, p) {
    const w = p.when || 'start';
    if (w === 'start') return true;
    if (w.startsWith('after:')) return goalMet(ctx, w.slice(6));
    return false; // 'before-delete' cards open from the Level 8 board
  }

  function predictCard(ctx) {
    const ui = ctx.ui;
    const st = ctx.session.state();
    let p = null;
    if (ui.predictOpen) p = (ctx.level.predict || []).find(x => x.id === ui.predictOpen.id);
    if (!p) {
      p = (ctx.level.predict || []).find(x => whenHolds(ctx, x) && st.predictions[x.id] === undefined && !(ui.predictSkipped || {})[x.id]);
      if (p) ui.predictOpen = { id: p.id, result: null, then: p.then };
    }
    if (!p) return null;
    const open = ui.predictOpen;
    const res = open.result;
    const parts = [h('p', { class: 'cg-predict-q' }, icon('bulb'), ' ', h('strong', null, 'Predict first. '), SS.rich(p.question))];
    if (!res) {
      parts.push(h('div', { class: 'cg-predict-choices', role: 'group', 'aria-label': 'Your prediction' },
        p.choices.map(c => h('button', { type: 'button', class: 'btn', onclick: () => ctx.act.predict(p.id, c.id) }, SS.rich(c.text || c.id))),
        h('button', { type: 'button', class: 'btn-link', onclick: () => { ui.predictSkipped = Object.assign({}, ui.predictSkipped, { [p.id]: true }); ui.predictOpen = null; ctx.render(); } }, 'Not now')));
    } else {
      const chosen = p.choices.find(c => c.id === res.choice);
      const right = p.choices.find(c => c.id === res.answer);
      parts.push(h('p', { class: 'cg-predict-a' },
        `You said: ${SS.plain((chosen && chosen.text) || res.choice)}. `,
        h('strong', null, `Here’s what happens: ${SS.plain((right && right.text) || res.answer)}. `), SS.rich(res.why || '')));
      parts.push(h('div', { class: 'cg-predict-choices' },
        open.then ? h('button', { type: 'button', class: 'btn primary', onclick: () => ctx.act.runPredictThen() }, icon('play'), 'Run it and see') : null,
        h('button', { type: 'button', class: 'btn', onclick: () => { ui.predictOpen = null; ctx.render(); } }, 'Done')));
      if (open.then) parts.push(h('pre', { class: 'cg-preview-sql mono' }, open.then));
    }
    return h('div', { class: 'cg-predict', role: 'region', 'aria-label': 'Prediction' }, parts);
  }

  // Level 6: after the first foreign key error, ask which table, column, and value.
  function readErrorCard(ctx) {
    if (!ctx.level.readError) return null;
    const st = ctx.session.state();
    if (st.flags.readError && !ctx.ui.readErrorAnswer) return null;
    const a = st.log.slice().reverse().find(x => x.outcome === 'rejected' && x.error && x.error.kind === 'fk-parent');
    if (!a) return null;
    const e = a.error;
    const correct = { table: e.chips.table, column: e.columns[0], value: e.chips.value };
    const tableNames = st.tables.map(t => t.name);
    const columns = [...new Set(st.tables.flatMap(t => t.columns.map(c => c.name)))];
    const values = [...new Set([correct.value, ...a.rows.flatMap(r => Object.values(r).filter(v => typeof v === 'number').map(String))])].slice(0, 6).sort();
    const sel = (name, label, opts) => h('label', { class: 'cg-read-pick' }, h('span', null, label),
      h('select', { 'data-pick': name }, h('option', { value: '' }, 'Choose…'), opts.map(o => h('option', { value: o }, o))));
    const ans = ctx.ui.readErrorAnswer;
    const body = [h('p', { class: 'cg-predict-q' }, icon('info'), ' ', h('strong', null, 'Read the error. '), 'Your last foreign key error told you three things. What were they?')];
    if (!ans) {
      const form = h('div', { class: 'cg-read' }, sel('table', 'Which table?', tableNames), sel('column', 'Which column?', columns), sel('value', 'Which value?', values),
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          const pick = {};
          form.querySelectorAll('select[data-pick]').forEach(s => { pick[s.dataset.pick] = s.value; });
          ctx.act.readError(pick, correct);
        } }, 'Check'));
      body.push(form);
    } else {
      body.push(h('ul', { class: 'cg-read-answers' }, ['table', 'column', 'value'].map(k => h('li', null,
        ans.pick[k] === correct[k] ? '✓ ' : '✗ ', `${k}: `, h('code', null, correct[k]), ans.pick[k] && ans.pick[k] !== correct[k] ? ` (you said ${ans.pick[k]})` : ''))));
      body.push(h('p', { class: 'cg-sub' }, 'That’s all you need to fix it: add the missing parent first, or correct the ID.'));
      body.push(h('button', { type: 'button', class: 'btn', onclick: () => { ctx.ui.readErrorAnswer = null; ctx.render(); } }, 'Done'));
    }
    return h('div', { class: 'cg-predict cg-read-card', role: 'region', 'aria-label': 'Read the error' }, body);
  }

  CG.renderGoals = renderGoals;
  CG.predictCard = predictCard;
  CG.readErrorCard = readErrorCard;
  CG.goalMet = goalMet;
})(this);
