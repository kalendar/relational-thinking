// SQL Studio: the page shell: header, Exercises strip, and four panels with collapse, text zoom, and splitters.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon, iconButton } = SS;

  // A panel: chevron + icon + bold name, a tools area, optional text zoom, and a body.
  function makePanel({ key, title, iconName, cls = '', zoomable = false, prefs, save, onToggle }) {
    const bodyId = `panel-${key}-body`;
    const titleId = `panel-${key}-title`;
    const chev = h('button', { type: 'button', class: 'chev', 'aria-controls': bodyId }, icon('chevron'));
    const headSlot = h('div', { class: 'head-slot', style: { display: 'contents' } });
    const tools = h('div', { class: 'panel-tools' });
    const body = h('div', { class: 'panel-body', id: bodyId, role: 'region', 'aria-labelledby': titleId });
    const head = h('div', { class: 'panel-head' }, chev, h('h2', { class: 'panel-title', id: titleId }, icon(iconName), title), headSlot, tools);
    const el = h('section', { class: `panel ${cls}`, 'aria-labelledby': titleId }, head, body);

    function setCollapsed(c) {
      el.classList.toggle('collapsed', c);
      chev.setAttribute('aria-expanded', String(!c));
      chev.setAttribute('aria-label', `${c ? 'Expand' : 'Collapse'} ${title}`);
      chev.title = `${c ? 'Expand' : 'Collapse'} ${title}`;
    }
    chev.addEventListener('click', () => {
      prefs.collapsed[key] = !prefs.collapsed[key];
      setCollapsed(prefs.collapsed[key]);
      save();
      onToggle(key, prefs.collapsed[key]);
    });
    setCollapsed(!!prefs.collapsed[key]);

    if (zoomable) {
      const out = h('output', { 'aria-live': 'off' });
      const apply = () => { body.style.setProperty('--zoom', prefs.zoom[key]); out.textContent = `${prefs.zoom[key]}%`; };
      const step = dir => () => { prefs.zoom[key] = SS.stepZoom(prefs.zoom[key], dir); apply(); save(); SS.announce(`${title} text ${prefs.zoom[key]}%`); };
      tools.append(h('span', { class: 'zoom', role: 'group', 'aria-label': `${title} text size` },
        iconButton('minus', `Smaller text in ${title}`, { onclick: step(-1) }), out, iconButton('plus', `Bigger text in ${title}`, { onclick: step(1) })));
      apply();
    }
    return { el, head, headSlot, tools, body, setCollapsed, title };
  }

  // A draggable, keyboard-movable splitter (role="separator").
  // get/set work in the splitter's own unit; `toValue` turns a pointer move (px) into that unit.
  function splitter({ orientation, label, controls, get, set, min, max, step, toValue, reset, format }) {
    const el = h('div', { class: `splitter ${orientation === 'vertical' ? 'v' : 'h'}`, role: 'separator', tabindex: '0',
      'aria-orientation': orientation, 'aria-label': label, 'aria-controls': controls, title: `${label} (drag, or use the arrow keys)` });
    const sync = () => {
      el.setAttribute('aria-valuemin', String(min));
      el.setAttribute('aria-valuemax', String(max));
      el.setAttribute('aria-valuenow', String(Math.round(get())));
      el.setAttribute('aria-valuetext', format(get()));
    };
    const put = v => { set(Math.min(max, Math.max(min, v))); sync(); };
    el.addEventListener('keydown', e => {
      const big = e.shiftKey ? 5 : 1;
      const back = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
      const fwd = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
      if (e.key === back) put(get() - step * big);
      else if (e.key === fwd) put(get() + step * big);
      else if (e.key === 'Home') put(min);
      else if (e.key === 'End') put(max);
      else if (e.key === 'Enter') { reset(); sync(); } else return;
      e.preventDefault();
    });
    el.addEventListener('dblclick', () => { reset(); sync(); });
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      const start = orientation === 'vertical' ? e.clientX : e.clientY;
      const startVal = get();
      const move = ev => put(startVal + toValue((orientation === 'vertical' ? ev.clientX : ev.clientY) - start));
      const up = () => { el.classList.remove('dragging'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    sync();
    return { el, sync };
  }

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

  root.SS = Object.assign(SS, { createLayout, makePanel, splitter });
})(this);
