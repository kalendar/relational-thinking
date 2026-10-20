// SQL Studio: starts the app and wires the panels together.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon } = SS;
  // Picker order is by number: 0. Ch 8 and 9 Sample Data comes first.
  const DATASETS = (root.QE_DATASETS || []).slice().sort((a, b) => a.number - b.number);

  const storage = () => { try { return root.localStorage; } catch (e) { return null; } };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const stripSemi = s => s.replace(/;\s*$/, '');

  function decodeBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function boot() {
    const appEl = document.getElementById('app');
    let SQL;
    try {
      SQL = await root.initSqlJs({ wasmBinary: decodeBase64(root.SS_WASM_BASE64) });
    } catch (e) {
      appEl.replaceChildren(h('p', { class: 'boot-note', role: 'alert' }, "SQL Studio couldn't start in this browser. Try an up-to-date Chrome, Edge, Firefox, or Safari."));
      return;
    }
    appEl.classList.remove('booting');
    appEl.replaceChildren();

    const prefs = SS.loadPrefs(storage());
    const L = SS.createLayout(appEl, prefs, p => SS.savePrefs(storage(), p));
    const sessions = SS.createSessions();
    const schemas = new Map(); // id -> schema (kept so ERD link edits last for the visit)
    let upload = null; // { schema, renamed }
    let studio = null;
    let currentId = null;

    // ---- header ----
    const sub = h('p', { class: 'sub', 'aria-live': 'polite' });
    const picker = h('select', { id: 'ds-picker', class: 'picker' });
    const desc = h('p', { class: 'picker-desc' });
    const uploadBtn = h('button', { type: 'button', class: 'btn', title: 'Use your own CSV or Excel data', onclick: onUpload }, icon('upload'), 'Upload');
    const uploadMsg = h('p', { class: 'picker-desc', role: 'alert' });
    L.header.append(
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, icon('db')), h('div', null, h('h1', null, 'SQL Studio'), sub)),
      h('div', { class: 'picker-wrap' }, h('div', { class: 'picker-row' }, h('label', { for: 'ds-picker' }, 'Data set'), picker, uploadBtn), desc, uploadMsg));
    function fillPicker() {
      picker.replaceChildren(...DATASETS.map(d => h('option', { value: d.id }, `${d.number}. ${d.name}`)),
        upload ? h('option', { value: 'upload' }, 'Your data') : null);
      picker.value = currentId || DATASETS[0].id;
    }
    picker.addEventListener('change', () => switchTo(picker.value));

    // ---- SQL panel ----
    const copyBtn = SS.iconButton('copy', 'Copy the SQL', { onclick: async () => SS.announce((await SS.copyText(editor.getText())) === 'copied' ? 'SQL copied.' : 'Your browser would not let us copy.') });
    const formatBtn = SS.iconButton('wand', `Format SQL (Shift+Alt+F)`, { onclick: formatAll });
    const toolbar = h('div', { class: 'panel-tools sql-toolbar', role: 'toolbar', 'aria-label': 'SQL tools' });
    L.sql.tools.prepend(toolbar);
    SS.createRandomControls(toolbar, { prefs, save: L.save, onGenerate: randomQuery });
    toolbar.append(copyBtn, formatBtn);
    const tidyBox = h('input', { type: 'checkbox', id: 'tidy-run' });
    tidyBox.checked = prefs.tidyOnRun;
    tidyBox.addEventListener('change', () => { prefs.tidyOnRun = tidyBox.checked; L.save(); });
    const runBtn = h('button', { type: 'button', class: 'btn primary', onclick: run, 'aria-keyshortcuts': SS.isMac ? 'Meta+Enter' : 'Control+Enter', title: `Run (${SS.modKey}+Enter)` }, 'Run ', icon('play'));
    const host = h('div', { class: 'editor-host' });
    L.sql.body.append(h('div', { class: 'run-row' }, h('label', { class: 'check-label', for: 'tidy-run' }, tidyBox, 'Tidy on Run'), runBtn), host);
    const editor = SS.createEditor(host, { onRun: run, onFormat: formatAll, onChange: text => { runBtn.disabled = !text.trim(); } });

    // ---- other panels ----
    const results = SS.createResults(L.results);
    const exercises = SS.createExercises(L.exercises, { onSelect: () => {}, onCheck: check, onHomework: homework });
    const erd = SS.createErd(L.erd, { prefs, save: L.save, onChange: c => { sub.textContent = `${plural(c.tables, 'table', 'tables')} · ${plural(c.relationships, 'relationship', 'relationships')}`; } });
    const dataView = SS.createDataView(L.data);

    // Students' queries run in a worker, so one that takes too long can be stopped (see query-runner.js).
    // The worker is built from scripts already in the page, so this also works from a local file.
    const WORKER_PARTS = ['vendor/sql.js/sql-wasm.js', 'src/sql-text.js', 'src/schema.js', 'src/db.js', 'src/query-runner.js'];
    let workerUrl = null;
    function makeWorker() {
      if (!workerUrl) {
        const parts = WORKER_PARTS.map(n => document.querySelector(`script[data-src="${n}"]`).textContent);
        const boot = `var SS_WASM_BASE64 = "${root.SS_WASM_BASE64}";
self.SS.workerMain(self, function () {
  var bin = atob(SS_WASM_BASE64), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return initSqlJs({ wasmBinary: bytes });
});`;
        workerUrl = URL.createObjectURL(new Blob([parts.join('\n;\n'), '\n', boot], { type: 'text/javascript' }));
      }
      return new root.Worker(workerUrl);
    }
    const runner = SS.createQueryRunner({ makeWorker, fallback: (q, o) => SS.runQuery(studio, q, o) });
    let runToken = 0; // a newer run, check, or data set switch makes older answers stale
    L.onPanelToggle((key, collapsed) => { if (!collapsed && key === 'sql') editor.refresh(); if (!collapsed && key === 'erd') erd.fit(); });

    // ---- switching data sets ----
    function schemaFor(id) {
      if (id === 'upload') return upload.schema;
      if (!schemas.has(id)) schemas.set(id, SS.buildSchema(DATASETS.find(d => d.id === id)));
      return schemas.get(id);
    }

    function switchTo(id) {
      if (currentId) sessions.leave(currentId, { text: editor.getText(), cursor: editor.getCursor(), exerciseIndex: exercises.index });
      if (studio) SS.closeStudio(studio);
      currentId = id;
      const schema = schemaFor(id);
      studio = SS.openStudio(SQL, schema);
      runToken++;
      runner.open(schema);
      const st = sessions.enter(id, schema);
      editor.setText(st.text, null, { keepHistory: false });
      editor.setCursor(st.cursor);
      editor.setSchema(schema);
      runBtn.disabled = !st.text.trim();
      results.showEmpty();
      const list = id === 'upload' ? [] : SS.EXERCISES[id] || [];
      exercises.setData({ schema, list, assessment: SS.isAssessment(schema.number), index: st.exerciseIndex, uploaded: id === 'upload' });
      erd.setSchema(schema, { renamed: id === 'upload' ? upload.renamed : [] });
      dataView.setStudio(studio);
      desc.textContent = schema.description;
      fillPicker();
      SS.announce(`Loaded ${id === 'upload' ? 'your data' : `${schema.number}. ${schema.name}`}: ${plural(schema.tables.length, 'table', 'tables')}.`);
    }

    // ---- run, format, check ----
    // The statement at the cursor, after Tidy on Run (if on). Returns { text, start } or null.
    function currentStatement({ tidy }) {
      const full = editor.getText();
      let stmt = SS.statementAt(full, editor.getCursorIndex());
      if (!stmt) return null;
      if (tidy) {
        const lead = stmt.text.match(/^\s*/)[0];
        const trail = stmt.text.match(/\s*$/)[0];
        const body = stmt.text.slice(lead.length, stmt.text.length - trail.length);
        const pretty = SS.formatStatement(body);
        if (pretty !== body) {
          editor.replaceRange(stmt.start + lead.length, stmt.start + lead.length + body.length, pretty);
          stmt = { text: lead + pretty + trail, start: stmt.start };
          editor.setCursorIndex(stmt.start + lead.length + pretty.length);
        }
      }
      return stmt;
    }

    function showRunError(stmt, error) {
      const ex = SS.explainError(error, stmt ? stmt.text : '', studio.schema, { probe: q => SS.probeError(studio, q) });
      const abs = stmt && ex.offset !== null ? stmt.start + ex.offset : null;
      editor.markError(abs, ex.length);
      const where = abs !== null ? SS.lineCol(editor.getText(), abs) : null;
      results.showError(ex, where, () => editor.setCursorIndex(abs));
      SS.announce(`Error. ${ex.headline}${where ? ` Line ${where.line}, column ${where.col}.` : ''}`);
    }

    // Runs a statement in the worker; shows "Running…" if it takes a moment. Resolves to null if it went stale.
    async function runInWorker(sql) {
      const token = ++runToken;
      const busy = setTimeout(() => { if (token === runToken) results.showBusy(); }, 400);
      runBtn.disabled = true;
      try {
        const r = await runner.run(sql);
        return token === runToken ? r : null;
      } finally {
        clearTimeout(busy);
        runBtn.disabled = !editor.getText().trim();
      }
    }

    async function run() {
      const stmt = currentStatement({ tidy: prefs.tidyOnRun });
      if (!stmt) { showRunError(null, { kind: 'empty', message: '' }); return; }
      editor.flash(stmt.start, stmt.start + stmt.text.length);
      const r = await runInWorker(stmt.text);
      if (!r) return;
      if (!r.ok) { showRunError(stmt, r.error); return; }
      editor.clearMarks();
      results.showResult(r);
      SS.announce(r.rows.length ? `Query ran: ${plural(r.rows.length, 'row', 'rows')}, ${plural(r.columns.length, 'column', 'columns')}.` : 'Query ran: no rows.');
    }

    function formatAll() {
      const before = editor.getText();
      const after = SS.formatSql(before);
      if (after !== before) editor.setText(after, Math.min(editor.getCursorIndex(), after.length));
      SS.announce('SQL formatted.');
    }

    async function check(i) {
      const stmt = currentStatement({ tidy: false });
      const ex = SS.EXERCISES[currentId][i];
      if (!stmt) { exercises.setFeedback(i, { ok: false, message: 'Write a query in the SQL panel first, then check it.' }); return; }
      const student = await runInWorker(stmt.text);
      if (!student) return;
      if (!student.ok) {
        showRunError(stmt, student.error);
        exercises.setFeedback(i, { ok: false, message: student.error.kind === 'timeout' ? 'Your query took too long, so it was stopped. Fix it, then check again.' : 'Fix the error, then check again.' });
        return;
      }
      // The answers are small, fixed queries, so they run on the page.
      const expected = SS.runQuery(studio, stripSemi(ex.answer));
      results.showResult(student);
      exercises.setFeedback(i, SS.compareResults(student, expected, { orderMatters: !!ex.orderMatters }));
    }

    async function homework(opener) {
      const stmt = currentStatement({ tidy: false });
      const sql = stmt ? stmt.text.trim() : '';
      const result = stmt ? await runInWorker(stmt.text) : null;
      if (stmt && !result) return;
      SS.showHomeworkDialog({ schema: studio.schema, list: currentId === 'upload' ? [] : SS.EXERCISES[currentId], index: exercises.index, sql: sql || '(no SQL yet)', result, opener });
    }

    // Replaces the statement at the cursor (or adds to the end) with a random query.
    function randomQuery(options) {
      const run = q => SS.runQuery(studio, stripSemi(q));
      const seed = Math.floor(Math.random() * 2 ** 31);
      const broken = prefs.mistakes ? SS.makeBrokenQuery({ schema: studio.schema, run, options, seed }) : null;
      const g = broken ? { sql: broken.text.replace(/\s+$/, '') } : SS.generateQuery({ schema: studio.schema, run, options, seed });
      const full = editor.getText();
      const stmt = SS.statementAt(full, editor.getCursorIndex());
      if (stmt) {
        const lead = stmt.text.match(/^\s*/)[0];
        const endsWithSemi = full.slice(stmt.start + stmt.text.length, stmt.end) === ';';
        const text = endsWithSemi ? stripSemi(g.sql) : g.sql;
        editor.replaceRange(stmt.start + lead.length, stmt.start + stmt.text.length, text);
        editor.setCursorIndex(stmt.start + lead.length);
      } else {
        const sep = full.trim() ? '\n\n' : '';
        editor.setText(full.replace(/\s*$/, '') + sep + g.sql, null);
      }
      SS.announce(broken
        ? `A query with ${broken.mistakes.length === 1 ? '1 mistake' : `${broken.mistakes.length} mistakes`} is in the editor, with its question at the top. Fix it, then run it.`
        : 'A random query is in the editor. Press Run to try it.');
    }

    async function onUpload() {
      uploadMsg.textContent = '';
      try {
        const got = await SS.pickUpload();
        if (!got) return;
        if (currentId === 'upload') { sessions.leave('upload', { text: '' }); currentId = null; }
        sessions.forget('upload');
        upload = got;
        switchTo('upload');
      } catch (e) {
        uploadMsg.textContent = e.message;
      }
    }

    fillPicker();
    switchTo(DATASETS[0].id);
    editor.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(this);
