// ERD Playground: draws a parsed model (notation.js) as a crow's foot diagram, using SQL Studio's shared
// geometry (erd-model.js) and canvas (canvas.js). Entities can be dragged; positions survive redraws.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, s, clear, icon, iconButton } = SS;
  const B = SS.BOX;

  const isMany = end => end === 'one-many' || end === 'zero-many';

  // callbacks:
  //   onShowRelationship(i)  hover or focus on a relationship: show its readings
  //   onPickRelationship(i)  click or Enter on a relationship: also move the editor cursor to it
  //   onHoverEnd(i, 'a'|'b'|null)  pointer over one line end (null when it leaves)
  function createDiagram(panel, { prefs, save, readingsOf, onShowRelationship, onPickRelationship, onHoverEnd }) {
    const zoomOut = h('output', { 'aria-live': 'off' });
    panel.tools.append(
      h('span', { class: 'zoom', role: 'group', 'aria-label': 'Diagram zoom' },
        iconButton('minus', 'Zoom out', { onclick: () => zoomBy(-1) }), zoomOut, iconButton('plus', 'Zoom in', { onclick: () => zoomBy(1) })),
      h('button', { type: 'button', class: 'btn', title: 'Lay out the diagram neatly', onclick: () => { tidy(); SS.announce('Diagram tidied.'); } }, icon('tidy'), 'Tidy'),
      h('button', { type: 'button', class: 'btn', title: 'Copy the diagram as a picture', onclick: () => copyPng() }, icon('image'), 'PNG'));

    const cv = SS.createCanvas(panel.body, {
      label: 'ER diagram',
      getPreferredScale: () => prefs.diagramZoom / 100,
      onScale: sc => { prefs.diagramZoom = Math.round(sc * 100); save(); },
      onView: v => { zoomOut.textContent = `${Math.round(v.scale * 100)}%`; },
      canPan: t => !t.closest('.erd-table') && !t.closest('.erd-link'),
    });
    const { viewport, canvas, view } = cv;

    let model = null;
    let tables = [];
    const pos = new Map(); // entity name -> { x, y }
    let highlighted = { index: null, end: null };

    // The model as a schema that erd-model.js understands. For layering, the entity at a "many" end is the child.
    function toSchema(m) {
      const ts = m.entities.map(e => ({
        name: e.name,
        display: e.display,
        columns: e.attributes.map(a => ({ name: a.name, type: a.type, pk: a.keys.includes('PK'), fk: a.keys.includes('FK') ? {} : null })),
      }));
      const relationships = m.relationships.filter(r => r.a !== r.b).map(r => {
        const aIsChild = isMany(r.aEnd) && !isMany(r.bEnd);
        const child = aIsChild ? r.a : r.b;
        const parent = aIsChild ? r.b : r.a;
        return { from: { table: child, column: '' }, to: { table: parent, column: '' } };
      });
      return { tables: ts, relationships };
    }
    const sizeOf = t => SS.boxSize({ name: t.display, columns: t.columns }, { showColumns: t.columns.length > 0 });
    const boxOf = t => ({ ...pos.get(t.name), ...sizeOf(t) });
    const boundsOf = boxes => ({ minX: Math.min(...boxes.map(b => b.x)), minY: Math.min(...boxes.map(b => b.y)), maxX: Math.max(...boxes.map(b => b.x + b.w)), maxY: Math.max(...boxes.map(b => b.y + b.h)) });

    function zoomBy(dir) {
      cv.zoomBy(dir);
      SS.announce(`Diagram zoom ${Math.round(view.scale * 100)}%`);
    }
    // Everything drawn (boxes, loops, labels), so fit and PNG never cut anything off.
    function drawnBounds() {
      const b = viewport.getBBox();
      return b.width ? { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height } : boundsOf(tables.map(boxOf));
    }
    function fit() { if (tables.length) cv.fitTo(drawnBounds()); }

    // Draws `m`. New entities are placed by the tidy layout; entities that were moved stay where they are.
    function render(m) {
      model = m;
      const schema = toSchema(m);
      tables = schema.tables;
      const names = new Set(tables.map(t => t.name));
      for (const n of [...pos.keys()]) if (!names.has(n)) pos.delete(n);
      const first = pos.size === 0;
      if (tables.some(t => !pos.has(t.name))) {
        const tidyPos = SS.tidyLayout({ tables: tables.map(t => ({ name: t.name, columns: t.columns })), relationships: schema.relationships }, { showColumns: true });
        // A new entity takes its tidy spot, moved down if an entity the student kept is already there.
        const kept = tables.filter(t => pos.has(t.name));
        for (const t of tables) {
          if (pos.has(t.name)) continue;
          const keptBoxes = kept.map(boxOf);
          pos.set(t.name, SS.placeClear(tidyPos[t.name], sizeOf(t), keptBoxes));
          kept.push(t);
        }
      }
      draw();
      if (first) fit();
    }

    function draw() {
      const focusKey = document.activeElement && canvas.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
      clear(viewport);
      const links = s('g', { class: 'links' });
      const boxes = s('g', { class: 'tables' });
      viewport.append(links, boxes);
      if (!model) return;
      // Relationships between the same two entities get separate lanes, centered on the usual line.
      const pairCount = new Map();
      const pairKey = r => [r.a, r.b].sort().join('\u0000');
      model.relationships.forEach(r => pairCount.set(pairKey(r), (pairCount.get(pairKey(r)) || 0) + 1));
      const seen = new Map();
      model.relationships.forEach((r, i) => {
        const k = pairKey(r);
        const nth = seen.get(k) || 0;
        seen.set(k, nth + 1);
        // Self-links stack outward (0, 1, …); other repeated pairs get lanes centered on the usual line.
        links.append(drawLink(r, i, r.a === r.b ? nth : nth - (pairCount.get(k) - 1) / 2));
      });
      for (const t of tables) boxes.append(drawTable(t));
      applyHighlight();
      if (focusKey) { const el = canvas.querySelector(`[data-key="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
    }

    function drawLink(r, i, lane) {
      const ta = tables.find(t => t.name === r.a);
      const tb = tables.find(t => t.name === r.b);
      let points;
      let sideA;
      let sideB;
      if (r.a === r.b) {
        const loop = SS.selfLoopRoute(boxOf(ta), lane);
        points = loop.points;
        sideA = sideB = loop.side;
      } else {
        const route = SS.linkRoute(boxOf(ta), ta, '', boxOf(tb), tb, '', false, false, lane);
        points = route.points;
        sideA = route.fromSide;
        sideB = route.toSide;
      }
      const d = SS.pathData(points);
      const endGroup = (which, p, side, kind) => {
        const mark = SS.crowFoot(p, side, kind);
        const g = s('g', { class: 'end', 'data-end': which },
          mark.lines.map(([x1, y1, x2, y2]) => s('line', { x1, y1, x2, y2 })),
          mark.circle ? s('circle', { cx: mark.circle.cx, cy: mark.circle.cy, r: mark.circle.r }) : null,
          s('rect', { class: 'end-hit', x: Math.min(p.x, p.x + (side === 'right' ? 26 : -26)), y: p.y - 10, width: 26, height: 20 }));
        g.addEventListener('pointerenter', () => onHoverEnd(i, which));
        g.addEventListener('pointerleave', () => onHoverEnd(i, null));
        return g;
      };
      const readings = readingsOf(i).map(t => t.replace(/\*\*/g, '')); // plain text for the tooltip and screen readers
      // A self-loop's label sits just right of its loop, stacked by loop number so two loops' labels never collide.
      const labelAt = r.a === r.b
        ? { x: points[1].x + labelWidth(r.label) / 2 + 6, y: (points[1].y + points[2].y) / 2 + 22 * lane }
        : SS.labelPoint(points);
      const label = r.label ? drawLabel(r.label, labelAt) : null;
      const g = s('g', { class: 'erd-link', 'data-index': String(i), 'data-key': `rel:${i}`, tabindex: '0', role: 'button', 'aria-label': readings.join(' ') },
        s('title', null, readings.join('\n')),
        s('path', { class: 'hit', d }),
        s('path', { class: `line${r.dashed ? ' dashed' : ''}`, d }),
        endGroup('a', points[0], sideA, r.aEnd),
        endGroup('b', points[points.length - 1], sideB, r.bEnd),
        label);
      g.addEventListener('pointerenter', () => onShowRelationship(i));
      g.addEventListener('focus', () => onShowRelationship(i));
      g.addEventListener('click', () => onPickRelationship(i));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickRelationship(i); } });
      return g;
    }

    const labelWidth = text => Math.ceil(text.length * 6.6) + 10;
    function drawLabel(text, p) {
      const w = labelWidth(text);
      return s('g', { class: 'link-label', transform: `translate(${p.x} ${p.y})` },
        s('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 4 }),
        s('text', { x: 0, y: 4, 'text-anchor': 'middle' }, text));
    }

    function drawTable(t) {
      const b = boxOf(t);
      const cols = t.columns.length > 0;
      const g = s('g', { class: 'erd-table', transform: `translate(${b.x} ${b.y})`, tabindex: '0', role: 'group', 'data-key': `table:${t.name}`,
        'aria-label': `${t.display} entity${cols ? `, ${t.columns.length} attributes` : ''}. Arrow keys move it.` });
      g.append(s('rect', { class: 'box', width: b.w, height: b.h, rx: 10 }));
      g.append(s('rect', { class: 'head', x: 1, y: 1, width: b.w - 2, height: B.header - 2, rx: 9 }));
      g.append(s('text', { class: 'tname', x: B.padX, y: 22 }, t.display));
      t.columns.forEach((c, k) => {
        const y = B.header + k * B.row + 3;
        const badge = c.pk ? 'PK' : c.fk ? 'FK' : '';
        g.append(s('g', { class: 'col-row', transform: `translate(0 ${y})` },
          s('rect', { x: 2, y: 0, width: b.w - 4, height: B.row }),
          badge ? s('text', { class: c.pk ? 'badge-pk' : 'badge-fk', x: B.padX, y: 15 }, badge) : null,
          s('text', { x: B.padX + 26, y: 15 }, c.name),
          s('text', { class: 'ctype', x: b.w - B.padX, y: 15, 'text-anchor': 'end' }, c.type)));
      });
      g.addEventListener('pointerdown', e => {
        e.stopPropagation();
        const start = { x: e.clientX, y: e.clientY, px: pos.get(t.name).x, py: pos.get(t.name).y };
        g.setPointerCapture(e.pointerId);
        g.classList.add('dragging');
        const move = ev => {
          pos.set(t.name, { x: Math.round(start.px + (ev.clientX - start.x) / view.scale), y: Math.round(start.py + (ev.clientY - start.y) / view.scale) });
          g.setAttribute('transform', `translate(${pos.get(t.name).x} ${pos.get(t.name).y})`);
        };
        const up = () => { g.classList.remove('dragging'); g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); draw(); };
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
        const p = pos.get(t.name);
        pos.set(t.name, { x: p.x + delta[0], y: p.y + delta[1] });
        draw();
      });
      return g;
    }

    function applyHighlight() {
      canvas.querySelectorAll('.erd-link').forEach(el => {
        const on = Number(el.getAttribute('data-index')) === highlighted.index;
        el.classList.toggle('selected', on);
        el.querySelectorAll('.end').forEach(e => e.classList.toggle('end-on', on && e.getAttribute('data-end') === highlighted.end));
      });
    }
    // index: a relationship to emphasize (or null); end: also emphasize that end ('a' or 'b').
    function highlight(index, end = null) {
      highlighted = { index, end };
      applyHighlight();
    }

    function tidy() {
      if (!model) return;
      pos.clear();
      render(model);
      fit();
    }

    async function copyPng() {
      if (!tables.length) return;
      const how = await cv.copyPng('erd-playground.png', drawnBounds());
      if (how === 'copied') SS.announce('Copied the diagram as a picture. Paste it anywhere.');
      else if (how === 'downloaded') SS.announce('Your browser would not copy pictures, so we saved erd-playground.png instead.');
      else SS.announce('Sorry, the picture could not be made in this browser.');
    }

    const setStale = on => canvas.classList.toggle('stale', on);

    return { render, setStale, highlight, tidy, fit, copyPng };
  }

  root.SS = Object.assign(SS, { createDiagram });
})(this);
