// Constraint Gauntlet: the Row form (spec §5.1). One labeled field per column, a live SQL preview,
// and Add / Edit / Delete. Typing updates the preview without rebuilding the form, so focus stays put.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const PLACEHOLDER = { int: 'e.g. 4', decimal: 'e.g. 45.00', date: 'YYYY-MM-DD', time: 'HH:MM', varchar: '' };

  function hintsFor(t, c, tables) {
    const pk = CG.pkColumns(t);
    const out = [];
    if (pk.includes(c.name)) out.push('key');
    if (c.notNull || pk.includes(c.name)) out.push('required'); else out.push('blank = NULL');
    if (c.unique || (t.constraints || []).some(k => k.kind === 'unique' && k.columns.includes(c.name))) out.push('unique');
    if (c.check) out.push(`rule: ${c.check.expr}`);
    if (c.fk) { const p = CG.findTable(tables, c.fk.table); out.push(`must match a ${p ? CG.noun(p) : c.fk.table}`); }
    return out.join(' · ');
  }

  const fieldText = (c, v) => (v === null || v === undefined ? '' : c.type === 'decimal' && typeof v === 'number' ? v.toFixed(c.precision ? c.precision[1] : 2) : CG.showValue(c, v));

  function defaults(ctx, t) {
    const f = {};
    const pk = CG.pkColumns(t);
    const next = pk.length === 1 ? CG.nextId(ctx.session.game, t.name) : null;
    for (const c of t.columns) {
      if (pk.length === 1 && c.name === pk[0] && next !== null) f[c.name] = String(next);
      else if (c.default !== undefined) f[c.name] = fieldText(c, c.default);
      else f[c.name] = '';
    }
    return f;
  }

  function fromRow(t, row) {
    const f = {};
    for (const c of t.columns) f[c.name] = fieldText(c, row[c.name]);
    return f;
  }

  const autoKey = (t, fields) => { const pk = CG.pkColumns(t); return pk.length === 1 ? fields[pk[0]] : null; };

  // Makes sure ui.form matches the current table, action, and selected row.
  function syncForm(ctx) {
    const st = ctx.session.state();
    const names = (ctx.level.formTables || st.tables.map(t => t.name)).filter(n => CG.findTable(st.tables, n));
    const ui = ctx.ui;
    if (!ui.form || !names.includes(ui.form.table)) ui.form = { table: names[0], action: 'add', fields: null, problems: {}, invalid: [] };
    const t = CG.findTable(st.tables, ui.form.table);
    const sel = ui.selected && ui.selected.table === t.name ? st.rows[t.name].find(r => r._rowid === ui.selected.rowid) : null;
    if (ui.form.action !== 'add' && sel && ui.form.forRowid !== sel._rowid) { ui.form.fields = fromRow(t, sel); ui.form.forRowid = sel._rowid; }
    if (!ui.form.fields) { ui.form.fields = defaults(ctx, t); ui.form.autoId = autoKey(t, ui.form.fields); }
    // Keep the suggested ID fresh when rows arrive some other way (SQL tab, a card, a prediction),
    // unless the student typed their own.
    if (ui.form.action === 'add') {
      const pk = CG.pkColumns(t);
      if (pk.length === 1 && ui.form.autoId !== null && ui.form.fields[pk[0]] === ui.form.autoId) {
        const next = CG.nextId(ctx.session.game, t.name);
        if (next !== null) { ui.form.fields[pk[0]] = String(next); ui.form.autoId = String(next); }
      }
    }
    return { st, names, t, sel };
  }

  function previewSql(ctx, t, sel) {
    const f = ctx.ui.form;
    if (f.action === 'delete') return sel ? CG.deleteSql(t, sel) : '-- Pick a row in the Tables panel first.';
    if (f.action === 'edit' && !sel) return '-- Pick a row in the Tables panel first.';
    const parsed = CG.parseForm(t, f.fields);
    if (!parsed.ok) return Object.values(parsed.problems).map(p => `-- ${SS.plain(p)}`).join('\n');
    if (f.action === 'edit') return CG.updateSql(t, parsed.row, sel) || '-- Nothing changed yet. Edit a field.';
    return CG.insertSql(t, parsed.row);
  }

  function renderRowForm(body, ctx) {
    const { names, t, sel, st } = syncForm(ctx);
    const f = ctx.ui.form;
    const pre = h('pre', { class: 'cg-preview-sql mono', 'aria-live': 'off' });
    const updatePreview = () => { pre.textContent = previewSql(ctx, t, sel); };

    const tablePick = h('select', { id: 'cg-form-table', 'aria-label': 'Table',
      onchange: () => { f.table = tablePick.value; f.fields = null; f.problems = {}; f.invalid = []; f.forRowid = null; ctx.render(); } },
    names.map(n => h('option', { value: n, selected: n === f.table }, n)));
    const actions = [['add', 'Add row', 'plus'], ['edit', 'Edit a row', 'pencil'], ['delete', 'Delete a row', 'trash']];
    const seg = h('div', { class: 'cg-seg', role: 'group', 'aria-label': 'What do you want to do?' },
      actions.map(([id, label, ic]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(f.action === id),
        onclick: () => {
          f.action = id; f.problems = {}; f.invalid = []; f.forRowid = null;
          f.fields = id === 'add' ? null : (sel ? fromRow(t, sel) : f.fields);
          ctx.render();
        } }, icon(ic), label)));

    const parts = [h('div', { class: 'cg-form-top' }, h('label', { for: 'cg-form-table', class: 'cg-small-label' }, 'Table'), tablePick, seg)];
    if (f.action !== 'add' && !sel) parts.push(h('p', { class: 'cg-hint' }, icon('info'), 'Pick a row in the Tables panel first.'));
    if (f.action === 'delete' && sel) parts.push(h('p', { class: 'cg-hint' }, 'This will try to delete ', h('strong', null, CG.nameRow(t, sel)), '.'));

    if (f.action !== 'delete') {
      const tables = st.tables;
      const fields = t.columns.map(c => {
        const id = `cg-f-${t.name}-${c.name}`;
        const hintId = `${id}-hint`;
        const probId = `${id}-prob`;
        const invalid = (f.invalid || []).includes(c.name) || !!f.problems[c.name];
        const attrs = { id, 'aria-describedby': `${hintId}${f.problems[c.name] ? ` ${probId}` : ''}`, 'aria-invalid': invalid ? 'true' : null,
          class: invalid ? 'invalid' : null, disabled: f.action === 'edit' && !sel };
        let control;
        if (c.type === 'boolean') {
          control = h('select', attrs, (c.notNull ? [] : ['']).concat(['true', 'false']).map(v => h('option', { value: v, selected: f.fields[c.name] === v }, v || '(blank)')));
          control.addEventListener('change', () => { f.fields[c.name] = control.value; updatePreview(); });
        } else {
          control = h('input', Object.assign({ type: 'text', value: f.fields[c.name], placeholder: PLACEHOLDER[c.type] || '', autocomplete: 'off', spellcheck: 'false' }, attrs));
          control.addEventListener('input', () => { f.fields[c.name] = control.value; updatePreview(); });
          control.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ctx.act.submitForm(); } });
        }
        return h('div', { class: 'cg-field' },
          h('label', { for: id }, h('code', null, c.name), h('span', { class: 'cg-type' }, CG.typeOf(c).sql(c))),
          control,
          h('p', { class: 'cg-field-hint', id: hintId }, hintsFor(t, c, tables)),
          f.problems[c.name] ? h('p', { class: 'cg-field-problem', id: probId }, SS.rich(f.problems[c.name])) : null);
      });
      parts.push(h('div', { class: 'cg-fields' }, fields));
    }

    updatePreview();
    const label = { add: 'Add row', edit: 'Save changes', delete: 'Delete row' }[f.action];
    parts.push(h('div', { class: 'cg-preview' },
      h('div', { class: 'cg-preview-head' }, h('span', { class: 'cg-small-label' }, 'SQL this will run'),
        h('span', { class: 'cg-preview-tools' },
          h('button', { type: 'button', class: 'btn', onclick: async () => { SS.announce((await SS.copyText(pre.textContent)) === 'copied' ? 'SQL copied' : 'Could not copy'); } }, icon('copy'), 'Copy SQL'),
          h('button', { type: 'button', class: 'btn', onclick: () => ctx.act.openInSql(pre.textContent) }, icon('next'), 'Open in SQL tab'))),
      pre));
    parts.push(h('div', { class: 'cg-actions' },
      h('button', { type: 'button', class: 'btn primary', disabled: f.action !== 'add' && !sel, onclick: () => ctx.act.submitForm() }, icon(f.action === 'delete' ? 'trash' : 'play'), label)));

    SS.clear(body).append(h('div', { class: 'cg-form' }, parts));
  }

  CG.renderRowForm = renderRowForm;
  CG.formDefaults = defaults;
})(this);
