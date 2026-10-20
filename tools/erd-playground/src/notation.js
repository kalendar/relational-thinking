// ERD Playground: reads Chapter 6's crow's foot notation (a subset of Mermaid's erDiagram) into a model.
// Never throws: problems become plain-words errors with a line and column.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const END_KINDS = {
    left: { '||': 'one', '|o': 'zero-one', '}|': 'one-many', '}o': 'zero-many' },
    right: { '||': 'one', 'o|': 'zero-one', '|{': 'one-many', 'o{': 'zero-many' },
  };
  const LINES = { '--': false, '..': true }; // value: dashed?
  const ENDS_HELP = 'Line ends are `||`, `o|`, `|{`, or `o{`';
  const LABEL_NOTE = 'A line without a label works here. To use it in Mermaid or an AI tool, add a label, like `: "records"`.';
  const HEADER_NOTE = 'Add `erDiagram` as the first line to use this in Mermaid.';

  const NAME = '[A-Za-z_][A-Za-z0-9_-]*';
  const RE_NAME_ONLY = new RegExp(`^(${NAME})$`);
  const RE_BLOCK_OPEN = new RegExp(`^(${NAME})\\s*\\{\\s*(\\})?$`);
  const RE_REL = new RegExp(`^(${NAME})\\s+(\\S+)(?:\\s+(.*))?$`);
  const RE_SECOND = new RegExp(`^(${NAME})\\s*(?::\\s*(.*))?$`);
  const RE_KEYS = /^((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*)?\s*(?:"([^"]*)")?$/;
  const looksLikeSymbol = tok => /[|{}]|--|\.\./.test(tok);

  // Checks a relationship symbol like ||--o{. Returns { aEnd, bEnd, dashed } or { error }.
  function readSymbol(tok, n) {
    const L = tok.slice(0, 2);
    const mid = tok.slice(2, 4);
    const R = tok.slice(4, 6);
    if (tok.length === 6 && END_KINDS.left[L] && mid in LINES && END_KINDS.right[R]) {
      return { aEnd: END_KINDS.left[L], bEnd: END_KINDS.right[R], dashed: LINES[mid] };
    }
    if (tok.length === 5 && END_KINDS.left[tok.slice(0, 2)] && tok.slice(2, 4) in LINES) {
      return { error: `Line ${n}: \`${tok}\` is missing its last symbol. ${ENDS_HELP}.` };
    }
    if (tok.length === 5 && tok.slice(1, 3) in LINES && END_KINDS.right[tok.slice(3, 5)]) {
      return { error: `Line ${n}: \`${tok}\` is missing its first symbol. ${ENDS_HELP}.` };
    }
    return { error: `Line ${n}: \`${tok}\` isn't a relationship symbol. ${ENDS_HELP}, with \`--\` in the middle.` };
  }

  function readLabel(text) {
    const t = text.trim();
    const q = /^"([^"]*)"$/.exec(t);
    return q ? q[1] : t;
  }

  function parseErd(text) {
    const model = { hasHeader: false, entities: [], relationships: [], errors: [], notes: [] };
    const byName = new Map();
    const ensure = (name, line) => {
      if (!byName.has(name)) {
        const e = { name, display: name, line, attributes: [] };
        byName.set(name, e);
        model.entities.push(e);
      }
      return byName.get(name);
    };
    const fail = (n, col, length, message) => model.errors.push({ line: n, col, length, message });

    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
    let seenContent = false;
    let block = null; // { entity, line }
    let missingLabel = false;

    lines.forEach((line, i) => {
      const n = i + 1;
      let t = line.trim();
      if (!t || t.startsWith('%%')) return;
      const lead = line.indexOf(t);

      if (block) {
        if (t === '}') { block = null; return; }
        const m = /^(\S+)\s+([A-Za-z_][A-Za-z0-9_-]*)(.*)$/.exec(t);
        const k = m && RE_KEYS.exec(m[3].trim());
        if (!m || !k) {
          fail(n, lead + 1, t.length, `Line ${n}: An attribute line looks like \`type name\`, for example \`int artist_id PK\`.`);
          return;
        }
        block.entity.attributes.push({ type: m[1], name: m[2], keys: k[1] ? k[1].split(/\s*,\s*/) : [], comment: k[2] || '' });
        return;
      }

      if (!seenContent) {
        seenContent = true;
        const h = /^erDiagram\b\s*(.*)$/.exec(t);
        if (h) {
          model.hasHeader = true;
          if (!h[1]) return;
          t = h[1];
        }
      }

      let m = RE_BLOCK_OPEN.exec(t);
      if (m) {
        const entity = ensure(m[1], n);
        if (!m[2]) block = { entity, line: n };
        return;
      }
      m = RE_NAME_ONLY.exec(t);
      if (m) { ensure(m[1], n); return; }

      m = RE_REL.exec(t);
      if (!m || !looksLikeSymbol(m[2])) {
        fail(n, lead + 1, t.length, `Line ${n}: This line isn't a relationship, an entity, or an attribute block.`);
        return;
      }
      const symCol = line.indexOf(m[2], lead + m[1].length) + 1;
      const sym = readSymbol(m[2], n);
      if (sym.error) { fail(n, symCol, m[2].length, sym.error); return; }
      const rest = m[3] || '';
      const second = RE_SECOND.exec(rest.trim());
      if (!second) {
        if (!rest.trim() || rest.trim().startsWith(':')) fail(n, symCol, m[2].length, `Line ${n}: This relationship needs an entity on each side.`);
        else fail(n, line.indexOf(rest.trim(), symCol) + 1, rest.trim().length, `Line ${n}: Put a \`:\` before the label.`);
        return;
      }
      const label = second[2] === undefined ? '' : readLabel(second[2]);
      if (second[2] === undefined) missingLabel = true;
      ensure(m[1], n);
      ensure(second[1], n);
      model.relationships.push({
        a: m[1], b: second[1], aEnd: sym.aEnd, bEnd: sym.bEnd, dashed: sym.dashed, label, line: n,
        aSym: { line: n, col: symCol, length: 2 }, bSym: { line: n, col: symCol + 4, length: 2 },
      });
    });

    if (block) fail(block.line, 1, lines[block.line - 1].length, `Line ${block.line}: This attribute block is missing its closing \`}\`.`);
    if (missingLabel) model.notes.push(LABEL_NOTE);
    if (seenContent && !model.hasHeader) model.notes.push(HEADER_NOTE);
    return model;
  }

  const api = { END_KINDS, parseErd };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
