// SQL Studio: ERD geometry (box sizes, tidy layout, link routes, crow's foot ends). Pure; erd.js draws it.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const BOX = { header: 34, row: 22, padX: 12, minWidth: 170, charWidth: 7.6, gapX: 110, gapY: 36, margin: 40 };

  // Width fits the longest "name  type  PK" line; height depends on whether columns are shown.
  function boxSize(table, { showColumns = true } = {}) {
    const longest = Math.max(table.name.length + 4, ...table.columns.map(c => c.name.length + c.type.length + 6));
    const w = Math.max(BOX.minWidth, Math.ceil(longest * BOX.charWidth + 2 * BOX.padX + 24));
    const h = BOX.header + (showColumns ? table.columns.length * BOX.row + 6 : 0);
    return { w, h };
  }

  // Layer 0 = tables that reference nothing; each table sits one layer right of the deepest table it references.
  function layers(schema, hidden = new Set()) {
    const visible = schema.tables.filter(t => !hidden.has(t.name));
    const parents = name => schema.relationships.filter(r => r.from.table === name && r.to.table !== name && !hidden.has(r.to.table)).map(r => r.to.table);
    const memo = new Map();
    const depth = (name, path) => {
      if (memo.has(name)) return memo.get(name);
      if (path.has(name)) return 0; // cycle
      path.add(name);
      const ps = parents(name);
      const d = ps.length ? 1 + Math.max(...ps.map(p => depth(p, path))) : 0;
      path.delete(name);
      memo.set(name, d);
      return d;
    };
    const out = [];
    visible.forEach(t => { const d = depth(t.name, new Set()); (out[d] = out[d] || []).push(t); });
    return out.filter(Boolean);
  }

  // Returns { [tableName]: { x, y } } (top-left corners).
  function tidyLayout(schema, { showColumns = true, hidden = new Set() } = {}) {
    const cols = layers(schema, hidden);
    const sizes = new Map(schema.tables.map(t => [t.name, boxSize(t, { showColumns })]));
    const colHeight = col => col.reduce((s, t) => s + sizes.get(t.name).h, 0) + BOX.gapY * (col.length - 1);
    const tallest = Math.max(...cols.map(colHeight));
    const pos = {};
    let x = BOX.margin;
    for (const col of cols) {
      let y = BOX.margin + (tallest - colHeight(col)) / 2;
      const w = Math.max(...col.map(t => sizes.get(t.name).w));
      for (const t of col) {
        pos[t.name] = { x: Math.round(x), y: Math.round(y) };
        y += sizes.get(t.name).h + BOX.gapY;
      }
      x += w + BOX.gapX;
    }
    return pos;
  }

  // Where a link meets a box: the column's row (or the header when columns are hidden), on the left or right edge.
  function anchor(box, table, columnName, side, showColumns) {
    const i = table.columns.findIndex(c => c.name === columnName);
    const y = showColumns && i !== -1 ? box.y + BOX.header + i * BOX.row + BOX.row / 2 + 3 : box.y + BOX.header / 2;
    return { x: side === 'right' ? box.x + box.w : box.x, y, side };
  }

  // An orthogonal route from the FK row (many side) to the PK row (one side).
  // boxes: { x, y, w, h } for each end. showFrom/showTo: whether each table shows its columns.
  // Returns { points: [{x,y}...], fromSide, toSide }.
  function linkRoute(fromBox, fromTable, fromCol, toBox, toTable, toCol, showFrom = true, showTo = showFrom) {
    const fromCenter = fromBox.x + fromBox.w / 2;
    const toCenter = toBox.x + toBox.w / 2;
    const overlapX = fromBox.x < toBox.x + toBox.w && toBox.x < fromBox.x + fromBox.w;
    let fromSide;
    let toSide;
    if (overlapX) { fromSide = 'right'; toSide = 'right'; } else if (fromCenter < toCenter) { fromSide = 'right'; toSide = 'left'; } else { fromSide = 'left'; toSide = 'right'; }
    const a = anchor(fromBox, fromTable, fromCol, fromSide, showFrom);
    const b = anchor(toBox, toTable, toCol, toSide, showTo);
    const out = 28;
    const ax = a.x + (fromSide === 'right' ? out : -out);
    const bx = b.x + (toSide === 'right' ? out : -out);
    let points;
    if (fromSide === toSide) {
      const x = Math.max(ax, bx);
      points = [a, { x, y: a.y }, { x, y: b.y }, b];
    } else {
      const midX = Math.round((ax + bx) / 2);
      points = [a, { x: ax, y: a.y }, { x: midX, y: a.y }, { x: midX, y: b.y }, { x: bx, y: b.y }, b];
    }
    return { points: points.map(p => ({ x: p.x, y: p.y })), fromSide, toSide };
  }

  // Crow's foot marks at a line end. `p` is the point on the box edge; `side` is the edge it leaves from.
  // kind 'one' draws || (exactly one); kind 'many' draws o{ (zero or more).
  function crowFoot(p, side, kind) {
    const dir = side === 'right' ? 1 : -1;
    const at = d => p.x + dir * d;
    if (kind === 'one') {
      return { lines: [[at(8), p.y - 7, at(8), p.y + 7], [at(13), p.y - 7, at(13), p.y + 7]], circle: null };
    }
    return {
      lines: [[p.x, p.y - 7, at(12), p.y], [p.x, p.y + 7, at(12), p.y], [p.x, p.y, at(12), p.y]],
      circle: { cx: at(18), cy: p.y, r: 4.5 },
    };
  }

  const pathData = points => points.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');

  const api = { BOX, boxSize, layers, tidyLayout, linkRoute, crowFoot, pathData };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
