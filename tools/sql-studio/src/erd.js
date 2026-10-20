// SQL Studio: the ERD panel. Draws the schema as SVG; tables drag, tidy, zoom, pan, pinch;
// Edit Links adds/removes relationships; PNG copies or downloads the picture.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, s, clear, icon, iconButton } = SS;
  const B = SS.BOX;

  const TIPS = {
    none: 'Pick a data set to begin.',
    view: 'Drag a table to move it. Pinch or use − / + to zoom.',
    edit: 'Drag from a foreign key to a primary key to add a link. Select a link and press Delete to remove it.',
  };

  function createErd(panel, { prefs, save, onChange }) {
    // ---- header controls ----
    const tip = h('span', { class: 'hint-text' }, icon('info'), h('span', null, TIPS.none));
    panel.headSlot.append(tip);
    const zoomOut = h('output', { 'aria-live': 'off' });
    const zoomGroup = h('span', { class: 'zoom', role: 'group', 'aria-label': 'Diagram zoom' },
      iconButton('minus', 'Zoom out', { onclick: () => zoomBy(-1) }), zoomOut, iconButton('plus', 'Zoom in', { onclick: () => zoomBy(1) }));
    const tidyBtn = h('button', { type: 'button', class: 'btn', title: 'Lay out the diagram neatly', onclick: () => { tidy(); SS.announce('Diagram tidied.'); } }, icon('tidy'), 'Tidy');
    const editBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => setEditing(!editing) }, icon('link'), 'Edit Links');
    const pngBtn = h('button', { type: 'button', class: 'btn', title: 'Copy the diagram as a picture', onclick: copyPng }, icon('image'), 'PNG');
    const attrBox = h('input', { type: 'checkbox', id: 'erd-attrs' });
    attrBox.checked = prefs.attributes;
    attrBox.addEventListener('change', () => { prefs.attributes = attrBox.checked; save(); render(); });
    panel.tools.append(zoomGroup, tidyBtn, editBtn, pngBtn, h('label', { class: 'check-label', for: 'erd-attrs' }, attrBox, 'Attributes'));

    // ---- canvas ----
    const viewport = s('g', { class: 'viewport' });
    const svg = s('svg', { role: 'group', 'aria-label': 'Entity relationship diagram' }, viewport);
    const canvas = h('div', { class: 'erd-canvas' }, svg);
    const chips = h('div', { class: 'erd-chips' });
    const note = h('div', { class: 'erd-note', hidden: true });
    const form = h('div', { class: 'erd-links-form', hidden: true });
    panel.body.append(canvas, chips, note, form);

    // ---- state ----
    let schema = null;
    let original = [];
    const positionsById = new Map();
    let pos = {};
    let hidden = new Set();
    let folded = new Set();
    let editing = false;
    let selected = null; // relationship index
    let view = { scale: prefs.erdZoom / 100, tx: 0, ty: 0 };
    let focusKey = null;

    const showCols = name => prefs.attributes && !folded.has(name);
    const boxOf = t => ({ ...pos[t.name], ...SS.boxSize(t, { showColumns: showCols(t.name) }) });
    const visibleTables = () => schema.tables.filter(t => !hidden.has(t.name));
    const visibleLinks = () => schema.relationships.map((r, i) => ({ r, i })).filter(({ r }) => !hidden.has(r.from.table) && !hidden.has(r.to.table));

    function counts() {
      return { tables: visibleTables().length, relationships: visibleLinks().length };
    }

    // ---- public ----
    function setSchema(next, { renamed = [] } = {}) {
      if (schema) positionsById.set(schema.id, { pos, hidden, folded });
      schema = next;
      original = next.relationships.map(r => JSON.parse(JSON.stringify(r)));
      const old = positionsById.get(next.id);
      // A new upload can reuse the id 'upload' with different tables; only reuse positions that still fit.
      const saved = old && next.tables.every(t => old.pos[t.name]) ? old : null;
      pos = saved ? saved.pos : SS.tidyLayout(next, { showColumns: prefs.attributes });
      hidden = saved ? saved.hidden : new Set();
      folded = saved ? saved.folded : new Set();
      selected = null;
      setEditing(false, { quiet: true });
      note.hidden = !renamed.length;
      note.replaceChildren(renamed.length ? `Renamed for SQL: ${renamed.slice(0, 6).map(r => `${r.from || '(blank)'} → ${r.to}`).join(', ')}${renamed.length > 6 ? ', …' : ''}` : '');
      render();
      fit();
    }

    function setEditing(on, { quiet = false } = {}) {
      editing = on;
      editBtn.setAttribute('aria-pressed', String(on));
      tip.lastChild.textContent = schema ? (on ? TIPS.edit : TIPS.view) : TIPS.none;
      form.hidden = !on;
      if (on) drawForm();
      selected = null;
      if (schema) render();
      if (!quiet) SS.announce(on ? 'Edit Links is on. ' + TIPS.edit : 'Edit Links is off.');
    }

    function tidy() {
      pos = SS.tidyLayout(schema, { showColumns: prefs.attributes, hidden });
      render();
      fit();
    }

    // ---- view transform ----
    function applyView() {
      viewport.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.scale})`);
      zoomOut.textContent = `${Math.round(view.scale * 100)}%`;
    }
    function zoomAt(newScale, cx, cy) {
      const sc = Math.min(SS.ERD_ZOOM.max / 100, Math.max(SS.ERD_ZOOM.min / 100, newScale));
      view.tx = cx - ((cx - view.tx) * sc) / view.scale;
      view.ty = cy - ((cy - view.ty) * sc) / view.scale;
      view.scale = sc;
      prefs.erdZoom = Math.round(sc * 100);
      save();
      applyView();
    }
    function zoomBy(dir) {
      const r = svg.getBoundingClientRect();
      zoomAt(SS.stepZoom(Math.round(view.scale * 100), dir, SS.ERD_ZOOM) / 100, r.width / 2, r.height / 2);
      SS.announce(`Diagram zoom ${Math.round(view.scale * 100)}%`);
    }
    // Centers the visible tables in the canvas, zoomed out if needed so all of them show.
    function fit() {
      const ts = visibleTables();
      if (!ts.length) { applyView(); return; }
      const boxes = ts.map(boxOf);
      const bounds = { minX: Math.min(...boxes.map(b => b.x)), minY: Math.min(...boxes.map(b => b.y)), maxX: Math.max(...boxes.map(b => b.x + b.w)), maxY: Math.max(...boxes.map(b => b.y + b.h)) };
      const r = svg.getBoundingClientRect();
      // Zooms out (without changing the saved zoom) when the diagram is wider or taller than the canvas.
      view = SS.fitView(bounds, { width: r.width, height: r.height }, prefs.erdZoom / 100);
      applyView();
    }

    // ---- drawing ----
    function render() {
      if (!schema) return;
      const active = document.activeElement;
      focusKey = active && svg.contains(active) ? active.getAttribute('data-key') : null;
      clear(viewport);
      const links = s('g', { class: 'links' });
      const tables = s('g', { class: 'tables' });
      viewport.append(links, tables);
      for (const { r, i } of visibleLinks()) links.append(drawLink(r, i));
      for (const t of visibleTables()) tables.append(drawTable(t));
      drawChips();
      applyView();
      if (focusKey) {
        const el = svg.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
        if (el) el.focus();
      }
      onChange(counts());
    }

    function drawLink(r, i) {
      const ft = schema.tables.find(t => t.name === r.from.table);
      const tt = schema.tables.find(t => t.name === r.to.table);
      const route = SS.linkRoute(boxOf(ft), ft, r.from.column, boxOf(tt), tt, r.to.column, showCols(ft.name), showCols(tt.name));
      const d = SS.pathData(route.points);
      const first = route.points[0];
      const last = route.points[route.points.length - 1];
      const many = SS.crowFoot(first, route.fromSide, 'many');
      const one = SS.crowFoot(last, route.toSide, 'one');
      const shapes = [...many.lines, ...one.lines].map(([x1, y1, x2, y2]) => s('line', { x1, y1, x2, y2 }));
      const label = `Link: ${r.from.table}.${r.from.column} to ${r.to.table}.${r.to.column}. Many ${r.from.table} rows to one ${r.to.table} row.`;
      const g = s('g', {
        class: `erd-link${editing ? ' editing' : ''}${selected === i ? ' selected' : ''}`, 'data-key': `link:${i}`,
        tabindex: editing ? '0' : null, role: editing ? 'button' : null, 'aria-label': label,
      }, s('title', null, label), s('path', { class: 'hit', d }), s('path', { class: 'line', d }), shapes,
      many.circle ? s('circle', { cx: many.circle.cx, cy: many.circle.cy, r: many.circle.r }) : null);
      if (editing) {
        g.addEventListener('click', e => { e.stopPropagation(); selected = i; render(); });
        g.addEventListener('keydown', e => {
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLink(i); }
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected = i; render(); }
        });
      }
      return g;
    }

    function drawTable(t) {
      const b = boxOf(t);
      const cols = showCols(t.name);
      const g = s('g', { class: 'erd-table', transform: `translate(${b.x} ${b.y})`, tabindex: '0', role: 'group', 'data-key': `table:${t.name}`,
        'aria-label': `${t.name} table, ${t.columns.length} columns. Arrow keys move it.` });
      g.append(s('rect', { class: 'box', width: b.w, height: b.h, rx: 10 }));
      g.append(s('rect', { class: 'head', x: 1, y: 1, width: b.w - 2, height: B.header - 2, rx: 9 }));
      g.append(s('text', { class: 'tname', x: B.padX, y: 22 }, t.name));
      g.append(tableButton(b.w - 54, cols ? 'chevron' : 'next', `${cols ? 'Hide' : 'Show'} the columns of ${t.name}`, `fold:${t.name}`, () => {
        if (folded.has(t.name)) folded.delete(t.name); else folded.add(t.name);
        render();
      }));
      g.append(tableButton(b.w - 28, 'eyeOff', `Hide the ${t.name} table`, `hide:${t.name}`, () => {
        hidden.add(t.name);
        render();
        SS.announce(`${t.name} is hidden. Use the Hidden chips to bring it back.`);
      }));
      if (cols) t.columns.forEach((c, i) => g.append(columnRow(t, c, i, b.w)));
      // Dragging by the header.
      g.addEventListener('pointerdown', e => {
        if (e.target.closest('.tbtn') || e.target.closest('.col-row.linkable')) return;
        e.stopPropagation();
        const start = { x: e.clientX, y: e.clientY, px: pos[t.name].x, py: pos[t.name].y };
        g.setPointerCapture(e.pointerId);
        g.classList.add('dragging');
        const move = ev => {
          pos[t.name] = { x: Math.round(start.px + (ev.clientX - start.x) / view.scale), y: Math.round(start.py + (ev.clientY - start.y) / view.scale) };
          g.setAttribute('transform', `translate(${pos[t.name].x} ${pos[t.name].y})`);
          redrawLinks();
        };
        const up = () => { g.classList.remove('dragging'); g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); render(); };
        g.addEventListener('pointermove', move);
        g.addEventListener('pointerup', up);
        g.addEventListener('pointercancel', up);
      });
      g.addEventListener('keydown', e => {
        if (e.target !== g) return;
        const d = e.shiftKey ? 50 : 10;
        const delta = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
        if (!delta) return;
        e.preventDefault();
        pos[t.name] = { x: pos[t.name].x + delta[0], y: pos[t.name].y + delta[1] };
        render();
      });
      return g;
    }

    function redrawLinks() {
      const g = viewport.querySelector('.links');
      clear(g);
      for (const { r, i } of visibleLinks()) g.append(drawLink(r, i));
    }

    function tableButton(x, iconName, label, key, act) {
      const g = s('g', { class: 'tbtn', transform: `translate(${x} 5)`, tabindex: '0', role: 'button', 'aria-label': label, 'data-key': key },
        s('title', null, label), s('rect', { width: 22, height: 22, rx: 5 }), s('path', { d: SS.ICON_PATHS[iconName], transform: 'translate(3 3) scale(.67)' }));
      g.addEventListener('click', e => { e.stopPropagation(); act(); });
      g.addEventListener('pointerdown', e => e.stopPropagation());
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); act(); } });
      return g;
    }

    function columnRow(t, c, i, w) {
      const y = B.header + i * B.row + 3;
      const badge = c.pk ? 'PK' : c.fk ? 'FK' : '';
      const g = s('g', { class: `col-row${editing && !c.pk ? ' linkable' : ''}`, 'data-table': t.name, 'data-col': c.name, transform: `translate(0 ${y})` },
        s('rect', { x: 2, y: 0, width: w - 4, height: B.row }),
        badge ? s('text', { class: c.pk ? 'badge-pk' : 'badge-fk', x: B.padX, y: 15 }, badge) : null,
        s('text', { x: B.padX + 26, y: 15 }, c.name),
        s('text', { class: 'ctype', x: w - B.padX, y: 15, 'text-anchor': 'end' }, c.type));
      if (editing && !c.pk) g.addEventListener('pointerdown', e => startLinkDrag(e, t, c));
      return g;
    }

    // ---- Edit Links: drag from a column to a primary key ----
    function startLinkDrag(e, t, c) {
      e.stopPropagation();
      e.preventDefault();
      const ghost = s('path', { class: 'erd-ghost' });
      viewport.append(ghost);
      const toLocal = ev => {
        const r = svg.getBoundingClientRect();
        return { x: (ev.clientX - r.left - view.tx) / view.scale, y: (ev.clientY - r.top - view.ty) / view.scale };
      };
      const b = boxOf(t);
      const startPt = { x: b.x + b.w, y: b.y + B.header + t.columns.indexOf(c) * B.row + B.row / 2 + 3 };
      let target = null;
      const move = ev => {
        const p = toLocal(ev);
        ghost.setAttribute('d', `M${startPt.x} ${startPt.y} L${p.x} ${p.y}`);
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = under && under.closest && under.closest('.col-row');
        svg.querySelectorAll('.col-row.target').forEach(el => el.classList.remove('target'));
        target = row && row.getAttribute('data-table') !== t.name ? row : null;
        if (target) target.classList.add('target');
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        ghost.remove();
        if (target) addLink(t.name, c.name, target.getAttribute('data-table'), target.getAttribute('data-col'));
        else render();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }

    // Returns a message if the link can't be made, or null if it was added.
    function addLink(fromTable, fromCol, toTable, toCol) {
      const ft = schema.tables.find(t => t.name === fromTable);
      const tt = schema.tables.find(t => t.name === toTable);
      const fc = ft && ft.columns.find(c => c.name === fromCol);
      const tc = tt && tt.columns.find(c => c.name === toCol);
      let problem = null;
      if (!fc || !tc || ft === tt) problem = 'Pick two columns in two different tables.';
      else if (!tc.pk) problem = `Drop on a primary key (PK) column. ${toTable}.${toCol} isn't one.`;
      else if (fc.type !== tc.type) problem = `${fromTable}.${fromCol} holds ${fc.type} values but ${toTable}.${toCol} holds ${tc.type} values, so they can't be linked.`;
      else if (schema.relationships.some(r => r.from.table === fromTable && r.from.column === fromCol)) problem = `${fromTable}.${fromCol} already has a link. Remove it first.`;
      if (problem) { SS.announce(problem); render(); if (!form.hidden) drawForm(problem); return problem; }
      fc.fk = { table: toTable, column: toCol };
      schema.relationships.push({ from: { table: fromTable, column: fromCol }, to: { table: toTable, column: toCol } });
      SS.announce(`Linked ${fromTable}.${fromCol} to ${toTable}.${toCol}.`);
      render();
      drawForm();
      return null;
    }

    function removeLink(i) {
      const r = schema.relationships[i];
      if (!r) return;
      const fc = schema.tables.find(t => t.name === r.from.table).columns.find(c => c.name === r.from.column);
      if (fc) fc.fk = null;
      schema.relationships.splice(i, 1);
      selected = null;
      SS.announce(`Removed the link from ${r.from.table}.${r.from.column} to ${r.to.table}.${r.to.column}.`);
      render();
      drawForm();
    }

    function resetLinks() {
      for (const t of schema.tables) for (const c of t.columns) c.fk = null;
      schema.relationships.length = 0;
      for (const r of original) {
        schema.relationships.push(JSON.parse(JSON.stringify(r)));
        const c = schema.tables.find(t => t.name === r.from.table).columns.find(x => x.name === r.from.column);
        c.fk = { table: r.to.table, column: r.to.column };
      }
      SS.announce('Links reset.');
      render();
      drawForm();
    }

    // The keyboard-friendly way to edit links.
    function drawForm(problem) {
      if (!schema) return;
      const opt = (t, c) => h('option', { value: `${t.name}\u0000${c.name}` }, `${t.name}.${c.name}`);
      const from = h('select', { 'aria-label': 'Link from (foreign key column)' }, schema.tables.flatMap(t => t.columns.filter(c => !c.pk).map(c => opt(t, c))));
      const to = h('select', { 'aria-label': 'Link to (primary key column)' }, schema.tables.flatMap(t => t.columns.filter(c => c.pk).map(c => opt(t, c))));
      const add = h('button', { type: 'button', class: 'btn', onclick: () => {
        const [ft, fc] = from.value.split('\u0000');
        const [tt, tc] = to.value.split('\u0000');
        addLink(ft, fc, tt, tc);
      } }, icon('plus'), 'Add');
      form.replaceChildren(
        h('h3', null, 'Links'),
        h('ul', null, schema.relationships.length ? schema.relationships.map((r, i) => h('li', null,
          h('span', { class: 'mono' }, `${r.from.table}.${r.from.column} → ${r.to.table}.${r.to.column}`),
          h('button', { type: 'button', class: 'btn', onclick: () => removeLink(i), 'aria-label': `Remove the link from ${r.from.table}.${r.from.column} to ${r.to.table}.${r.to.column}` }, 'Remove'))) : h('li', null, 'No links yet.')),
        h('p', { class: 'row' }, 'Add a link:', from, '→', to, add),
        problem ? h('p', { role: 'alert', class: 'added' }, problem) : null,
        h('p', null, h('button', { type: 'button', class: 'btn-link', onclick: resetLinks }, 'Reset links')));
    }

    function drawChips() {
      chips.replaceChildren(...[...hidden].map(name => h('span', { class: 'chip' }, `Hidden: ${name}`,
        iconButton('x', `Show the ${name} table`, { onclick: () => { hidden.delete(name); render(); SS.announce(`${name} is back.`); } }))));
    }

    // ---- pan, wheel zoom, pinch ----
    const pointers = new Map();
    let pinch = null;
    svg.addEventListener('pointerdown', e => {
      if (e.target.closest('.erd-table') || e.target.closest('.erd-link')) return;
      if (editing) { selected = null; render(); }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      svg.setPointerCapture(e.pointerId);
      canvas.classList.add('panning');
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const r = svg.getBoundingClientRect();
        zoomAt(pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (pointers.size === 1) {
        view.tx += e.clientX - prev.x;
        view.ty += e.clientY - prev.y;
        applyView();
      }
    });
    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) canvas.classList.remove('panning');
    };
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls the page as usual.
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(view.scale * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // ---- PNG ----
    const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-weight', 'opacity'];
    async function copyPng() {
      if (!schema) return;
      const ts = visibleTables();
      if (!ts.length) return;
      const boxes = ts.map(boxOf);
      const pad = 30;
      const minX = Math.min(...boxes.map(b => b.x)) - pad;
      const minY = Math.min(...boxes.map(b => b.y)) - pad;
      const w = Math.max(...boxes.map(b => b.x + b.w)) + pad - minX;
      const hgt = Math.max(...boxes.map(b => b.y + b.h)) + pad - minY;
      const clone = svg.cloneNode(true);
      // Copy computed colors and fonts so the picture matches the screen (and the current theme).
      const src = svg.querySelectorAll('*');
      const dst = clone.querySelectorAll('*');
      src.forEach((el, i) => {
        const cs = getComputedStyle(el);
        dst[i].setAttribute('style', STYLE_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';'));
      });
      clone.querySelector('.viewport').removeAttribute('transform');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', `${minX} ${minY} ${w} ${hgt}`);
      clone.setAttribute('width', String(w * 2));
      clone.setAttribute('height', String(hgt * 2));
      const bg = getComputedStyle(canvas).backgroundColor;
      clone.insertBefore(s('rect', { x: minX, y: minY, width: w, height: hgt, fill: bg }), clone.firstChild);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      try {
        const img = new Image();
        await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
        const cv = document.createElement('canvas');
        cv.width = w * 2;
        cv.height = hgt * 2;
        cv.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
        try {
          await root.navigator.clipboard.write([new root.ClipboardItem({ 'image/png': blob })]);
          SS.announce('Copied the diagram as a picture. Paste it anywhere.');
        } catch (e) {
          SS.downloadBlob(`erd-${schema.id}.png`, blob);
          SS.announce(`Your browser would not copy pictures, so we saved erd-${schema.id}.png instead.`);
        }
      } catch (e) {
        SS.announce('Sorry, the picture could not be made in this browser.');
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (root.ResizeObserver) new root.ResizeObserver(() => { if (schema && !panel.el.classList.contains('collapsed')) applyView(); }).observe(canvas);

    return { setSchema, tidy, fit, counts, addLink, removeLink };
  }

  root.SS = Object.assign(SS, { createErd });
})(this);
