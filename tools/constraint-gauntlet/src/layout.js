// Constraint Gauntlet: the page shell: header, Goals strip, Input and Tables panels with a splitter,
// the result area, and the Rules panel. Built on SQL Studio's panels.js.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const LAYOUT_KEY = 'constraintGauntlet.layout.v1';
  const PANELS = ['goals', 'input', 'tables', 'rules'];
  const DEFAULT = () => ({ collapsed: { goals: false, input: false, tables: false, rules: false }, zoom: { input: 100, tables: 100, rules: 100 }, split: 52 });

  function loadLayout(storage) {
    const p = DEFAULT();
    try {
      const raw = JSON.parse(storage.getItem(LAYOUT_KEY));
      if (raw && typeof raw === 'object') {
        for (const k of PANELS) if (raw.collapsed && typeof raw.collapsed[k] === 'boolean') p.collapsed[k] = raw.collapsed[k];
        for (const k of Object.keys(p.zoom)) if (raw.zoom && typeof raw.zoom[k] === 'number') p.zoom[k] = Math.min(200, Math.max(70, raw.zoom[k]));
        if (typeof raw.split === 'number') p.split = Math.min(75, Math.max(25, raw.split));
      }
    } catch (_) { /* defaults */ }
    return p;
  }
  function saveLayout(storage, p) { try { storage.setItem(LAYOUT_KEY, JSON.stringify(p)); } catch (_) { /* storage blocked */ } }

  function createLayout(appEl, { storage, levels, onPickLevel, onResetLevel }) {
    const prefs = loadLayout(storage);
    const save = () => saveLayout(storage, prefs);
    const noop = () => {};

    const picker = h('select', { id: 'cg-level', class: 'picker', onchange: () => onPickLevel(Number(picker.value)) },
      levels.map(l => h('option', { value: String(l.id) }, `${l.id}. ${l.title}`)));
    const mission = h('p', { class: 'sub cg-mission' });
    const progressLine = h('p', { class: 'picker-desc' });
    const resetBtn = h('button', { type: 'button', class: 'btn', onclick: () => onResetLevel() }, icon('reset'), 'Reset level');
    const header = h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, icon('shield')),
        h('div', null, h('h1', null, 'Constraint Gauntlet'), mission)),
      h('div', { class: 'picker-wrap' },
        h('div', { class: 'picker-row' }, h('label', { for: 'cg-level' }, 'Level'), picker, resetBtn),
        progressLine));

    const goals = SS.makePanel({ key: 'goals', title: 'Goals', iconName: 'flag', cls: 'ex-strip goals-strip', prefs, save, onToggle: noop });
    const input = SS.makePanel({ key: 'input', title: 'Input', iconName: 'pencil', cls: 'input-panel', zoomable: true, prefs, save, onToggle: noop });
    const tables = SS.makePanel({ key: 'tables', title: 'Tables', iconName: 'table', cls: 'tables-panel', zoomable: true, prefs, save, onToggle: noop });
    const rules = SS.makePanel({ key: 'rules', title: 'Rules on this table', iconName: 'lock', cls: 'rules-panel', zoomable: true, prefs, save, onToggle: noop });

    const workspace = h('div', { class: 'workspace cg-workspace' });
    const apply = () => { workspace.style.gridTemplateColumns = `minmax(0, ${prefs.split}fr) 12px minmax(0, ${100 - prefs.split}fr)`; };
    const split = SS.splitter({
      orientation: 'vertical', label: 'Resize Input and Tables', controls: input.body.id,
      get: () => prefs.split, set: v => { prefs.split = v; apply(); save(); },
      min: 25, max: 75, step: 2, toValue: px => (px / Math.max(1, workspace.clientWidth)) * 100,
      reset: () => { prefs.split = 52; apply(); save(); }, format: v => `Input ${Math.round(v)}% wide`,
    });
    workspace.append(input.el, split.el, tables.el);
    apply();

    const resultArea = h('div', { class: 'cg-result-area' });
    const footnote = h('p', { class: 'footnote' }, 'All people and data are invented for practice. Goes with Chapter 11 of Relational Thinking.');

    SS.clear(appEl);
    appEl.classList.remove('booting');
    appEl.classList.add('app', 'cg-app');
    appEl.append(header, goals.el, workspace, resultArea, rules.el, footnote);

    return { prefs, picker, mission, progressLine, resetBtn, goals, input, tables, rules, resultArea, workspace };
  }

  CG.createLayout = createLayout;
  CG.LAYOUT_KEY = LAYOUT_KEY;
})(this);
