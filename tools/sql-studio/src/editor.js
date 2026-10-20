// SQL Studio: the CodeMirror 5 editor: SQLite mode, autocomplete from the schema, error marks, run flash.
(function (root) {
  'use strict';
  const SS = root.SS;
  const CM = root.CodeMirror;

  function createEditor(host, { onRun, onFormat, onChange }) {
    const cm = CM(host, {
      mode: 'text/x-sqlite',
      theme: 'default studio',
      lineNumbers: true,
      styleActiveLine: true,
      matchBrackets: true,
      inputStyle: 'contenteditable',
      screenReaderLabel: 'SQL editor. Press Control Enter to run. Press Tab to leave the editor.',
      indentUnit: 2,
      tabSize: 2,
      gutters: ['err-gutter', 'CodeMirror-linenumbers'],
      // Tab and Shift-Tab move focus out of the editor, so keyboard users are never stuck.
      extraKeys: { 'Ctrl-Enter': () => onRun(), 'Cmd-Enter': () => onRun(), 'Shift-Alt-F': () => onFormat(), 'Ctrl-Space': 'autocomplete', Tab: false, 'Shift-Tab': false },
      hintOptions: { completeSingle: false, tables: {} },
    });

    // Open suggestions after a letter or "." (short pause), but not inside strings or comments.
    let hintTimer = null;
    cm.on('inputRead', (_, change) => {
      const ch = change.text[change.text.length - 1].slice(-1);
      if (!/[A-Za-z_.]/.test(ch)) return;
      const tok = cm.getTokenAt(cm.getCursor());
      if (tok.type && /string|comment/.test(tok.type)) return;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { if (!cm.state.completionActive) cm.showHint({ completeSingle: false }); }, 150);
    });

    let errorMarks = [];
    const clearMarks = () => {
      errorMarks.forEach(m => m.clear());
      errorMarks = [];
      cm.clearGutter('err-gutter');
    };
    cm.on('change', () => { clearMarks(); onChange(cm.getValue()); });

    function setSchema(schema) {
      const tables = {};
      for (const t of schema.tables) tables[t.name] = t.columns.map(c => c.name);
      cm.setOption('hintOptions', { completeSingle: false, tables });
    }

    // Underlines the problem spot (absolute offsets into the whole editor text) and marks its line.
    function markError(offset, length) {
      clearMarks();
      if (offset === null || offset === undefined) return;
      const total = cm.getValue().length;
      let from = Math.min(offset, total);
      let to = Math.min(offset + Math.max(length, 1), total);
      if (from === to && from > 0) from -= 1;
      const a = cm.posFromIndex(from);
      const b = cm.posFromIndex(to);
      errorMarks.push(cm.markText(a, b, { className: 'cm-error-mark', attributes: { title: 'The problem starts here' } }));
      cm.setGutterMarker(a.line, 'err-gutter', SS.h('div', { class: 'err-dot', title: 'Error on this line' }));
    }

    // Briefly highlights the statement that ran.
    function flash(start, end) {
      const m = cm.markText(cm.posFromIndex(start), cm.posFromIndex(end), { className: 'cm-ran' });
      setTimeout(() => m.clear(), SS.reducedMotion() ? 400 : 900);
    }

    return {
      cm,
      getText: () => cm.getValue(),
      // Replaces all text (kept in undo history) and puts the cursor at `cursorIndex` or the end.
      setText(text, cursorIndex = null, { keepHistory = true } = {}) {
        if (keepHistory) cm.replaceRange(text, { line: 0, ch: 0 }, cm.posFromIndex(cm.getValue().length));
        else { cm.setValue(text); cm.clearHistory(); }
        cm.setCursor(cm.posFromIndex(cursorIndex === null ? text.length : Math.min(cursorIndex, text.length)));
      },
      replaceRange(start, end, text) { cm.replaceRange(text, cm.posFromIndex(start), cm.posFromIndex(end)); },
      getCursorIndex: () => cm.indexFromPos(cm.getCursor()),
      getCursor: () => cm.getCursor(),
      setCursor: pos => { if (pos) cm.setCursor(pos); },
      setCursorIndex(i) { cm.setCursor(cm.posFromIndex(i)); cm.focus(); },
      setSchema,
      markError,
      clearMarks,
      flash,
      focus: () => cm.focus(),
      refresh: () => cm.refresh(),
    };
  }

  root.SS = Object.assign(SS, { createEditor });
})(this);
