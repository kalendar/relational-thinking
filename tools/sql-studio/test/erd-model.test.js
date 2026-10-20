const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/erd-model.js');
const S = require('../src/schema.js');
const { loadAllDatasets } = require('./helpers.js');

const schemas = loadAllDatasets().map(S.buildSchema);
const boxesFor = (schema, pos, showColumns = true) => Object.fromEntries(schema.tables.map(t => [t.name, { ...pos[t.name], ...M.boxSize(t, { showColumns }) }]));
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('tidy puts every referenced (parent) table left of the table that references it', () => {
  for (const s of schemas) {
    const pos = M.tidyLayout(s);
    for (const r of s.relationships) assert.ok(pos[r.to.table].x < pos[r.from.table].x, `${s.id}: ${r.to.table} left of ${r.from.table}`);
  }
});

test('tidy boxes never overlap, with or without columns', () => {
  for (const s of schemas) for (const showColumns of [true, false]) {
    const boxes = Object.values(boxesFor(s, M.tidyLayout(s, { showColumns }), showColumns));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), s.id);
  }
});

test('hidden tables get no position', () => {
  const s = schemas.find(x => x.id === 'spotify');
  const pos = M.tidyLayout(s, { hidden: new Set(['Songs']) });
  assert.deepEqual(Object.keys(pos).sort(), ['Artists', 'Streams']);
});

test('a cycle of references does not hang', () => {
  const t = (name, ref) => ({ name, columns: [{ name: 'id', type: 'number', pk: true }, { name: 'o', type: 'number', fk: { table: ref, column: 'id' } }], rows: [] });
  const s = { tables: [t('A', 'B'), t('B', 'A')], relationships: [{ from: { table: 'A', column: 'o' }, to: { table: 'B', column: 'id' } }, { from: { table: 'B', column: 'o' }, to: { table: 'A', column: 'id' } }] };
  assert.equal(Object.keys(M.tidyLayout(s)).length, 2);
});

test('link routes start at the FK row, end at the PK row, and only move straight', () => {
  const s = schemas.find(x => x.id === 'spotify');
  const boxes = boxesFor(s, M.tidyLayout(s));
  const songs = s.tables.find(t => t.name === 'Songs');
  const artists = s.tables.find(t => t.name === 'Artists');
  const r = M.linkRoute(boxes.Songs, songs, 'artist_id', boxes.Artists, artists, 'artist_id');
  const first = r.points[0];
  const last = r.points[r.points.length - 1];
  assert.equal(r.fromSide, 'left');
  assert.equal(first.x, boxes.Songs.x);
  assert.equal(last.x, boxes.Artists.x + boxes.Artists.w);
  assert.equal(first.y, boxes.Songs.y + M.BOX.header + 2 * M.BOX.row + M.BOX.row / 2 + 3);
  for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1];
    const b = r.points[i];
    assert.ok(a.x === b.x || a.y === b.y, 'orthogonal');
  }
});

test("crow's foot: one end has two bars, many end has three prongs and a circle", () => {
  const one = M.crowFoot({ x: 100, y: 50 }, 'right', 'one');
  assert.equal(one.lines.length, 2);
  assert.equal(one.circle, null);
  const many = M.crowFoot({ x: 100, y: 50 }, 'left', 'many');
  assert.equal(many.lines.length, 3);
  assert.ok(many.circle.cx < 100);
  assert.equal(M.pathData([{ x: 1, y: 2 }, { x: 3, y: 2 }]), 'M1 2 L3 2');
});

test('fitView keeps the preferred zoom when the diagram fits, and zooms out (not below 30%) when it does not', () => {
  const bounds = { minX: 40, minY: 40, maxX: 1100, maxY: 300 };
  const wide = M.fitView(bounds, { width: 1366, height: 340 }, 1);
  assert.equal(wide.scale, 1);
  assert.equal(Math.round(wide.tx + 40 * wide.scale + (1060 * wide.scale) / 2), 683, 'centered horizontally');
  const narrow = M.fitView(bounds, { width: 800, height: 340 }, 1);
  assert.ok(narrow.scale < 1);
  assert.ok(narrow.tx + bounds.minX * narrow.scale >= 0, 'left edge visible');
  assert.ok(narrow.tx + bounds.maxX * narrow.scale <= 800, 'right edge visible');
  assert.equal(M.fitView(bounds, { width: 100, height: 340 }, 1).scale, 0.3);
  assert.equal(M.fitView(bounds, { width: 0, height: 0 }, 1.2).scale, 1.2, 'hidden canvas keeps the zoom');
});

test('no link skips over a column of tables (a parent sits just left of its nearest child)', () => {
  for (const s of schemas) {
    const pos = M.tidyLayout(s);
    const cols = [...new Set(Object.values(pos).map(p => p.x))].sort((a, b) => a - b);
    for (const r of s.relationships) {
      const gap = cols.indexOf(pos[r.from.table].x) - cols.indexOf(pos[r.to.table].x);
      assert.equal(gap, 1, `${s.id}: ${r.to.table} → ${r.from.table} spans ${gap} columns`);
    }
  }
});

// ---- all four crow's foot ends, lanes, self-loops, label points (shared with the ERD Playground) ----

test("crow's foot: each of the four ends has the right marks", () => {
  const p = { x: 100, y: 50 };
  const one = M.crowFoot(p, 'right', 'one');
  assert.equal(one.lines.length, 2);
  assert.equal(one.circle, null);
  const zeroOne = M.crowFoot(p, 'right', 'zero-one');
  assert.equal(zeroOne.lines.length, 1, 'one bar');
  assert.ok(zeroOne.circle && zeroOne.circle.cx > zeroOne.lines[0][0], 'the circle sits further out than the bar');
  const oneMany = M.crowFoot(p, 'right', 'one-many');
  assert.equal(oneMany.lines.length, 4, 'three prongs and a bar');
  assert.equal(oneMany.circle, null);
  const zeroMany = M.crowFoot(p, 'right', 'zero-many');
  assert.equal(zeroMany.lines.length, 3);
  assert.ok(zeroMany.circle);
  assert.deepEqual(M.crowFoot(p, 'left', 'many'), M.crowFoot(p, 'left', 'zero-many'), "'many' stays an alias for SQL Studio");
});

test('lanes move a link down 14px at both ends and keep it orthogonal', () => {
  const t = (name, x) => ({ table: { name, columns: [] }, box: { x, y: 0, w: 100, h: 34 } });
  const A = t('A', 0);
  const B = t('B', 300);
  const r0 = M.linkRoute(A.box, A.table, 'x', B.box, B.table, 'y', false, false, 0);
  const r1 = M.linkRoute(A.box, A.table, 'x', B.box, B.table, 'y', false, false, 1);
  assert.equal(r1.points[0].y, r0.points[0].y + 14);
  assert.equal(r1.points[r1.points.length - 1].y, r0.points[r0.points.length - 1].y + 14);
  for (let i = 1; i < r1.points.length; i++) {
    const a = r1.points[i - 1];
    const b = r1.points[i];
    assert.ok(a.x === b.x || a.y === b.y);
  }
});

test('a self-loop leaves and returns on the right edge, outside the box', () => {
  const r = M.selfLoopRoute({ x: 0, y: 0, w: 100, h: 60 });
  const first = r.points[0];
  const last = r.points[r.points.length - 1];
  assert.equal(r.side, 'right');
  assert.equal(first.x, 100);
  assert.equal(last.x, 100);
  assert.notEqual(first.y, last.y);
  for (const p of [first, last]) assert.ok(p.y > 0 && p.y < 60);
  for (const p of r.points.slice(1, -1)) assert.ok(p.x > 100);
  for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i - 1].x === r.points[i].x || r.points[i - 1].y === r.points[i].y);
});

test('labelPoint is the middle of the longest segment', () => {
  assert.deepEqual(M.labelPoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }]), { x: 50, y: 0 });
});

test('labelPoint treats a straight run of short pieces as one segment', () => {
  const straight = [{ x: 0, y: 0 }, { x: 28, y: 0 }, { x: 55, y: 0 }, { x: 55, y: 0 }, { x: 82, y: 0 }, { x: 110, y: 0 }];
  assert.deepEqual(M.labelPoint(straight), { x: 55, y: 0 });
});
