// ERD Playground: starts the page and ties the notation, the diagram, and the readings together.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon } = SS;

  const storage = () => { try { return root.localStorage; } catch (e) { return null; } };
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const PARSE_DELAY = 300;

  // "**bold**" → <strong>; `code` → <code>; everything else is text.
  function richText(str) {
    const out = [];
    const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(m[1] !== undefined ? h('strong', null, m[1]) : h('code', null, m[2]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }

  // A tiny drawing of one line end, for the cheat sheet.
  function endSample(kind) {
    const p = { x: 70, y: 12 };
    const mark = SS.crowFoot(p, 'left', kind);
    return SS.s('svg', { class: 'end-sample', viewBox: '0 0 90 24', width: '90', height: '24', 'aria-hidden': 'true' },
      SS.s('line', { x1: 0, y1: 12, x2: 70, y2: 12 }),
      SS.s('rect', { x: 70, y: 2, width: 18, height: 20, rx: 3 }),
      mark.lines.map(([x1, y1, x2, y2]) => SS.s('line', { x1, y1, x2, y2 })),
      mark.circle ? SS.s('circle', { cx: mark.circle.cx, cy: mark.circle.cy, r: mark.circle.r }) : null);
  }

  function cheatSheet(prefs, save) {
    const rows = [['||', 'one', 'one and only one (exactly one)'], ['o|', 'zero-one', 'zero or one'], ['|{', 'one-many', 'one or more'], ['o{', 'zero-many', 'zero or more']];
    const d = h('details', { class: 'cheat', open: prefs.cheatSheetOpen },
      h('summary', null, 'Symbol cheat sheet'),
      h('p', { class: 'cheat-note' }, 'Each end of a line shows how many of that entity can be connected. On the left side the symbols are mirrored: ', h('code', null, '|o'), ', ', h('code', null, '}|'), ', ', h('code', null, '}o'), '.'),
      h('table', { class: 'cheat-table' },
        h('caption', { class: 'sr-only' }, 'Line ends and what they mean'),
        h('tbody', null, rows.map(([sym, kind, words]) => h('tr', null, h('td', null, h('code', null, sym)), h('td', null, endSample(kind)), h('td', null, words))))),
      h('p', { class: 'cheat-note' }, 'Common patterns:'),
      h('ul', { class: 'cheat-list' },
        [['A ||--|| B', 'one-to-one, both mandatory'], ['A ||--o| B', 'one-to-one, B is optional'], ['A ||--o{ B', 'one-to-many: zero or more B for each A'],
          ['A ||--|{ B', 'one-to-many: one or more B for each A'], ['A }o--o{ B', 'many-to-many (usually through a junction table)']]
          .map(([c, t]) => h('li', null, h('code', null, c), ` ${t}`))));
    d.addEventListener('toggle', () => { prefs.cheatSheetOpen = d.open; save(); });
    return d;
  }

  function boot() {
    const appEl = document.getElementById('app');
    appEl.classList.remove('booting');
    appEl.replaceChildren();
    const prefs = SS.loadPrefs(storage());
    let saveTimer = null;
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => SS.savePrefs(storage(), prefs), 250); };

    // ---- header ----
    const sub = h('p', { class: 'sub' });
    const picker = h('select', { id: 'ex-picker', class: 'picker' }, SS.EXAMPLES.map(e => h('option', { value: e.id }, e.title)));
    const resetBtn = h('button', { type: 'button', class: 'btn', onclick: resetExample }, 'Reset example');
    const desc = h('p', { class: 'picker-desc' });
    const header = h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, icon('grid')), h('div', null, h('h1', null, 'ERD Playground'), sub)),
      h('div', { class: 'picker-wrap' }, h('div', { class: 'picker-row' }, h('label', { for: 'ex-picker' }, 'Example'), picker, resetBtn), desc));

    // ---- panels ----
    const onToggle = () => { applySizes(); editor.refresh(); diagram.fit(); };
    const notation = SS.makePanel({ key: 'notation', title: 'Notation', iconName: 'link', cls: 'notation-panel', zoomable: true, prefs, save, onToggle });
    const diagramPanel = SS.makePanel({ key: 'diagram', title: 'Diagram', iconName: 'grid', cls: 'diagram-panel erd-panel', prefs, save, onToggle });
    const copyBtn = SS.iconButton('copy', 'Copy the notation', { onclick: async () => SS.announce((await SS.copyText(editor.getText())) === 'copied' ? 'Notation copied.' : 'Your browser would not let us copy.') });
    notation.tools.prepend(copyBtn);
    const host = h('div', { class: 'editor-host' });
    const status = h('p', { class: 'status', role: 'status' });
    notation.body.append(host, cheatSheet(prefs, save), status);
    const reading = h('div', { class: 'reading' });
    const row = h('div', { class: 'pg-row' });
    const D = SS.DEFAULT_PREFS;
    const vSplit = SS.splitter({
      orientation: 'vertical', label: 'Resize Notation and Diagram', controls: `${notation.body.id} ${diagramPanel.body.id}`,
      get: () => prefs.notationWidth * 100, set: v => { prefs.notationWidth = v / 100; applySizes(); save(); },
      min: 20, max: 80, step: 2, toValue: dx => (dx / Math.max(1, row.clientWidth)) * 100,
      reset: () => { prefs.notationWidth = D.notationWidth; applySizes(); save(); }, format: v => `Notation panel ${Math.round(v)}% wide`,
    });
    const hSplit = SS.splitter({
      orientation: 'horizontal', label: 'Resize the panels’ height', controls: `${notation.body.id} ${diagramPanel.body.id}`,
      get: () => prefs.height, set: v => { prefs.height = v; applySizes(); save(); },
      min: 320, max: 2000, step: 20, toValue: dy => dy,
      reset: () => { prefs.height = D.height; applySizes(); save(); }, format: v => `${Math.round(v)} pixels tall`,
    });
    row.append(notation.el, vSplit.el, diagramPanel.el);
    appEl.append(h('div', { class: 'app' }, header, row, hSplit.el,
      h('p', { class: 'footnote' }, 'Crow’s foot notation from Chapter 6. It works in Mermaid and in AI tools, too.')));

    function applySizes() {
      const c = prefs.collapsed;
      const w = prefs.notationWidth;
      row.style.gridTemplateColumns = c.notation && c.diagram ? 'auto 10px auto'
        : c.notation ? 'auto 10px minmax(0,1fr)' : c.diagram ? 'minmax(0,1fr) 10px auto' : `minmax(0,${w}fr) 10px minmax(0,${(1 - w).toFixed(3)}fr)`;
      row.style.height = `${prefs.height}px`;
      vSplit.el.hidden = c.notation || c.diagram;
      vSplit.sync();
      hSplit.sync();
    }

    // ---- editor, diagram, readings ----
    let model = null; // the last model that parsed without errors
    let current = null; // the latest parse, errors and all
    let exampleId = SS.EXAMPLES[0].id;
    let parseTimer = null;
    let activeRel = null;
    const displayOf = name => { const e = model && model.entities.find(x => x.name === name); return e ? e.display : name; };
    const readingsOf = i => SS.readRelationship(model.relationships[i], displayOf);

    const editor = SS.createNotationEditor(host, { onChange: () => { clearTimeout(parseTimer); parseTimer = setTimeout(update, PARSE_DELAY); } });
    const diagram = SS.createDiagram(diagramPanel, {
      prefs, save, readingsOf,
      onShowRelationship: i => showReading(i),
      onPickRelationship: i => { showReading(i); editor.setCursorLine(model.relationships[i].line); },
      onHoverEnd: (i, which) => editor.markSymbol(which ? model.relationships[i][which === 'a' ? 'aSym' : 'bSym'] : null),
    });
    diagramPanel.body.append(reading);

    function showReading(i) {
      activeRel = i;
      if (i === null || !model || !model.relationships[i]) {
        reading.replaceChildren(h('span', { class: 'reading-hint' }, 'Hover over or click a line to read it both ways.'));
        diagram.highlight(null);
        return;
      }
      const r = model.relationships[i];
      const [one, two] = readingsOf(i);
      reading.replaceChildren(
        h('p', { class: 'reading-line' }, richText(one)),
        h('p', { class: 'reading-line' }, richText(two)),
        r.label ? h('p', { class: 'reading-label' }, 'Label: ', h('em', null, r.label)) : null);
    }

    let lastCounts = '';
    function update() {
      current = SS.parseErd(editor.getText());
      if (current.errors.length) {
        const e = current.errors[0];
        diagram.setStale(true);
        editor.markError(e);
        status.className = 'status err';
        status.replaceChildren(icon('info'), ' ', richText(e.message));
        return;
      }
      model = current;
      editor.markError(null);
      diagram.setStale(false);
      diagram.render(model);
      status.className = 'status ok';
      status.replaceChildren(h('span', null, '✓ Diagram is up to date'), ...model.notes.map(n => h('span', { class: 'note' }, richText(n))));
      const counts = `${count(model.entities.length, 'entity', 'entities')} · ${count(model.relationships.length, 'relationship', 'relationships')}`;
      sub.textContent = counts;
      if (counts !== lastCounts) { SS.announce(counts.replace(' · ', ', ') + '.'); lastCounts = counts; }
      syncCursor();
    }

    // The cursor's line picks a relationship; the cursor inside an end symbol emphasizes that end.
    let cursor = { line: 1, col: 1 };
    function syncCursor() {
      if (!model) return;
      const i = model.relationships.findIndex(r => r.line === cursor.line);
      editor.highlightLine(i === -1 ? null : cursor.line);
      if (i === -1) { diagram.highlight(null); if (activeRel !== null) showReading(null); return; }
      const r = model.relationships[i];
      const inside = sp => cursor.col >= sp.col && cursor.col <= sp.col + sp.length;
      diagram.highlight(i, inside(r.aSym) ? 'a' : inside(r.bSym) ? 'b' : null);
      showReading(i);
    }
    editor.onCursorLine((line, col) => { cursor = { line, col }; if (current && !current.errors.length) syncCursor(); });

    // ---- examples ----
    const exampleOf = id => SS.EXAMPLES.find(e => e.id === id);
    const changed = () => editor.getText() !== exampleOf(exampleId).text;
    function loadExample(id) {
      exampleId = id;
      const ex = exampleOf(id);
      picker.value = id;
      desc.textContent = ex.description;
      editor.setText(ex.text);
      clearTimeout(parseTimer);
      update();
      diagram.tidy();
      showReading(null);
      SS.announce(`Loaded the example: ${ex.title}.`);
    }
    picker.addEventListener('change', () => {
      if (changed() && !root.confirm('Replace your changes with this example?')) { picker.value = exampleId; return; }
      loadExample(picker.value);
    });
    function resetExample() {
      if (changed() && !root.confirm('Replace your changes with this example?')) return;
      loadExample(exampleId);
    }

    applySizes();
    loadExample(exampleId);
    editor.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(this);
