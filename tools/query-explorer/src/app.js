// Query Explorer: app state, actions, and the main render.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, rich } = QE;
  const DATASETS = root.QE_DATASETS || [];
  const appEl = document.getElementById('app');

  let nextId = 1;
  let animToken = 0;
  // Asked live (not cached) so a change in the device setting is respected.
  const deviceWantsLessMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reducedByDefault = deviceWantsLessMotion();

  const state = {
    datasetId: DATASETS[0].id,
    recipe: { start: DATASETS[0].start, steps: [] },
    selected: 0,
    editing: null, // null | 'new' | step number
    draft: null,
    view: 'result', // 'result' | a table name
    reduceMotion: reducedByDefault,
    explainJoins: true,
    showCollapsed: false,
    tryOpen: false,
    openHints: new Set(),
    animate: null, // step number to animate after the next render
    focus: null, // data-focus-key to focus after the next render
  };

  const dataset = () => DATASETS.find(d => d.id === state.datasetId);

  const actions = {
    setDataset(id) {
      if (state.recipe.steps.length && !root.confirm('Switching data sets clears your recipe. Continue?')) { render(); return; }
      const d = DATASETS.find(x => x.id === id);
      Object.assign(state, { datasetId: id, recipe: { start: d.start, steps: [] }, selected: 0, editing: null, draft: null, view: 'result', showCollapsed: false, openHints: new Set() });
      render();
    },
    setStart(name) {
      Object.assign(state, { selected: 0, editing: null, draft: null, view: 'result' });
      state.recipe.start = name;
      render();
    },
    selectStep(n) { state.selected = n; state.view = 'result'; render(); },
    // Rule: any action that changes the recipe or opens another editor drops the open draft,
    // so a draft is never kept against a table it was not built for.
    addStep(op) {
      const results = QE.runRecipe(dataset(), state.recipe);
      state.draft = QE.newDraft(op, results[results.length - 1].table);
      state.editing = 'new';
      state.focus = '@editor';
      render();
    },
    editStep(n) {
      const draft = JSON.parse(JSON.stringify(state.recipe.steps[n - 1]));
      // Drop names the table no longer has, so the editor shows only what can be kept.
      const names = QE.runRecipe(dataset(), state.recipe)[n - 1].table.columns.map(c => c.name);
      if (draft.op === 'project') draft.columns = draft.columns.filter(c => names.includes(c));
      if (draft.op === 'aggregate') draft.groupBy = draft.groupBy.filter(c => names.includes(c));
      state.draft = draft;
      state.editing = n;
      state.focus = '@editor';
      render();
    },
    updateDraft(patch) { Object.assign(state.draft, patch); render(); },
    applyDraft() {
      const steps = state.recipe.steps;
      let n;
      if (state.editing === 'new') {
        steps.push({ ...state.draft, id: nextId++, on: true });
        n = steps.length;
      } else {
        n = state.editing;
        steps[n - 1] = { ...state.draft, id: steps[n - 1].id, on: steps[n - 1].on };
      }
      Object.assign(state, { editing: null, draft: null, selected: n, view: 'result', animate: n, focus: 'step-' + n });
      render();
    },
    cancelDraft() {
      state.focus = state.editing === 'new' ? 'add-' + state.draft.op : 'edit-' + state.editing;
      state.editing = null;
      state.draft = null;
      render();
    },
    toggleStep(n) {
      const step = state.recipe.steps[n - 1];
      step.on = step.on === false;
      state.editing = null;
      state.draft = null;
      state.selected = n;
      render();
    },
    deleteStep(n) {
      state.recipe.steps.splice(n - 1, 1);
      if (state.selected >= n) state.selected = Math.max(0, state.selected - 1);
      state.editing = null;
      state.draft = null;
      state.focus = 'add-filter';
      render();
    },
    setView(v) { state.view = v; render(); },
    toggleHint(key) {
      if (state.openHints.has(key)) state.openHints.delete(key);
      else state.openHints.add(key);
      render();
    },
    setReduceMotion(on) { state.reduceMotion = on; render(); },
    setExplainJoins(on) { state.explainJoins = on; render(); },
    setShowCollapsed(on) { state.showCollapsed = on; render(); },
    replay() { state.animate = state.selected; render(); },
  };

  function tryThis(d) {
    return h('details', { class: 'try', open: state.tryOpen, ontoggle: e => { state.tryOpen = e.target.open; } },
      h('summary', null, `Try this (${d.questions.length} questions)`),
      h('ol', null, d.questions.map((q, i) => {
        const key = d.id + ':' + i;
        const open = state.openHints.has(key);
        return h('li', null, q.text, ' ',
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'hint-' + i, 'aria-expanded': String(open), onclick: () => actions.toggleHint(key) }, open ? 'Hide hint' : 'Show hint'),
          open ? h('p', { class: 'hint' }, rich(QE.describeRecipe(d, q.recipe).join(' → ')), q.note ? ` (${q.note})` : '') : null);
      })));
  }

  const MOTION_TITLE = 'Join walkthroughs keep their motion unless your device asks for less.';

  function motionNote() {
    if (!state.explainJoins) return null;
    if (deviceWantsLessMotion()) return h('p', { class: 'motion-note' }, 'Your device asks for less motion, so join walkthroughs change instantly.');
    return state.reduceMotion ? h('p', { class: 'motion-note' }, MOTION_TITLE) : null;
  }

  function header(d) {
    return h('header', { class: 'top' },
      h('div', { class: 'top-row' },
        h('h1', null, 'Query Explorer'),
        h('div', { class: 'picker' },
          h('label', { for: 'dataset' }, 'Data set'),
          h('select', { id: 'dataset', 'data-focus-key': 'dataset', onchange: e => actions.setDataset(e.target.value) },
            DATASETS.map(x => h('option', { value: x.id, selected: x.id === d.id }, x.name)))),
        h('div', { class: 'toggles' },
          h('label', { class: 'motion' },
            h('input', { type: 'checkbox', 'data-focus-key': 'explain', checked: state.explainJoins, onchange: e => actions.setExplainJoins(e.target.checked) }),
            'Explain joins step by step'),
          h('label', { class: 'motion', title: MOTION_TITLE },
            h('input', { type: 'checkbox', 'data-focus-key': 'motion', checked: state.reduceMotion, onchange: e => actions.setReduceMotion(e.target.checked) }),
            'Reduce motion'),
          motionNote())),
      h('p', { class: 'subline' }, d.description, h('span', { class: 'note' }, ' · Real names, made-up numbers. All data is invented for practice.')),
      tryThis(d));
  }

  function emptyMessage(results, i) {
    let k = i;
    while (k > 0 && results[k - 1].table.rows.length === 0) k--;
    return k === 0 ? 'This table has no rows.' : `No rows left. Step ${k} removed them all. Try changing it.`;
  }

  function finalTable(d, results, i, highlight) {
    const r = results[i];
    const step = i > 0 ? state.recipe.steps[i - 1] : null;
    const ok = step && r.status === 'ok';
    const opts = { emptyMessage: emptyMessage(results, i) };
    if (highlight && ok) {
      const before = results[i - 1].table;
      const other = step.op === 'join' ? QE.loadTable(QE.findTableDef(d, step.table)) : null;
      const plan = QE.visualPlan(step, before, r, other);
      opts.rowClass = k => (plan.afterRows[k] ? 'hl ' + plan.afterRows[k] : null);
      opts.wrapClass = 'highlight';
    }
    if (ok && step.op === 'aggregate' && state.showCollapsed) {
      const before = results[i - 1].table;
      opts.afterRow = k => [h('tr', { class: 'detail' }, h('td', { colspan: String(r.table.columns.length) },
        QE.renderTable({ ...before, rows: r.trace.groups[k].map(j => before.rows[j]) }, { emptyMessage: 'No rows went into this summary.' })))];
    }
    const view = QE.renderTable(r.table, opts);
    if (opts.wrapClass) setTimeout(() => view.classList.remove('highlight'), 2000);
    return view;
  }

  function resultPanel(d, results) {
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'What to show' },
      [['result', 'Recipe result'], ...d.tables.map(t => [t.name, t.name])].map(([v, label]) =>
        h('button', { class: 'tab', role: 'tab', type: 'button', 'data-focus-key': 'tab-' + v, 'aria-selected': String(state.view === v), onclick: () => actions.setView(v) }, label)));
    const body = [];
    if (state.view !== 'result') {
      const t = QE.loadTable(QE.findTableDef(d, state.view));
      body.push(h('p', { class: 'counter' }, h('strong', null, QE.sizeText(t)), ` · the original ${t.name} table`),
        h('div', { id: 'table-holder' }, QE.renderTable(t)));
    } else {
      const i = state.selected;
      const r = results[i];
      const step = i > 0 ? state.recipe.steps[i - 1] : null;
      const ok = step && r.status === 'ok';
      body.push(h('div', { class: 'counter-row' },
        h('strong', null, `Step ${i}`),
        QE.renderCounter(ok ? results[i - 1].table : null, r.table),
        ok ? h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'replay', onclick: actions.replay }, '↻ Replay') : null,
        ok && step.op === 'aggregate'
          ? h('label', null, h('input', { type: 'checkbox', 'data-focus-key': 'collapsed', checked: state.showCollapsed, onchange: e => actions.setShowCollapsed(e.target.checked) }), ' Show the rows in each group')
          : null));
      if (r.status === 'off') body.push(h('p', { class: 'alert' }, 'This step is turned off, so the table is unchanged.'));
      if (r.status === 'invalid') body.push(h('p', { class: 'alert' }, '⚠ ', rich(r.message), ' This step was skipped.'));
      if (ok && r.trace.cartesian) body.push(h('p', { class: 'alert bad' }, 'Every row was paired with every row of the other table. Most of these rows are meaningless.'));
      body.push(h('div', { id: 'table-holder' }, finalTable(d, results, i, false)));
    }
    return h('section', { class: 'result', 'aria-label': 'Result' }, h('h2', null, 'Result'), tabs, body);
  }

  function render() {
    QE.closeModal(); // a dialog from an older render must never outlive it
    animToken++;
    const active = document.activeElement;
    const focusKey = state.focus || (active && active.dataset ? active.dataset.focusKey : null);
    state.focus = null;
    const d = dataset();
    const results = QE.runRecipe(d, state.recipe);
    if (state.selected > results.length - 1) state.selected = results.length - 1;
    document.body.classList.toggle('reduce-motion', state.reduceMotion);
    appEl.replaceChildren(header(d), h('main', { class: 'layout' },
      QE.renderRecipePanel({ state, dataset: d, results, actions }),
      resultPanel(d, results)));
    if (focusKey) {
      const el = focusKey === '@editor'
        ? appEl.querySelector('.editor select:not(:disabled), .editor input:not(:disabled), .editor button:not(:disabled)')
        : appEl.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (el) el.focus();
    }
    if (state.animate !== null) {
      const n = state.animate;
      state.animate = null;
      afterRender(d, results, n);
    }
  }

  function afterRender(d, results, n) {
    const holder = document.getElementById('table-holder');
    if (!holder || state.view !== 'result' || n === 0 || results[n].status !== 'ok') return;
    const token = animToken;
    const step = state.recipe.steps[n - 1];
    const before = results[n - 1].table;
    let walkthrough;
    if (step.op === 'join' && state.explainJoins) {
      const texts = QE.joinNarration({ step, before, other: QE.loadTable(QE.findTableDef(d, step.table)), result: results[n] });
      walkthrough = {
        texts,
        instant: deviceWantsLessMotion(),
        show: t => {
          const i = texts.indexOf(t);
          return QE.showModal({ title: t.title, body: t.body, step: i, steps: texts.length, stepText: `${i + 1} of ${texts.length}` });
        },
      };
    }
    if (walkthrough) holder.scrollIntoView({ block: 'start' }); // keep the tables in view while dialogs talk about them
    QE.playStep(holder, {
      before,
      result: results[n],
      step,
      dataset: d,
      reduceMotion: state.reduceMotion,
      walkthrough,
      isCurrent: () => token === animToken,
    }).then(done => {
      if (done) holder.replaceChildren(finalTable(d, results, n, true));
    }).catch(() => {
      // Something went wrong mid-walkthrough: never leave a dialog or an inert page behind.
      QE.closeModal();
      if (token === animToken) holder.replaceChildren(finalTable(d, results, n, false));
    });
  }

  render();
})(this);
