// Constraint Gauntlet: the level boards. Level 2's decision board, Level 7's card stack, Level 8's policy board.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const boardKind = level => (level.decisions ? 'decide' : level.cards ? 'cards' : level.policyLinks ? 'policies' : null);

  // ---- Level 2 ----
  function decisionBoard(ctx) {
    const lv = ctx.level;
    const ui = ctx.ui;
    ui.decisions = ui.decisions || {};
    const rows = lv.decisions.map(d => {
      const key = `${d.table}.${d.column}`;
      const ch = ui.decisions[key] || {};
      const name = `cg-dec-${key.replace('.', '-')}`;
      const req = h('fieldset', { class: 'cg-dec-req' }, h('legend', { class: 'sr-only' }, `${key}: required?`),
        [['req', 'Required', true], ['blank', 'Can be blank', false]].map(([v, label, val]) => h('label', { class: 'cg-option' },
          h('input', { type: 'radio', name, value: v, checked: ch.required === val, onchange: () => { ui.decisions[key] = Object.assign({}, ch, { required: val }); ui.batch = null; ctx.render(); } }), label)));
      const tag = h('select', { 'aria-label': `${key}: what does a blank mean?`, disabled: ch.required !== false,
        onchange: () => { ui.decisions[key] = Object.assign({}, ui.decisions[key] || {}, { tag: tag.value }); ui.batch = null; refresh(); } },
      h('option', { value: '' }, 'A blank means…'), h('option', { value: 'unknown', selected: ch.tag === 'unknown' }, 'unknown (we don’t know it yet)'),
      h('option', { value: 'na', selected: ch.tag === 'na' }, 'not applicable (it doesn’t apply)'));
      const res = ui.batch;
      const why = res ? h('p', { class: 'cg-sub' }, SS.rich(d.why)) : null;
      return h('tr', null, h('th', { scope: 'row' }, h('code', null, d.column), h('span', { class: 'cg-type' }, d.table)), h('td', null, req), h('td', null, tag), res ? h('td', null, why) : null);
    });
    const isComplete = () => lv.decisions.every(d => {
      const ch = ui.decisions[`${d.table}.${d.column}`];
      return ch && ch.required !== undefined && (ch.required || ch.tag);
    });
    const complete = isComplete();
    const runBtn = h('button', { type: 'button', class: 'btn primary', disabled: !complete, onclick: () => ctx.act.decide(ui.decisions) }, icon('play'), 'Run the batch');
    const needMore = h('span', { class: 'cg-sub', hidden: complete }, 'Choose for every column first.');
    // Updates the button in place, so choosing from a dropdown doesn't rebuild the board and lose focus.
    function refresh() { const ok = isComplete(); runBtn.disabled = !ok; needMore.hidden = ok; }
    const res = ui.batch;
    const list = (title, items, cls) => h('div', { class: `cg-batch-list ${cls}` }, h('h3', null, title),
      items.length ? h('ul', null, items.map(x => h('li', null, x.note || x))) : h('p', { class: 'cg-sub' }, 'None. ✓'));
    return h('div', { class: 'cg-board' },
      h('p', { class: 'cg-hint' }, icon('info'), 'For each column, decide: is it required, or can it be blank? If it can be blank, what does a blank mean?'),
      h('div', { class: 'cg-grid-wrap' }, h('table', { class: 'data cg-dec' },
        h('thead', null, h('tr', null, h('th', null, 'Column'), h('th', null, 'Required?'), h('th', null, 'A blank means'), res ? h('th', null, 'Why') : null)),
        h('tbody', null, rows))),
      h('div', { class: 'cg-actions' }, runBtn, needMore),
      res ? h('div', { class: 'cg-batch' },
        h('p', { class: `cg-fix-summary ${res.clean ? 'ok' : 'bad'}` }, res.clean ? '✓ Every real row went in, and every bad row was refused.' : '✗ Not yet. Look at the lists below.'),
        list('Rejected but real (too strict)', res.tooStrict, 'strict'),
        list('Accepted but bad (too loose)', res.tooLoose, 'loose'),
        list('Blank tagged wrong', res.tagsWrong.map(d => `${d.column}: a blank here means "${d.key.tag === 'na' ? 'not applicable' : 'unknown'}"`), 'tags')) : null);
  }

  // ---- Level 7 ----
  function cardStack(ctx) {
    const lv = ctx.level;
    const ui = ctx.ui;
    ui.cards = ui.cards || { order: lv.shuffled(lv.cards), loaded: [], bounced: null, bounces: 0, bonusOrder: lv.bonusCards.slice(), bonusLoaded: [] };
    const c = ui.cards;
    const mainDone = c.loaded.length === lv.cards.length;
    if (mainDone) ui.bonusOpen = true;
    const card = (cd, bonus) => {
      const isBounced = c.bounced && c.bounced.id === cd.id;
      return h('li', null, h('button', { type: 'button', class: `cg-card${isBounced ? ' bounced' : ''}`, onclick: () => ctx.act.runCard(cd, bonus),
        'aria-describedby': isBounced ? 'cg-bounce-msg' : null },
      h('span', { class: 'cg-card-label' }, cd.label), h('code', { class: 'cg-card-sql' }, cd.sql)));
    };
    const left = c.order.filter(cd => !c.loaded.includes(cd.id));
    const parts = [h('p', { class: 'cg-hint' }, icon('info'), 'Click a card to load it. A card that bounces goes back on the pile.'),
      h('div', { class: 'cg-stack-wrap' },
        h('div', { class: 'cg-stack' }, h('h3', null, `To load (${left.length})`), left.length ? h('ul', { class: 'cg-cards' }, left.map(cd => card(cd, false))) : h('p', { class: 'cg-sub' }, 'All loaded ✓')),
        h('div', { class: 'cg-stack loaded' }, h('h3', null, `Loaded (${c.loaded.length})`), h('ul', { class: 'cg-loaded' }, c.loaded.map(id => h('li', null, icon('check'), ' ', lv.cards.find(x => x.id === id).label))))),
      h('p', { class: 'cg-bounces' }, `Bounces: ${c.bounces}`)];
    if (c.bounced) parts.push(h('p', { class: 'cg-field-problem', id: 'cg-bounce-msg' }, SS.rich(c.bounced.message)));
    if (mainDone) {
      const bLeft = c.bonusOrder.filter(cd => !c.bonusLoaded.includes(cd.id));
      parts.push(h('div', { class: 'cg-bonus-round' }, h('h3', null, 'Bonus: the Captain Problem'),
        h('p', { class: 'cg-sub' }, 'A team needs a captain, and the captain must be on the team. Try loading these.'),
        bLeft.length ? h('ul', { class: 'cg-cards' }, bLeft.map(cd => card(cd, true))) : null,
        ctx.session.fixUnlocked('Team') ? h('p', { class: 'cg-hint' }, icon('bulb'), 'No order works. Open ', h('strong', null, 'Fix the rule'), ' below, let one side be blank for now, and use the Row form to finish.') : null));
    }
    return h('div', { class: 'cg-board' }, parts);
  }

  // ---- Level 8 ----
  function policyBoard(ctx) {
    const lv = ctx.level;
    const st = ctx.session.state();
    const ui = ctx.ui;
    const seg = link => h('div', { class: 'cg-policy' }, h('span', { class: 'cg-policy-label' }, h('code', null, link), ' ON DELETE'),
      h('div', { class: 'cg-seg', role: 'group', 'aria-label': `${link} ON DELETE` }, lv.policyChoices[link].map(p => h('button', {
        type: 'button', class: 'btn', 'aria-pressed': String(st.policies[link] === p), onclick: () => ctx.act.setPolicies({ [link]: p }) }, p))));
    const jordan = (st.rows.Student || []).find(r => r.student_id === 2);
    ui.judge = ui.judge || Object.fromEntries(lv.policyKey.map(k => [k.link, '']));
    const j = ui.judgeResult;
    return h('div', { class: 'cg-board' },
      h('div', { class: 'cg-round' }, h('h3', null, 'Round 1: try each delete rule'),
        seg('Ticket.student_id'), seg('Scan.ticket_id'),
        h('div', { class: 'cg-actions' },
          h('button', { type: 'button', class: 'btn primary', disabled: !jordan, onclick: () => ctx.act.askDelete() }, icon('trash'), 'Delete Jordan Lee'),
          h('button', { type: 'button', class: 'btn', onclick: () => ctx.act.resetData() }, icon('reset'), 'Reset data'),
          jordan ? null : h('span', { class: 'cg-sub' }, 'Jordan is gone. Press Reset data to bring the rows back.'))),
      h('div', { class: 'cg-round' }, h('h3', null, 'Round 2: soft delete'),
        h('p', { class: 'cg-sub' }, 'Instead of deleting Jordan, mark Jordan inactive. Watch the revenue report.'),
        h('button', { type: 'button', class: 'btn', disabled: !jordan || jordan.is_active === false, onclick: () => ctx.act.softDelete('Student', { student_id: 2 }) }, icon('eyeOff'), 'Mark Jordan inactive')),
      h('div', { class: 'cg-round' }, h('h3', null, 'Round 3: choose the rule for each relationship'),
        h('div', { class: 'cg-grid-wrap' }, h('table', { class: 'data cg-judge' }, h('tbody', null, lv.policyKey.map(k => {
          const sel = h('select', { 'aria-label': `${k.label}: ON DELETE`, onchange: () => { ui.judge[k.link] = sel.value; ui.judgeResult = null; } },
            h('option', { value: '' }, 'Choose…'), lv.policyOptions[k.link].map(p => h('option', { value: p, selected: ui.judge[k.link] === p }, p)));
          const row = j && j.rows.find(r => r.link === k.link);
          return h('tr', null, h('th', { scope: 'row' }, k.label), h('td', null, sel),
            row ? h('td', null, h('span', { class: `cg-verdict ${row.ok ? 'ok' : 'bad'}` }, row.ok ? '✓ ' : '✗ ', row.note)) : null);
        })))),
        h('div', { class: 'cg-actions' }, h('button', { type: 'button', class: 'btn primary', onclick: () => ctx.act.judge(Object.assign({}, ui.judge)) }, icon('check'), 'Check my choices')),
        j ? h('ul', { class: 'cg-tests' }, j.tests.map(t => h('li', null, h('strong', null, `${t.label}: `), t.text))) : null));
  }

  function renderBoard(ctx) {
    const kind = boardKind(ctx.level);
    if (kind === 'decide') return decisionBoard(ctx);
    if (kind === 'cards') return ctx.ui.mode === 'form' ? cardStack(ctx) : null;
    if (kind === 'policies') return policyBoard(ctx);
    return null;
  }

  CG.renderBoard = renderBoard;
  CG.boardKind = boardKind;
})(this);
