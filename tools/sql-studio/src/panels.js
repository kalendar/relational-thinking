// SQL Studio (shared with the ERD Playground): a collapsible panel with text zoom, and a draggable,
// keyboard-movable splitter. Needs SS.h, SS.icon, SS.iconButton, SS.announce, and SS.stepZoom.
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

  root.SS = Object.assign(SS, { makePanel, splitter });
})(this);
