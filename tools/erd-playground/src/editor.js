// ERD Playground: the notation editor (CodeMirror 5) with a small mode for the ERD notation,
// error underlines, the highlighted relationship line, and the highlighted end symbol.
(function (root) {
  'use strict';
  const SS = root.SS;
  const CM = root.CodeMirror;

  // Token classes: keyword (erDiagram), operator (line ends and --/..), string (labels), comment (%%),
  // variable-2 (entity names), type (attribute types), atom (PK/FK/UK).
  CM.defineMode('erd', () => ({
    startState: () => ({ inBlock: false, label: false, lineStart: true }),
    token(stream, state) {
      if (stream.sol()) { state.label = false; state.lineStart = true; }
      if (stream.eatSpace()) return null;
      const first = state.lineStart;
      state.lineStart = false;
      if (stream.match('%%')) { stream.skipToEnd(); return 'comment'; }
      if (stream.match(/^"[^"]*"?/)) return 'string';
      if (state.label) { stream.skipToEnd(); return 'string'; }
      if (!state.inBlock && stream.match(/^erDiagram\b/)) return 'keyword';
      if (stream.match(/^[|}o{]{1,2}(?:--|\.\.)[|}o{]{1,2}/)) return 'operator';
      if (stream.match('{')) { state.inBlock = true; return 'bracket'; }
      if (stream.match('}')) { state.inBlock = false; return 'bracket'; }
      if (stream.match(':')) { state.label = true; return 'operator'; }
      if (state.inBlock) {
        if (first && stream.match(/^\S+/)) return 'type';
        if (stream.match(/^(PK|FK|UK)\b/)) return 'atom';
      }
      if (stream.match(/^[A-Za-z_][\w-]*/)) return 'variable-2';
      stream.next();
      return null;
    },
  }));

  function createNotationEditor(host, { onChange }) {
    const cm = CM(host, {
      mode: 'erd',
      theme: 'default studio',
      lineNumbers: true,
      styleActiveLine: true,
      matchBrackets: true,
      inputStyle: 'contenteditable',
      screenReaderLabel: 'ERD notation editor. Press Tab to leave the editor.',
      indentUnit: 4,
      // Tab and Shift-Tab move focus out of the editor, so keyboard users are never stuck.
      extraKeys: { Tab: false, 'Shift-Tab': false },
    });
    // Curly quotes (from a word processor or a phone keyboard) become straight ones, so Copy gives text Mermaid accepts.
    cm.on('beforeChange', (_, change) => {
      if (change.update && change.text.some(t => /[\u201C\u201D\u2018\u2019]/.test(t))) {
        change.update(change.from, change.to, change.text.map(t => t.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")));
      }
    });
    cm.on('change', () => onChange(cm.getValue()));

    const at = span => ({ from: { line: span.line - 1, ch: span.col - 1 }, to: { line: span.line - 1, ch: span.col - 1 + Math.max(span.length, 1) } });
    let errorMark = null;
    let symbolMark = null;
    let lineHandle = null;

    return {
      cm,
      getText: () => cm.getValue(),
      setText(text) { cm.setValue(text); cm.clearHistory(); cm.setCursor({ line: 0, ch: 0 }); },
      // span: { line, col, length } (1-based) or null to clear.
      markError(span) {
        if (errorMark) errorMark.clear();
        errorMark = null;
        if (span) { const r = at(span); errorMark = cm.markText(r.from, r.to, { className: 'cm-error-mark', attributes: { title: 'The problem starts here' } }); }
      },
      markSymbol(span) {
        if (symbolMark) symbolMark.clear();
        symbolMark = null;
        if (span) { const r = at(span); symbolMark = cm.markText(r.from, r.to, { className: 'cm-sym-mark' }); }
      },
      highlightLine(line) {
        if (lineHandle) cm.removeLineClass(lineHandle, 'background', 'cm-rel-line');
        lineHandle = line ? cm.addLineClass(line - 1, 'background', 'cm-rel-line') : null;
      },
      // fn(line, col): both 1-based.
      onCursorLine(fn) { cm.on('cursorActivity', () => { const c = cm.getCursor(); fn(c.line + 1, c.ch + 1); }); },
      setCursorLine(line) { cm.setCursor({ line: line - 1, ch: 0 }); cm.focus(); },
      focus: () => cm.focus(),
      refresh: () => cm.refresh(),
    };
  }

  root.SS = Object.assign(SS, { createNotationEditor });
})(this);
