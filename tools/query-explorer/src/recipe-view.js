// Query Explorer: the recipe panel (step cards and step editors).
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, rich, icon } = QE;

  const OPS = [
    { op: 'filter', label: 'Filter' },
    { op: 'project', label: 'Project' },
    { op: 'join', label: 'Join' },
    { op: 'aggregate', label: 'Aggregate' },
  ];
  const opLabel = op => OPS.find(o => o.op === op).label;

  function newDraft(op, input) {
    if (op === 'filter') return { op, column: '', condition: '', value: '', value2: '', values: [] };
    if (op === 'project') return { op, columns: input.columns.map(c => c.name) };
    if (op === 'join') return { op, table: '', leftColumn: '', rightColumn: '', cartesian: false };
    return { op, groupBy: [], summaries: [{ fn: 'count', column: '' }] };
  }

  function select(key, value, options, onchange, label, disabled) {
    return h('select', { 'data-focus-key': key, 'aria-label': label, disabled: !!disabled, onchange: e => onchange(e.target.value) },
      h('option', { value: '', disabled: true, selected: !options.some(o => String(o.value) === String(value)) }, 'Choose…'),
      options.map(o => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  }

  function distinct(input, name) {
    return [...new Set(input.rows.map(r => r[name]))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  // Why Apply is blocked: a blank field, or a name the table no longer has.
  function blockReason(ctx, input) {
    const d = ctx.state.draft;
    return QE.incompleteReason(d, input) || QE.validateStep(input, d, ctx.dataset);
  }

  // Typing in a box updates the draft without redrawing, so the cursor stays put.
  function liveUpdate(ctx, input, patch) {
    Object.assign(ctx.state.draft, patch);
    const reason = blockReason(ctx, input);
    const btn = document.getElementById('apply-btn');
    if (btn) btn.disabled = !!reason;
    const note = document.getElementById('apply-reason');
    if (note) note.replaceChildren(...(reason ? rich(reason) : []));
  }

  function onEnter(ctx, input) {
    return e => {
      if (e.key === 'Enter' && !blockReason(ctx, input)) ctx.actions.applyDraft();
    };
  }

  function valueControl(d, col, input, ctx) {
    const { actions } = ctx;
    if (col.type === 'text' && d.condition === 'is_one_of') {
      return h('fieldset', null, h('legend', null, 'Pick one or more'), h('div', { class: 'checks' },
        distinct(input, col.name).map(v => h('label', null,
          h('input', { type: 'checkbox', 'data-focus-key': 'f-one-' + v, checked: d.values.includes(v),
            onchange: e => actions.updateDraft({ values: e.target.checked ? [...d.values, v] : d.values.filter(x => x !== v) }) }),
          v))));
    }
    if (col.type === 'text' && d.condition === 'contains') {
      return h('div', { class: 'row' }, h('input', { type: 'text', 'data-focus-key': 'f-val', 'aria-label': 'Text to look for', value: d.value,
        oninput: e => liveUpdate(ctx, input, { value: e.target.value }), onkeydown: onEnter(ctx, input) }));
    }
    if (col.type === 'text') {
      return h('div', { class: 'row' }, select('f-val', d.value, distinct(input, col.name).map(v => ({ value: v, label: v })), v => actions.updateDraft({ value: v }), 'Value'));
    }
    const type = col.type === 'number' ? 'number' : 'date';
    const box = (key, field, label) => h('input', { type, 'data-focus-key': key, 'aria-label': label, value: d[field],
      oninput: e => liveUpdate(ctx, input, { [field]: e.target.value }), onkeydown: onEnter(ctx, input) });
    return d.condition === 'between'
      ? h('div', { class: 'row' }, box('f-val', 'value', 'From'), 'and', box('f-val2', 'value2', 'To'))
      : h('div', { class: 'row' }, box('f-val', 'value', 'Value'));
  }

  function filterEditor(d, input, ctx) {
    const { actions } = ctx;
    const col = QE.getColumn(input, d.column);
    const parts = [h('div', { class: 'row' }, 'Keep only rows where',
      select('f-col', d.column, input.columns.map(c => ({ value: c.name, label: c.name })), v => {
        const type = QE.getColumn(input, v).type;
        actions.updateDraft({ column: v, condition: QE.CONDITIONS[type][0].id, value: '', value2: '', values: [] });
      }, 'Column'),
      col ? select('f-cond', d.condition, QE.CONDITIONS[col.type].map(c => ({ value: c.id, label: c.label })),
        v => actions.updateDraft({ condition: v, value: '', value2: '', values: [] }), 'Condition') : null)];
    if (col && d.condition) parts.push(valueControl(d, col, input, ctx));
    return parts;
  }

  function checkList(legend, input, chosen, keyPrefix, onchange) {
    return h('fieldset', null, h('legend', null, legend), h('div', { class: 'checks' },
      input.columns.map(c => h('label', null,
        h('input', { type: 'checkbox', 'data-focus-key': keyPrefix + c.name, checked: chosen.includes(c.name),
          onchange: e => onchange(input.columns.map(x => x.name).filter(n => (n === c.name ? e.target.checked : chosen.includes(n)))) }),
        h('code', null, c.name)))));
  }

  function projectEditor(d, input, { actions }) {
    return checkList('Keep only these columns', input, d.columns, 'p-', columns => actions.updateDraft({ columns }));
  }

  function joinEditor(d, input, { dataset, actions }) {
    const choices = dataset.tables.filter(t => !input.sources.includes(t.name));
    const parts = [h('div', { class: 'row' }, 'Combine with',
      choices.length
        ? select('j-table', d.table, choices.map(t => ({ value: t.name, label: t.name })), v => {
          const s = QE.suggestJoinKey(input, QE.loadTable(QE.findTableDef(dataset, v)));
          actions.updateDraft({ table: v, leftColumn: s ? s.leftColumn : '', rightColumn: s ? s.rightColumn : '', cartesian: false });
        }, 'Table')
        : h('span', { class: 'reason' }, 'Every table in this data set is already combined into this table.'))];
    if (!d.table) return parts;
    const other = QE.loadTable(QE.findTableDef(dataset, d.table));
    const s = QE.suggestJoinKey(input, other);
    const left = QE.getColumn(input, d.leftColumn);
    const isSuggested = s && !d.cartesian && s.leftColumn === d.leftColumn && s.rightColumn === d.rightColumn;
    parts.push(h('div', { class: 'row' }, 'matching',
      select('j-left', d.leftColumn, input.columns.map(c => ({ value: c.name, label: c.name })), v => {
        const type = QE.getColumn(input, v).type;
        const keepRight = other.columns.some(c => c.name === d.rightColumn && c.type === type);
        actions.updateDraft({ leftColumn: v, rightColumn: keepRight ? d.rightColumn : '' });
      }, 'Column in the current table', d.cartesian),
      'equals',
      select('j-right', d.rightColumn, other.columns.filter(c => !left || c.type === left.type).map(c => ({ value: c.name, label: c.name })),
        v => actions.updateDraft({ rightColumn: v }), `Column in ${d.table}`, d.cartesian),
      isSuggested ? h('span', { class: 'suggested' }, '✓ suggested') : null));
    if (!s) parts.push(h('p', { class: 'reason' }, "These tables don't share a key."));
    parts.push(h('label', null,
      h('input', { type: 'checkbox', 'data-focus-key': 'j-cart', checked: d.cartesian, onchange: e => actions.updateDraft({ cartesian: e.target.checked }) }),
      " Don't match on anything"));
    return parts;
  }

  function aggregateEditor(d, input, { actions }) {
    const setSummaries = summaries => actions.updateDraft({ summaries });
    return [
      checkList('Group by (leave all unchecked to summarize the whole table)', input, d.groupBy, 'g-', groupBy => actions.updateDraft({ groupBy })),
      h('fieldset', null, h('legend', null, 'Calculate'),
        d.summaries.map((s, i) => {
          const fn = QE.SUMMARY_FUNCTIONS.find(f => f.id === s.fn);
          const cols = input.columns.filter(c => fn.types.includes(c.type));
          return h('div', { class: 'row' },
            select('s-fn-' + i, s.fn, QE.SUMMARY_FUNCTIONS.map(f => ({ value: f.id, label: f.label })), v => {
              const next = QE.SUMMARY_FUNCTIONS.find(f => f.id === v);
              const keep = input.columns.some(c => c.name === s.column && next.types.includes(c.type));
              setSummaries(d.summaries.map((x, j) => (j === i ? { fn: v, column: keep ? s.column : '' } : x)));
            }, 'Calculation'),
            s.fn === 'count' ? null : ['of', select('s-col-' + i, s.column, cols.map(c => ({ value: c.name, label: c.name })),
              v => setSummaries(d.summaries.map((x, j) => (j === i ? { ...x, column: v } : x))), 'Column')],
            d.summaries.length > 1
              ? h('button', { class: 'btn small', type: 'button', 'data-focus-key': 's-del-' + i, 'aria-label': 'Remove this calculation',
                onclick: () => setSummaries(d.summaries.filter((_, j) => j !== i)) }, '✕')
              : null);
        }),
        d.summaries.length < 3
          ? h('button', { class: 'btn small', type: 'button', 'data-focus-key': 's-add', onclick: () => setSummaries([...d.summaries, { fn: 'count', column: '' }]) }, '+ Add a calculation')
          : null),
    ];
  }

  const EDITORS = { filter: filterEditor, project: projectEditor, join: joinEditor, aggregate: aggregateEditor };

  function editor(ctx, input) {
    const { state, actions } = ctx;
    const reason = blockReason(ctx, input);
    return h('div', { class: 'editor' },
      EDITORS[state.draft.op](state.draft, input, ctx),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', id: 'apply-btn', 'data-focus-key': 'apply', disabled: !!reason, onclick: actions.applyDraft }, 'Apply'),
        h('button', { class: 'btn', type: 'button', 'data-focus-key': 'cancel', onclick: actions.cancelDraft }, 'Cancel'),
        h('span', { class: 'reason', id: 'apply-reason', 'aria-live': 'polite' }, reason ? rich(reason) : '')));
  }

  function startCard({ state, dataset, actions }) {
    return h('li', { class: 'step' + (state.selected === 0 ? ' selected' : '') },
      h('div', { class: 'step-main' },
        h('button', { class: 'step-num', type: 'button', 'data-focus-key': 'step-0', 'aria-label': 'Show the starting table', onclick: () => actions.selectStep(0) }, '0'),
        h('span', null,
          h('span', { class: 'step-op' }, 'Start'),
          h('label', { class: 'step-text' }, 'Start with ',
            h('select', { 'data-focus-key': 'start', onchange: e => actions.setStart(e.target.value) },
              dataset.tables.map(t => h('option', { value: t.name, selected: t.name === state.recipe.start }, t.name)))))));
  }

  function stepCard(ctx, step, n) {
    const { state, results, actions } = ctx;
    const r = results[n];
    const input = results[n - 1].table;
    const off = step.on === false;
    return h('li', { class: ['step', state.selected === n ? 'selected' : '', off ? 'off' : ''].join(' ') },
      h('button', { class: 'step-main', type: 'button', 'data-focus-key': 'step-' + n, 'aria-pressed': String(state.selected === n), onclick: () => actions.selectStep(n) },
        h('span', { class: 'step-num' }, String(n)),
        h('span', null,
          h('span', { class: 'step-op' }, icon(step.op), opLabel(step.op), off ? ' (turned off)' : ''),
          h('span', { class: 'step-text' }, rich(QE.describeStep(step, input))))),
      r.status === 'invalid' ? h('span', { class: 'warn-badge', role: 'note' }, '⚠ ', rich(r.message)) : null,
      state.editing === n
        ? editor(ctx, input)
        : h('div', { class: 'step-tools' },
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'edit-' + n, onclick: () => actions.editStep(n) }, 'Edit'),
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'toggle-' + n, onclick: () => actions.toggleStep(n) }, off ? 'Turn on' : 'Turn off'),
          h('button', { class: 'btn small', type: 'button', 'data-focus-key': 'delete-' + n, onclick: () => actions.deleteStep(n) }, 'Delete')));
  }

  function newCard(ctx) {
    const { state, results } = ctx;
    const n = state.recipe.steps.length + 1;
    return h('li', { class: 'step selected' },
      h('div', { class: 'step-main' },
        h('span', { class: 'step-num' }, String(n)),
        h('span', null, h('span', { class: 'step-op' }, icon(state.draft.op), 'New ' + opLabel(state.draft.op).toLowerCase() + ' step'))),
      editor(ctx, results[results.length - 1].table));
  }

  function renderRecipePanel(ctx) {
    const { state, actions } = ctx;
    const items = [startCard(ctx)];
    state.recipe.steps.forEach((step, k) => items.push(stepCard(ctx, step, k + 1)));
    if (state.editing === 'new') items.push(newCard(ctx));
    return h('section', { class: 'recipe', 'aria-label': 'Recipe' },
      h('h2', null, 'Recipe'),
      h('ol', { class: 'steps' }, items),
      h('div', { class: 'ops', role: 'group', 'aria-label': 'Add a step' },
        OPS.map(o => h('button', { class: 'op-btn', type: 'button', 'data-focus-key': 'add-' + o.op, onclick: () => actions.addStep(o.op) }, icon(o.op), o.label))));
  }

  root.QE = Object.assign(QE, { newDraft, renderRecipePanel });
})(this);
