// SQL Studio: the page shell: header, Exercises strip, and four panels (built with panels.js) and their splitters.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, makePanel, splitter } = SS;

  function createLayout(appEl, prefs, persist) {
    let saveTimer = null;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => persist(prefs), 250); };
    const toggles = [];
    const onToggle = (key, collapsed) => { applySizes(); toggles.forEach(fn => fn(key, collapsed)); };
    const common = { prefs, save, onToggle };

    const header = h('header', { class: 'top' });
    const exercises = makePanel({ key: 'exercises', title: 'Exercises', iconName: 'bulb', cls: 'ex-strip', ...common });
    const sql = makePanel({ key: 'sql', title: 'SQL', iconName: 'db', cls: 'sql-panel', zoomable: true, ...common });
    const results = makePanel({ key: 'results', title: 'Results', iconName: 'results', cls: 'results-panel', zoomable: true, ...common });
    const erd = makePanel({ key: 'erd', title: 'ERD', iconName: 'grid', cls: 'erd-panel', ...common });
    const data = makePanel({ key: 'data', title: 'Data', iconName: 'table', cls: 'data-panel', zoomable: true, ...common });

    const toprow = h('div', { class: 'toprow' });
    const workspace = h('div', { class: 'workspace' });
    const D = SS.DEFAULT_PREFS;
    const px = v => `${Math.round(v)} pixels`;

    const vSplit = splitter({
      orientation: 'vertical', label: 'Resize SQL and Results', controls: `${sql.body.id} ${results.body.id}`,
      get: () => prefs.sqlWidth * 100, set: v => { prefs.sqlWidth = v / 100; applySizes(); save(); },
      min: 20, max: 80, step: 2, toValue: dx => (dx / Math.max(1, toprow.clientWidth)) * 100,
      reset: () => { prefs.sqlWidth = D.sqlWidth; applySizes(); save(); }, format: v => `SQL panel ${Math.round(v)}% wide`,
    });
    const hSplit = (key, label, controls) => splitter({
      orientation: 'horizontal', label, controls,
      get: () => prefs[key], set: v => { prefs[key] = v; applySizes(); save(); },
      min: key === 'dataHeight' ? 120 : 160, max: 2000, step: 20, toValue: dy => dy,
      reset: () => { prefs[key] = D[key]; applySizes(); save(); }, format: v => `${label}: ${px(v)} tall`,
    });
    const topSplit = hSplit('topHeight', 'Resize SQL and Results height', `${sql.body.id} ${results.body.id}`);
    const erdSplit = hSplit('erdHeight', 'Resize ERD height', erd.body.id);
    const dataSplit = hSplit('dataHeight', 'Resize Data height', data.body.id);

    toprow.append(sql.el, vSplit.el, results.el);
    workspace.append(exercises.el, toprow, topSplit.el, erd.el, erdSplit.el, data.el, dataSplit.el);
    const footnote = h('p', { class: 'footnote' }, 'Real names, made-up numbers. All data is invented for practice.');
    appEl.append(h('div', { class: 'app' }, header, workspace, footnote));

    function applySizes() {
      const c = prefs.collapsed;
      const w = prefs.sqlWidth;
      toprow.style.gridTemplateColumns = c.sql && c.results ? 'auto 10px auto'
        : c.sql ? 'auto 10px minmax(0,1fr)' : c.results ? 'minmax(0,1fr) 10px auto' : `minmax(0,${w}fr) 10px minmax(0,${(1 - w).toFixed(3)}fr)`;
      const topBoth = c.sql && c.results;
      workspace.style.gridTemplateRows = [
        'auto',
        topBoth ? 'auto' : `${prefs.topHeight}px`, '10px',
        c.erd ? 'auto' : `${prefs.erdHeight}px`, '10px',
        c.data ? 'auto' : `${prefs.dataHeight}px`, '10px',
      ].join(' ');
      vSplit.el.hidden = c.sql || c.results;
      vSplit.sync(); topSplit.sync(); erdSplit.sync(); dataSplit.sync();
    }
    applySizes();

    return { header, exercises, sql, results, erd, data, applySizes, save, onPanelToggle: fn => toggles.push(fn) };
  }

  root.SS = Object.assign(SS, { createLayout });
})(this);
