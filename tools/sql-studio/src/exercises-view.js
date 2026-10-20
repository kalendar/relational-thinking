// SQL Studio: the Exercises strip (current question when collapsed; full list with hints and Check when open).
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, clear, icon, iconButton } = SS;

  function createExercises(panel, { onSelect, onCheck, onHomework }) {
    const countEl = h('span', { class: 'ex-count' });
    panel.head.querySelector('.panel-title').append(countEl);
    const numEl = h('span', { class: 'ex-num' });
    const textEl = h('span', { class: 'text' });
    const prev = iconButton('prev', 'Previous exercise', { onclick: () => move(-1) });
    const next = iconButton('next', 'Next exercise', { onclick: () => move(1) });
    const current = h('div', { class: 'ex-current', 'aria-live': 'off' }, prev, numEl, textEl, next);
    panel.headSlot.append(current);
    const hwBtn = h('button', { type: 'button', class: 'btn', onclick: e => onHomework(e.currentTarget) }, icon('homework'), 'Copy for homework');
    panel.tools.append(hwBtn);

    let data = { schema: null, list: [], assessment: false, index: 0 };
    const items = [];

    function setData({ schema, list, assessment, index }) {
      data = { schema, list, assessment, index: Math.min(index || 0, Math.max(0, list.length - 1)) };
      countEl.textContent = list.length ? ` (${list.length})` : '';
      items.length = 0;
      clear(panel.body);
      if (!list.length) {
        panel.body.append(h('p', { class: 'ex-empty' }, 'There are no exercises for your own data. Try ', h('strong', null, 'Random Query'), ' to get started.'));
      } else {
        panel.body.append(h('ol', { class: 'ex-list' }, list.map((ex, i) => item(ex, i))));
      }
      setCurrent(data.index, { quiet: true });
    }

    function item(ex, i) {
      const label = SS.exerciseLabel(data.schema.number, i);
      const hintId = `ex-hint-${i}`;
      const hint = !data.assessment && ex.hint ? h('p', { class: 'ex-hint', id: hintId, hidden: true }, icon('bulb'), ' ', SS.rich(ex.hint)) : null;
      const feedback = h('p', { class: 'ex-feedback', role: 'status', hidden: true });
      const hintBtn = hint ? h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', 'aria-controls': hintId, onclick: e => {
        hint.hidden = !hint.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!hint.hidden));
        e.currentTarget.lastChild.textContent = hint.hidden ? 'Show hint' : 'Hide hint';
      } }, icon('bulb'), h('span', null, 'Show hint')) : null;
      const checkBtn = data.assessment ? null : h('button', { type: 'button', class: 'btn', onclick: () => { setCurrent(i, { quiet: true }); onCheck(i); } }, icon('check'), 'Check my answer');
      const numBtn = h('button', { type: 'button', class: 'btn-link ex-num', 'aria-label': `Make ${label} the current exercise`, onclick: () => setCurrent(i) }, label);
      const li = h('li', { class: 'ex-item' },
        h('div', { class: 'q' }, numBtn, h('span', null, ex.text)),
        ex.note ? h('p', { class: 'note' }, ex.note) : null,
        hintBtn || checkBtn ? h('div', { class: 'ex-actions' }, hintBtn, checkBtn) : null,
        hint, feedback);
      items[i] = { li, numBtn, feedback };
      return li;
    }

    function setCurrent(i, { quiet = false } = {}) {
      if (!data.list.length) {
        numEl.textContent = '';
        textEl.textContent = 'No exercises for this data';
        prev.disabled = next.disabled = true;
        return;
      }
      data.index = i;
      const ex = data.list[i];
      numEl.textContent = SS.exerciseLabel(data.schema.number, i);
      textEl.textContent = ex.text;
      textEl.title = ex.text;
      prev.disabled = i === 0;
      next.disabled = i === data.list.length - 1;
      items.forEach((it, k) => {
        it.li.classList.toggle('current', k === i);
        if (k === i) it.numBtn.setAttribute('aria-current', 'true'); else it.numBtn.removeAttribute('aria-current');
      });
      if (!quiet) SS.announce(`Exercise ${numEl.textContent}: ${ex.text}`);
      onSelect(i);
    }

    function move(dir) {
      const i = Math.min(data.list.length - 1, Math.max(0, data.index + dir));
      if (i !== data.index) setCurrent(i);
    }

    // check: { ok, message } from SS.checkExercise.
    function setFeedback(i, check) {
      const it = items[i];
      if (!it) return;
      it.feedback.hidden = false;
      it.feedback.classList.toggle('ok', !!check.ok);
      it.feedback.replaceChildren(check.ok ? icon('check') : '', check.ok ? ' ' : '', check.message);
      SS.announce(check.message);
    }

    const clearFeedback = () => items.forEach(it => { it.feedback.hidden = true; it.feedback.textContent = ''; });

    return { setData, setCurrent, setFeedback, clearFeedback, get index() { return data.index; } };
  }

  root.SS = Object.assign(SS, { createExercises });
})(this);
